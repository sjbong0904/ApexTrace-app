/**
 * Desktop-window cold-start benchmark in headless Edge/Chrome (playwright-core, no browser download).
 *
 *   node scripts/loadbench/run.mjs --dist <built dist> [--runs 7] [--network replay|live|offline]
 *                                  [--scenario empty|demo] [--latency 80] [--record] [--json out.json] [--channel msedge|chrome]
 *
 * Harness: background.html loads first in a hidden iframe (stands in for the Overwolf background
 * window), then index.html (desktop) in a 1600×900 iframe. Overwolf APIs are stubbed
 * (overwolf-stub.js). Fresh browser profile every run → first-run / demo state, the same scenario
 * for every version.
 *
 * Network modes
 *   replay (default)  external requests answered from fixtures/network.json after a fixed latency, so
 *                     versions are compared on identical data + latency (client cost only).
 *                     Requests the fixture doesn't know get an empty 503 and are counted as `unmatched`.
 *   --record          live run that (re)writes fixtures/network.json — do this once, then compare.
 *   live              real internet; adds real per-host timings (noisy, measures the backend too).
 *   offline           every external request → 503 (error-path startup).
 */
import { createServer } from 'http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'fixtures', 'network.json');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIST = opt('dist');
const RECORD = args.includes('--record');
const NETWORK = RECORD ? 'live' : opt('network', 'replay');
const RUNS = RECORD ? 1 : Number(opt('runs', '7'));
const LATENCY = Number(opt('latency', '80'));
/** empty: demo disabled (same blank first-run screen in every version) · demo: first-run sample profile (v0.0.16+). */
const SCENARIO = opt('scenario', RECORD ? 'demo' : 'empty'); // record in demo: it makes the most requests
/*
 * profile       returning user on a new device: pinned profile (apex_pinned_uid), empty IndexedDB → the
 *               whole profile + match history comes over the (replayed) network.
 * profile-warm  same user reopening the app: one priming load in the same browser profile fills the
 *               local cache first, then the measured load.
 * The uid comes from --uid or fixtures/profile.json (gitignored, keeps the account out of the repo).
 */
const PROFILE_FILE = join(HERE, 'fixtures', 'profile.json');
const UID = opt('uid') ?? (existsSync(PROFILE_FILE) ? JSON.parse(readFileSync(PROFILE_FILE, 'utf8')).uid : null);
if (SCENARIO.startsWith('profile') && !UID) {
    console.error(`scenario ${SCENARIO} needs --uid or ${PROFILE_FILE} ({"uid": "..."})`);
    process.exit(2);
}
const PROFILE_NAME = SCENARIO.startsWith('profile') && existsSync(PROFILE_FILE) && !opt('uid') ? JSON.parse(readFileSync(PROFILE_FILE, 'utf8')).name : null;
const JSON_OUT = opt('json');
const SETTLE_MS = 1500;
const TIMEOUT_MS = 30_000;
if (!DIST || !existsSync(join(DIST, 'index.html'))) {
    console.error('usage: run.mjs --dist <dist dir with index.html>');
    process.exit(2);
}

// ---------- fixture ----------
/** Key without volatile parts; Supabase auth rides in headers, not the URL. */
const keyOf = (method, url) => `${method} ${url}`;
const pathKeyOf = (method, url) => { const u = new URL(url); return `${method} ${u.host}${u.pathname}`; };
let fixture = null;
if (NETWORK === 'replay') {
    if (!existsSync(FIXTURE)) {
        console.error(`no fixture at ${FIXTURE} — record one first: node scripts/loadbench/run.mjs --dist <dist> --record`);
        process.exit(2);
    }
    fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
}
const recorded = {};
/** Replay answers come from the bench origin, so CORS is rebuilt rather than recorded. */
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };

// ---------- static server ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0}</style></head><body>
<iframe id="bg" src="/background.html" style="display:none"></iframe>
<script>
  const bg = document.getElementById('bg');
  bg.addEventListener('load', () => {
    window.__bgWindow = bg.contentWindow;
    window.__bgLoadedAt = performance.now();
    const d = document.createElement('iframe');
    d.id = 'desktop'; d.src = '/index.html'; d.style.cssText = 'width:1600px;height:900px';
    window.__desktopStartAt = performance.now();
    document.body.appendChild(d);
  });
</script></body></html>`;
const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__harness') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HARNESS); return; }
    let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
    if (!file.startsWith(normalize(DIST))) { res.writeHead(403); res.end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/** Runs inside every frame before app code; only the desktop frame collects. */
const FRAME_PROBE = () => {
    if (location.pathname.includes('background') || location.pathname === '/__harness') return;
    const m = (window.__bench = { longTasks: 0, longTaskMs: 0, lcp: null, firstContentAt: null, lastMutationAt: null, timeline: [], errors: [] });
    try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) { m.longTasks += 1; m.longTaskMs += e.duration; } }).observe({ type: 'longtask', buffered: true });
        new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* older engines */ }
    window.addEventListener('error', (e) => m.errors.push(String(e.message).slice(0, 200)));
    window.addEventListener('unhandledrejection', (e) => m.errors.push(String(e.reason).slice(0, 200)));
    const start = () => {
        const root = document.getElementById('root');
        if (!root) return void setTimeout(start, 5);
        new MutationObserver(() => {
            const n = root.getElementsByTagName('*').length;
            const now = performance.now();
            if (n > 0 && m.firstContentAt === null) m.firstContentAt = now;
            m.lastMutationAt = now;
            const last = m.timeline.at(-1);
            if (!last || last[1] !== n) m.timeline.push([now, n]);
        }).observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    };
    start();
};

const browser = await chromium.launch({ channel: opt('channel', 'msedge'), headless: true, args: ['--enable-precise-memory-info'] });
const median = (xs) => { const s = xs.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b); if (!s.length) return null; const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const round1 = (v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v);

const runs = [];
const total = RECORD ? 1 : RUNS + 1; // first run = warm-up, discarded
for (let i = 0; i < total; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 }, serviceWorkers: 'block' });
    await ctx.addInitScript({ path: join(HERE, 'overwolf-stub.js') });
    await ctx.addInitScript(FRAME_PROBE);
    if (SCENARIO !== 'demo') {
        await ctx.addInitScript((uid) => {
            try {
                localStorage.setItem('demo_retired', '1');
                if (uid) localStorage.setItem('apex_pinned_uid', uid);
            } catch { /* opaque origin */ }
        }, SCENARIO.startsWith('profile') ? UID : null);
    }
    const requests = [];
    let unmatched = [];
    const startedAt = new Map();
    const pending = new Set();
    ctx.on('request', (r) => { startedAt.set(r, Date.now()); pending.add(r); });
    ctx.on('requestfailed', (r) => pending.delete(r));
    ctx.on('requestfinished', async (r) => {
        try {
        const s = await r.sizes().catch(() => null);
        requests.push({ url: r.url(), ms: Date.now() - (startedAt.get(r) ?? Date.now()), bytes: s ? s.responseBodySize : 0, failed: false });
        if (RECORD && !r.url().startsWith(ORIGIN)) {
            const res = await r.response().catch(() => null);
            if (!res) return;
            const body = await res.body().catch(() => null);
            if (body == null) return;
            const headers = res.headers();
            recorded[keyOf(r.method(), r.url())] = {
                status: res.status(),
                contentType: headers['content-type'] ?? 'application/octet-stream',
                // Supabase list length rides in content-range for some queries.
                headers: Object.fromEntries(Object.entries(headers).filter(([k]) => k === 'content-range')),
                bodyBase64: body.toString('base64'),
            };
        }
        } finally { pending.delete(r); }
    });
    ctx.on('requestfailed', (r) => requests.push({ url: r.url(), ms: Date.now() - (startedAt.get(r) ?? Date.now()), bytes: 0, failed: true }));

    if (NETWORK !== 'live') {
        const byPath = fixture ? Object.fromEntries(Object.entries(fixture).map(([k, v]) => {
            const [method, url] = [k.slice(0, k.indexOf(' ')), k.slice(k.indexOf(' ') + 1)];
            return [pathKeyOf(method, url), v];
        })) : {};
        await ctx.route((u) => !u.href.startsWith(ORIGIN), async (route) => {
            const req = route.request();
            if (req.method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: CORS });
                return;
            }
            await new Promise((r) => setTimeout(r, LATENCY));
            const hit = fixture?.[keyOf(req.method(), req.url())] ?? byPath[pathKeyOf(req.method(), req.url())];
            if (!hit) {
                unmatched.push(`${req.method()} ${req.url().slice(0, 140)}`);
                await route.fulfill({ status: 503, body: '' });
                return;
            }
            await route.fulfill({
                status: hit.status,
                headers: { ...Object.fromEntries(Object.entries(hit.headers).filter(([k]) => !k.startsWith('access-control-'))), ...CORS, 'content-type': hit.contentType },
                body: Buffer.from(hit.bodyBase64, 'base64'),
            });
        });
    }
    /** Load the harness and wait until the desktop DOM is quiet for SETTLE_MS (or timeout). */
    const loadAndSettle = async (pg) => {
        await pg.goto(`${ORIGIN}/__harness`);
        const fr = await (await pg.waitForSelector('#desktop', { timeout: TIMEOUT_MS })).contentFrame();
        const t0 = Date.now();
        while (Date.now() - t0 < TIMEOUT_MS) {
            const s = await fr.evaluate(() => ({ now: performance.now(), last: window.__bench?.lastMutationAt, first: window.__bench?.firstContentAt })).catch(() => null);
            if (s?.first != null && s.now - s.last >= SETTLE_MS) return { frame: fr, settled: true };
            await pg.waitForTimeout(100);
        }
        return { frame: fr, settled: false };
    };
    if (SCENARIO === 'profile-warm') {
        // Priming load fills IndexedDB / localStorage in this browser profile; not measured.
        const prime = await ctx.newPage();
        await loadAndSettle(prime);
        await prime.waitForTimeout(1000); // let pending cache writes finish
        await prime.close();
        requests.length = 0;
        unmatched = [];
    }

    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const { frame, settled } = await loadAndSettle(page);
    if (RECORD) {
        // Slow upstreams (e.g. the ranked-stats API) can answer after the screen settles; keep them.
        const until = Date.now() + 20_000;
        while (pending.size > 0 && Date.now() < until) await page.waitForTimeout(200);
        await page.waitForTimeout(500);
    }
    const r = await frame.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        const local = performance.getEntriesByType('resource').filter((e) => e.name.startsWith(location.origin));
        const tl = window.__bench.timeline;
        const finalNodes = tl.at(-1)?.[1] ?? 0;
        const reach = (frac) => tl.find(([, n]) => n >= finalNodes * frac)?.[0] ?? null;
        return {
            domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
            load: nav?.loadEventEnd ?? null,
            fcp: fcp?.startTime ?? null,
            lcp: window.__bench.lcp,
            firstContent: window.__bench.firstContentAt,
            content50: reach(0.5),
            content90: reach(0.9),
            settled: window.__bench.lastMutationAt,
            longTasks: window.__bench.longTasks,
            longTaskMs: window.__bench.longTaskMs,
            domNodes: finalNodes,
            heapUsedMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
            localResources: local.length,
            localBytes: local.reduce((n, e) => n + (e.decodedBodySize || 0), 0),
            errors: window.__bench.errors,
        };
    });
    const { metrics } = await cdp.send('Performance.getMetrics');
    const pm = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    r.scriptMs = (pm.ScriptDuration ?? 0) * 1000; // whole page: harness + background + desktop
    r.layoutMs = (pm.LayoutDuration ?? 0) * 1000;
    r.settledOk = settled;
    // Sanity: the pinned profile (not the demo / blank screen) is what got rendered.
    if (PROFILE_NAME) r.profileShown = await frame.evaluate((n) => document.body.innerText.includes(n), PROFILE_NAME).catch(() => false);
    const external = requests.filter((q) => !q.url.startsWith(ORIGIN));
    const byHost = {};
    for (const q of external) {
        const e = (byHost[new URL(q.url).host] ??= { count: 0, failed: 0, bytes: 0, ms: [] });
        e.count += 1; e.failed += q.failed ? 1 : 0; e.bytes += Math.max(0, q.bytes); e.ms.push(q.ms);
    }
    r.externalRequests = external.length;
    r.externalBytes = external.reduce((n, q) => n + Math.max(0, q.bytes), 0);
    r.unmatched = unmatched;
    r.byHost = Object.fromEntries(Object.entries(byHost).map(([h, e]) => [h, { count: e.count, failed: e.failed, bytes: e.bytes, medianMs: median(e.ms) }]));
    if (RECORD || i > 0) runs.push(r);
    process.stdout.write(RECORD ? 'recorded ' : i === 0 ? 'warm-up ' : `run${i} `);
    await ctx.close();
}
await browser.close();
server.close();

if (RECORD) {
    mkdirSync(dirname(FIXTURE), { recursive: true });
    // Merge, keeping existing answers: recording against another version's build only adds the requests
    // that version makes, so every version is served the same data. Delete the file to re-record from scratch.
    const prev = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : {};
    const added = Object.keys(recorded).filter((k) => !(k in prev)).length;
    writeFileSync(FIXTURE, JSON.stringify({ ...recorded, ...prev }));
    console.log(`
fixture: +${added} new responses (${Object.keys(recorded).length} seen)`);
    console.log(`\nfixture: ${Object.keys(recorded).length} responses → ${FIXTURE}`);
}

const KEYS = ['fcp', 'lcp', 'firstContent', 'content50', 'content90', 'settled', 'domContentLoaded', 'load',
    'longTasks', 'longTaskMs', 'scriptMs', 'layoutMs', 'heapUsedMB', 'domNodes', 'localResources', 'localBytes',
    'externalRequests', 'externalBytes'];
const summary = {
    scenario: SCENARIO,
    network: NETWORK,
    latencyMs: NETWORK === 'replay' ? LATENCY : null,
    runs: runs.length,
    settledRuns: runs.filter((r) => r.settledOk).length,
    profileShownRuns: PROFILE_NAME ? runs.filter((r) => r.profileShown).length : null,
    perRun: runs.map((r) => ({ content90: round1(r.content90), settled: round1(r.settled), scriptMs: round1(r.scriptMs) })),
    median: Object.fromEntries(KEYS.map((k) => [k, round1(median(runs.map((r) => r[k])))])),
    min: Object.fromEntries(['content90', 'settled', 'scriptMs'].map((k) => [k, round1(Math.min(...runs.map((r) => r[k] ?? Infinity)))])),
    byHost: runs.at(-1)?.byHost ?? {},
    unmatched: [...new Set(runs.flatMap((r) => r.unmatched))],
    errors: [...new Set(runs.flatMap((r) => r.errors))].slice(0, 10),
};
console.log(`\n${JSON.stringify(summary, null, 2)}`);
if (JSON_OUT) writeFileSync(JSON_OUT, `${JSON.stringify(summary, null, 2)}\n`);

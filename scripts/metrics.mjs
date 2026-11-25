/**
 * Version metrics: measure the app, store one JSON per version, and diff against the previous one.
 *
 *   node scripts/metrics.mjs                  # measure the working tree (label = package.json version)
 *   node scripts/metrics.mjs --ref v0.0.15    # measure a git tag/commit (extracted to a temp dir)
 *   node scripts/metrics.mjs --label 0.0.16-rc1
 *   node scripts/metrics.mjs --compare v0.0.15   # diff against a specific record instead of the previous one
 *   node scripts/metrics.mjs --skip build,lint   # skip slow steps
 *
 * For --ref, the *current* tests (src/utils/__tests__) are also run against the old code, so
 * golden-snapshot mismatches show exactly which stat outputs changed between that version and now.
 *
 * Output:
 *   metrics/history/<label>.json   raw record
 *   metrics/HISTORY.md             table of all records (regenerated)
 *   metrics/diffs/<label>.md       diff of this record vs the previous one
 */
import { execFileSync, spawnSync } from 'child_process';
import {
    cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, extname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'metrics');
const HISTORY_DIR = join(OUT_DIR, 'history');
const DIFF_DIR = join(OUT_DIR, 'diffs');
const FIXTURE = join('src', 'assets', 'demo', 'demoMatches.json');

// ---------- args ----------
const args = process.argv.slice(2);
const opt = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
};
const ref = opt('ref');
const skip = new Set((opt('skip') ?? '').split(',').filter(Boolean));
const compareLabel = opt('compare');

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

// ---------- workspace ----------
let cwd = ROOT;
let tempRoot = null;
if (ref) {
    tempRoot = mkdtempSync(join(tmpdir(), 'apex-metrics-'));
    cwd = join(tempRoot, 'tree');
    mkdirSync(cwd);
    const tar = join(tempRoot, 'src.tar');
    execFileSync('git', ['archive', '--format=tar', '-o', tar, ref], { cwd: ROOT });
    execFileSync('tar', ['-xf', 'src.tar', '-C', 'tree'], { cwd: tempRoot, stdio: 'inherit' });
    // Per-entry junctions so tool caches (node_modules/.tmp, .vite) stay out of the real tree.
    const nm = join(cwd, 'node_modules');
    mkdirSync(nm);
    for (const entry of readdirSync(join(ROOT, 'node_modules'))) {
        if (entry === '.tmp' || entry === '.vite' || entry === '.cache') continue;
        symlinkSync(join(ROOT, 'node_modules', entry), join(nm, entry), 'junction');
    }
}

/** Temp space for test/build output; for --ref it is the extracted tree's parent. */
const scratch = tempRoot ?? mkdtempSync(join(tmpdir(), 'apex-metrics-'));

/** Old ref only: drop in today's tests + fixture, so old logic is checked against today's expectations.
 *  Runs after typecheck/lint/build/source so those measure the tag as it shipped. */
const injectCurrentTests = () => {
    if (!ref) return;
    cpSync(join(ROOT, 'src', 'utils', '__tests__'), join(cwd, 'src', 'utils', '__tests__'), { recursive: true });
    cpSync(join(ROOT, 'vitest.config.ts'), join(cwd, 'vitest.config.ts'));
    if (!existsSync(join(cwd, FIXTURE))) cpSync(join(ROOT, FIXTURE), join(cwd, FIXTURE));
};

const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
const label = opt('label') ?? ref ?? `v${pkg.version}`;
// Tool name → [package, bin name]. Run the JS entry with node directly: no shell, so paths with
// spaces / non-ASCII (this folder) survive on Windows.
const TOOLS = { vitest: ['vitest', 'vitest'], tsc: ['typescript', 'tsc'], eslint: ['eslint', 'eslint'], vite: ['vite', 'vite'] };
const binEntry = (name) => {
    const [pkgName, binName] = TOOLS[name];
    const dir = join(ROOT, 'node_modules', pkgName);
    const { bin: b } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return join(dir, typeof b === 'string' ? b : b[binName]);
};

const run = (name, cmdArgs, extra = {}) => {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [binEntry(name), ...cmdArgs], {
        cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }, ...extra,
    });
    return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, ms: Date.now() - t0 };
};
const step = (title) => console.log(`\n[metrics] ${title}…`);

// ---------- collectors ----------
const record = {
    label,
    version: pkg.version,
    ref: ref ?? 'working-tree',
    commit: git('rev-parse', '--short', `${ref ?? 'HEAD'}^{commit}`),
    dirty: ref ? false : git('status', '--porcelain').length > 0,
    measuredAt: new Date().toISOString(),
    node: process.version,
};

// Source size
step('source size');
const walk = (dir, exts, acc = []) => {
    if (!existsSync(dir)) return acc;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name === '__tests__' || e.name === '__snapshots__') continue;
            walk(p, exts, acc);
        } else if (exts.includes(extname(e.name))) acc.push(p);
    }
    return acc;
};
const loc = (files) => files.reduce((n, f) => n + readFileSync(f, 'utf8').split('\n').length, 0);
const srcFiles = walk(join(cwd, 'src'), ['.ts', '.tsx']);
const bgFiles = walk(join(cwd, 'public', 'background'), ['.js']);
const testFiles = existsSync(join(cwd, 'src')) ? walkTests(join(cwd, 'src')) : [];
function walkTests(dir, acc = []) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory() && e.name !== 'node_modules') walkTests(p, acc);
        else if (/\.test\.tsx?$/.test(e.name)) acc.push(p);
    }
    return acc;
}
record.source = {
    srcFiles: srcFiles.length,
    srcLoc: loc(srcFiles),
    components: srcFiles.filter((f) => f.includes(`${join('src', 'components')}`) && f.endsWith('.tsx')).length,
    backgroundFiles: bgFiles.length,
    backgroundLoc: loc(bgFiles),
    testFiles: testFiles.length,
    testLoc: loc(testFiles),
};

// Typecheck
if (!skip.has('typecheck')) {
    step('typecheck');
    const r = run('tsc', ['-b', '--pretty', 'false']);
    const errors = (r.out.match(/error TS\d+/g) ?? []).length;
    record.typecheck = r.code !== 0 && errors === 0
        ? { error: r.out.slice(-1000), durationMs: r.ms }
        : { errors, durationMs: r.ms };
}

// Lint
if (!skip.has('lint')) {
    step('lint');
    const r = run('eslint', ['src', '-f', 'json']);
    try {
        const rows = JSON.parse(r.out.slice(r.out.indexOf('[')));
        const rules = {};
        for (const f of rows) for (const m of f.messages) rules[m.ruleId ?? 'parse'] = (rules[m.ruleId ?? 'parse'] ?? 0) + 1;
        record.lint = {
            errors: rows.reduce((n, f) => n + f.errorCount, 0),
            warnings: rows.reduce((n, f) => n + f.warningCount, 0),
            topRules: Object.fromEntries(Object.entries(rules).sort((a, b) => b[1] - a[1]).slice(0, 8)),
            durationMs: r.ms,
        };
    } catch { record.lint = { error: r.out.slice(-1000) }; }
}

// Build + bundle size
if (!skip.has('build')) {
    step('vite build');
    const outDir = join(scratch, 'dist');
    const r = run('vite', ['build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn']);
    if (r.code !== 0 || !existsSync(outDir)) {
        record.build = { ok: false, error: r.out.slice(-2000), durationMs: r.ms };
    } else {
        const files = [];
        const collect = (d) => {
            for (const e of readdirSync(d, { withFileTypes: true })) {
                const p = join(d, e.name);
                if (e.isDirectory()) collect(p); else files.push(p);
            }
        };
        collect(outDir);
        const sum = (list) => list.reduce((n, f) => n + statSync(f).size, 0);
        const gz = (list) => list.reduce((n, f) => n + gzipSync(readFileSync(f), { level: 9 }).length, 0);
        const js = files.filter((f) => f.endsWith('.js'));
        const css = files.filter((f) => f.endsWith('.css'));
        // Strip Vite content hashes so chunks line up across versions.
        const chunkName = (f) => relative(outDir, f).replace(/\\/g, '/').replace(/-[A-Za-z0-9_-]{8}(\.\w+)$/, '$1');
        const chunks = Object.fromEntries(
            js.filter((f) => f.includes(`${'assets'}`))
                .map((f) => [chunkName(f), statSync(f).size])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12),
        );
        record.build = {
            ok: true,
            durationMs: r.ms,
            totalBytes: sum(files),
            files: files.length,
            jsBytes: sum(js),
            jsGzipBytes: gz(js),
            cssBytes: sum(css),
            cssGzipBytes: gz(css),
            assetBytes: sum(files.filter((f) => !f.endsWith('.js') && !f.endsWith('.css') && !f.endsWith('.html'))),
            largestChunks: chunks,
            initialLoad: initialLoadBytes(outDir, gz),
        };
    }
}

/**
 * Bytes a window must fetch before its app code runs: the HTML's own <script src> and
 * <link rel=modulepreload|stylesheet> assets (lazy chunks such as the demo dataset excluded).
 */
function initialLoadBytes(outDir, gz) {
    const out = {};
    for (const [name, html] of [['desktop', 'index.html'], ['background', 'background.html']]) {
        const file = join(outDir, html);
        if (!existsSync(file)) continue;
        const text = readFileSync(file, 'utf8');
        const refs = new Set();
        for (const m of text.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) refs.add(m[1]);
        for (const m of text.matchAll(/<link[^>]*rel="(?:modulepreload|stylesheet)"[^>]*href="([^"]+)"/g)) refs.add(m[1]);
        const local = [...refs].filter((u) => !/^https?:/.test(u)).map((u) => join(outDir, u.replace(/^\.?\//, ''))).filter(existsSync);
        out[name] = {
            files: local.length,
            bytes: local.reduce((n, f) => n + statSync(f).size, 0),
            gzipBytes: gz(local),
            externalScripts: [...refs].filter((u) => /^https?:/.test(u)),
        };
    }
    return out;
}

// Startup benchmark (headless Edge, replayed network) on the build above
if (!skip.has('build') && !skip.has('load') && record.build?.ok) {
    step('startup benchmark');
    const fixture = join(ROOT, 'scripts', 'loadbench', 'fixtures', 'network.json');
    if (!existsSync(fixture)) {
        record.load = { error: 'no network fixture — run: node scripts/loadbench/run.mjs --dist <dist> --record' };
    } else {
        const bench = (scenario) => {
            const jsonOut = join(scratch, `load-${scenario}.json`);
            const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'loadbench', 'run.mjs'), '--dist', join(scratch, 'dist'), '--scenario', scenario, '--runs', opt('runs') ?? '7', '--json', jsonOut], { encoding: 'utf8' });
            return existsSync(jsonOut) ? JSON.parse(readFileSync(jsonOut, 'utf8')) : { error: `${r.stdout}${r.stderr}`.slice(-1500) };
        };
        if (args.includes('--record-load')) {
            // Add this version's own requests to the shared fixture (existing answers are kept).
            for (const scenario of ['demo', 'profile']) {
                spawnSync(process.execPath, [join(ROOT, 'scripts', 'loadbench', 'run.mjs'), '--dist', join(scratch, 'dist'), '--record', '--scenario', scenario], { encoding: 'utf8' });
            }
        }
        // empty = same blank first-run screen in every version → the comparable one.
        record.load = bench('empty');
        // demo = sample profile on first run (v0.0.16+); older versions just render the blank screen.
        record.loadDemo = bench('demo');
        // Pinned profile: new device (cold cache) and reopening the app (warm cache). Needs fixtures/profile.json.
        record.loadProfile = bench('profile');
        record.loadProfileWarm = bench('profile-warm');
    }
}

// Tests + coverage
if (!skip.has('test')) {
    step('tests + coverage');
    injectCurrentTests();
    const jsonOut = join(scratch, 'vitest.json');
    const covDir = join(dirname(jsonOut), 'coverage');
    const r = run('vitest', ['run', '--coverage', `--coverage.reportsDirectory=${covDir}`, '--reporter=json', `--outputFile=${jsonOut}`]);
    let t = null;
    try { t = JSON.parse(readFileSync(jsonOut, 'utf8')); } catch { /* suite crashed */ }
    const failures = [];
    for (const file of t?.testResults ?? []) {
        if (file.status === 'failed' && (!file.assertionResults || file.assertionResults.length === 0)) {
            failures.push({ test: relative(cwd, file.name), message: (file.message ?? '').split('\n')[0] });
        }
        for (const a of file.assertionResults ?? []) {
            if (a.status === 'failed') failures.push({ test: a.fullName, message: (a.failureMessages?.[0] ?? '').split('\n')[0] });
        }
    }
    record.tests = t ? {
        total: t.numTotalTests,
        passed: t.numPassedTests,
        failed: t.numFailedTests,
        skipped: (t.numPendingTests ?? 0) + (t.numTodoTests ?? 0),
        suitesFailed: t.numFailedTestSuites,
        snapshotMismatches: t.snapshot?.unmatched ?? 0,
        durationMs: r.ms,
        failures,
    } : { error: r.out.slice(-2000) };
    const covFile = join(covDir, 'coverage-summary.json');
    if (existsSync(covFile)) {
        const c = JSON.parse(readFileSync(covFile, 'utf8')).total;
        record.coverage = {
            ...Object.fromEntries(['lines', 'statements', 'functions', 'branches'].map((k) => [k, c[k].pct])),
            // Absolute numbers: a % drop can just mean new untested files joined the denominator.
            linesCovered: c.lines.covered,
            linesTotal: c.lines.total,
        };
    }
    if (ref && t) {
        // Full vitest text output for snapshot diffs (what changed in the numbers).
        const txt = run('vitest', ['run', '--reporter=verbose']);
        mkdirSync(DIFF_DIR, { recursive: true });
        writeFileSync(join(DIFF_DIR, `${label}.behavior.txt`), txt.out);
    }
}

{
    try { rmSync(scratch, { recursive: true, force: true }); } catch { /* junctions on Windows: best effort */ }
}

// ---------- persist ----------
mkdirSync(HISTORY_DIR, { recursive: true });
mkdirSync(DIFF_DIR, { recursive: true });
const safe = label.replace(/[^\w.-]/g, '_');
// Skipped steps keep the previous record's values instead of erasing them.
const prevFile = join(HISTORY_DIR, `${safe}.json`);
if (skip.size && existsSync(prevFile)) {
    const old = JSON.parse(readFileSync(prevFile, 'utf8'));
    const SECTIONS = { test: ['tests', 'coverage'], typecheck: ['typecheck'], lint: ['lint'], build: ['build', 'load', 'loadDemo', 'loadProfile', 'loadProfileWarm'], load: ['load', 'loadDemo', 'loadProfile', 'loadProfileWarm'] };
    for (const s of skip) for (const k of SECTIONS[s] ?? []) if (record[k] === undefined && old[k] !== undefined) record[k] = old[k];
}
writeFileSync(join(HISTORY_DIR, `${safe}.json`), `${JSON.stringify(record, null, 2)}\n`);

const semverKey = (r) => (r.version.match(/\d+/g) ?? []).map((n) => n.padStart(5, '0')).join('.') + (r.ref === 'working-tree' ? '~' : '');
const all = readdirSync(HISTORY_DIR).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(HISTORY_DIR, f), 'utf8')))
    .sort((a, b) => semverKey(a).localeCompare(semverKey(b)) || a.measuredAt.localeCompare(b.measuredAt));

// [path, title, unit, higherIsBetter]
const METRICS = [
    ['tests.total', 'Tests', '', true],
    ['tests.failed', 'Failed tests', '', false],
    ['tests.skipped', 'Skipped (not in version)', '', null],
    ['tests.snapshotMismatches', 'Snapshot mismatches', '', false],
    ['coverage.lines', 'Coverage lines', '%', true],
    ['coverage.linesCovered', 'Covered lines', '', true],
    ['coverage.linesTotal', 'utils lines (cov. scope)', '', null],
    ['coverage.branches', 'Coverage branches', '%', true],
    ['coverage.functions', 'Coverage functions', '%', true],
    ['typecheck.errors', 'TS errors', '', false],
    ['lint.errors', 'Lint errors', '', false],
    ['lint.warnings', 'Lint warnings', '', false],
    ['build.jsBytes', 'JS bundle', 'KB', false],
    ['build.jsGzipBytes', 'JS gzip', 'KB', false],
    ['build.cssBytes', 'CSS', 'KB', false],
    ['build.totalBytes', 'dist total', 'KB', false],
    ['build.durationMs', 'Build time', 's', false],
    ['build.initialLoad.desktop.gzipBytes', 'Desktop initial JS+CSS gzip', 'KB', false],
    ['build.initialLoad.background.gzipBytes', 'Background initial gzip', 'KB', false],
    ['load.median.fcp', 'Startup FCP', 'ms', false],
    ['load.median.content90', 'Startup 90% rendered', 'ms', false],
    ['load.median.settled', 'Startup settled', 'ms', false],
    ['load.median.scriptMs', 'Startup script time', 'ms', false],
    ['load.median.longTaskMs', 'Startup long tasks', 'ms', false],
    ['load.median.heapUsedMB', 'Startup JS heap', 'MB', false],
    ['load.median.externalRequests', 'Startup network requests', '', false],
    ['load.median.externalBytes', 'Startup network bytes', 'KB', false],
    ['load.median.domNodes', 'Startup DOM nodes', '', null],
    ['loadDemo.median.content90', 'Demo screen 90% rendered', 'ms', false],
    ['loadDemo.median.settled', 'Demo screen settled', 'ms', false],
    ['loadDemo.median.domNodes', 'Demo screen DOM nodes', '', null],
    ['loadProfile.median.content90', 'Profile (new device) 90% rendered', 'ms', false],
    ['loadProfile.median.settled', 'Profile (new device) settled', 'ms', false],
    ['loadProfile.median.scriptMs', 'Profile (new device) script time', 'ms', false],
    ['loadProfile.median.externalRequests', 'Profile (new device) requests', '', false],
    ['loadProfile.median.externalBytes', 'Profile (new device) network bytes', 'KB', false],
    ['loadProfileWarm.median.content90', 'Profile (reopen) 90% rendered', 'ms', false],
    ['loadProfileWarm.median.settled', 'Profile (reopen) settled', 'ms', false],
    ['loadProfileWarm.median.externalRequests', 'Profile (reopen) requests', '', false],
    ['loadProfileWarm.median.externalBytes', 'Profile (reopen) network bytes', 'KB', false],
    ['loadProfile.profileShownRuns', 'Profile rendered (runs)', '', true],
    ['source.srcLoc', 'src LOC', '', null],
    ['source.backgroundLoc', 'background LOC', '', null],
    ['source.components', 'Components', '', null],
    ['source.testLoc', 'Test LOC', '', true],
];
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const fmt = (v, unit) => {
    if (v == null) return '–';
    if (unit === 'KB') return `${(v / 1024).toFixed(1)}`;
    if (unit === 's') return `${(v / 1000).toFixed(1)}`;
    if (unit === 'ms') return `${Math.round(v)}`;
    if (unit === 'MB') return `${v.toFixed(1)}`;
    return `${typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : v}`;
};
const unitLabel = (u) => (u ? ` (${u})` : '');

// HISTORY.md
// Metrics as rows, versions as columns (stays readable as metrics grow).
const head = ['Metric', ...all.map((r) => `${r.label}${r.dirty ? '*' : ''}`)];
const lines = [
    '# Version metrics history',
    '',
    'Generated by `npm run metrics` — do not edit by hand. Raw data: `metrics/history/*.json`.',
    '',
    `| ${head.join(' | ')} |`,
    `| --- | ${all.map(() => '---:').join(' | ')} |`,
    `| Commit | ${all.map((r) => r.commit).join(' | ')} |`,
    ...METRICS.map(([p, t, u]) => `| ${t}${unitLabel(u)} | ${all.map((r) => fmt(get(r, p), u)).join(' | ')} |`),
    '',
    '`*` = measured from a working tree with uncommitted changes. Old tags are measured with the *current* test suite,',
    'so their test/coverage numbers show how that code fares against today\'s expectations.',
    '',
];
writeFileSync(join(OUT_DIR, 'HISTORY.md'), lines.join('\n'));

// Diff vs previous
const idx = all.findIndex((r) => r.label === record.label);
const prev = compareLabel ? all.find((r) => r.label === compareLabel) : all[idx - 1];
const diffLines = [`# ${record.label} vs ${prev ? prev.label : '(none)'}`, '', `Measured ${record.measuredAt} · commit ${record.commit}${record.dirty ? ' (dirty)' : ''}`, ''];
if (prev) {
    diffLines.push('| Metric | Before | After | Δ | |', '| --- | ---: | ---: | ---: | --- |');
    for (const [p, t, u, better] of METRICS) {
        const a = get(prev, p);
        const b = get(record, p);
        if (a == null && b == null) continue;
        let delta = '–';
        let mark = '';
        if (typeof a === 'number' && typeof b === 'number') {
            const d = b - a;
            const pct = a !== 0 ? ` (${d >= 0 ? '+' : ''}${((d / a) * 100).toFixed(1)}%)` : '';
            delta = d === 0 ? '0' : `${d > 0 ? '+' : ''}${fmt(d, u)}${pct}`;
            if (d !== 0 && better !== null) mark = (d > 0) === better ? '✅' : '⚠️';
        }
        diffLines.push(`| ${t}${unitLabel(u)} | ${fmt(a, u)} | ${fmt(b, u)} | ${delta} | ${mark} |`);
    }
    const pc = prev.build?.largestChunks ?? {};
    const cc = record.build?.largestChunks ?? {};
    const names = [...new Set([...Object.keys(pc), ...Object.keys(cc)])];
    const changed = names.map((n) => [n, pc[n], cc[n]]).filter(([, a, b]) => a !== b);
    if (changed.length) {
        diffLines.push('', '## Chunk sizes (KB)', '', '| Chunk | Before | After | Δ |', '| --- | ---: | ---: | ---: |');
        for (const [n, a, b] of changed) diffLines.push(`| ${n} | ${fmt(a, 'KB')} | ${fmt(b, 'KB')} | ${a != null && b != null ? fmt(b - a, 'KB') : 'new/removed'} |`);
    }
}
if (record.tests?.failures?.length) {
    diffLines.push('', '## Failing tests in this record', '');
    for (const f of record.tests.failures) diffLines.push(`- **${f.test}** — ${f.message.slice(0, 200)}`);
    if (ref) diffLines.push('', `Full output (snapshot diffs): \`metrics/diffs/${safe}.behavior.txt\``);
}
writeFileSync(join(DIFF_DIR, `${safe}.md`), `${diffLines.join('\n')}\n`);

console.log(`\n[metrics] saved metrics/history/${safe}.json, metrics/diffs/${safe}.md, metrics/HISTORY.md\n`);
console.log(diffLines.join('\n'));

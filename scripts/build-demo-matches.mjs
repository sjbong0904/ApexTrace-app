/**
 * Builds the first-run demo dataset (src/assets/demo/demoMatches.json).
 *
 * Picks real, detail-rich matches from Supabase and anonymizes them: every player name
 * (local player, teammates, enemies in the combat log) and every uid is replaced with an
 * invented one, so no real account is shown. RP is synthesized for the ranked games.
 *
 * Run:  node scripts/build-demo-matches.mjs
 * Needs SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) in .env or trace-proxy-server/.env.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'assets', 'demo', 'demoMatches.json');

const env = {};
for (const file of ['.env', 'trace-proxy-server/.env']) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const i = line.indexOf('=');
        if (i <= 0 || line.trim().startsWith('#')) continue;
        env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
}
const supabase = createClient(
    env.SUPABASE_URL || 'https://ureuzkxyyozzzluzawwr.supabase.co',
    env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
);

// The proxy's row → match mapper lives in a CommonJS package; load a copy as ESM.
const libDir = mkdtempSync(join(tmpdir(), 'demo-lib-'));
for (const f of ['matchHistory.js', 'weaponCombat.js']) {
    copyFileSync(join(ROOT, 'trace-proxy-server', 'lib', f), join(libDir, f));
}
writeFileSync(join(libDir, 'package.json'), '{"type":"module"}');
const { matchFromRow } = await import(pathToFileURL(join(libDir, 'matchHistory.js')).href);

/**
 * Display order, newest first (the app re-times them in this order). The first block has
 * ring rounds (premium replay with the shrinking ring); a strong game leads the list.
 */
const MATCH_IDS = [
    '1794663009418', '1794669975898', '1794669588368', '1794668802250', '1794667564500', '1794666990416',
    '1794666006976', '1794665376648', '1794664269095', '1794662218947',
    '1794661918942', '1794661371277', '1794660314566',
    '1794595838918', '1794593659521', '1794590323400', '1794586573115', '1794078391798',
    '1794059688941', '1793981281384', '1793448446125', '1790429369450', '1790422893962',
];
/** Shown as unranked trios so the Trio tab has games too. */
const AS_TRIO = new Set(['1794590323400', '1790429369450', '1790422893962']);

const DEMO_PLAYER = 'Ghost_Kairo';
const PARTNER = { uid: '9004417260381', name: 'Mint_Rabbit' };
/** Another source account showing up as a teammate. */
const PARTNER2 = { uid: '9007731905526', name: 'Sora_Byte' };

const PREFIX = [
    'Lumen', 'Haze', 'Oni', 'Pixel', 'Byte', 'Crimson', 'Velvet', 'Tofu', 'Arc', 'Kestrel', 'Mochi', 'Quartz',
    'Sable', 'Nimbus', 'Ember', 'Glitch', 'Rogue', 'Static', 'Ivory', 'Lucky', 'Drizzle', 'Phantom', 'Cobalt',
    'Neon', 'Frost', 'Riptide', 'Volt', 'Cinder', 'Maple', 'Orbit', 'Shade', 'Turbo', 'Willow', 'Zenith',
    'Pocket', 'Hollow', 'Spark', 'Rust', 'Tango', 'Lazy', 'Echo', 'Sunny', 'Marble', 'Noodle', 'Plasma',
    'Indigo', 'Gale', 'Copper', 'Basil', 'Kiwi', 'Onyx', 'Sakura', 'Grim', 'Polar', 'Silent', 'Moon',
];
const SUFFIX = [
    'Fox', 'Drift', 'Runner', 'Kumo', 'Moth', 'Wolf', 'Kite', 'Raid', 'Sniper', 'Light', 'Blaze', 'Rin',
    'Fang', 'Ash', 'Hana', 'Pebble', 'Yuzu', 'Hawk', 'Jeon', 'Ume', 'Max', 'Gecko', 'Dumpling', 'Sora',
    'Loop', 'Recon', 'Pip', 'Gimbap', 'Ray', 'Titan', 'Bean', 'Iris', 'Comet', 'Owl', 'Raptor', 'Taro',
    'Vex', 'Jin', 'Ace', 'Moss', 'Pudding', 'Nyx', 'Strike', 'Leaf', 'Bolt', 'Peach', 'Dash', 'Byul',
];
const SEPARATORS = ['_', '', '_', '.'];

const names = new Map(); // real name → fake
const uids = new Map(); // real uid → fake
const usedNames = new Set([DEMO_PLAYER, PARTNER.name, PARTNER2.name]);
let seed = 20261116;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (list) => list[Math.floor(rand() * list.length)];
const fakeName = (real) => {
    if (real == null || real === '' || real === 'Unknown') return real;
    if (!names.has(real)) {
        let candidate;
        do {
            candidate = `${pick(PREFIX)}${pick(SEPARATORS)}${pick(SUFFIX)}`;
            if (rand() < 0.25) candidate += String(Math.floor(rand() * 90) + 10);
        } while (usedNames.has(candidate));
        usedNames.add(candidate);
        names.set(real, candidate);
    }
    return names.get(real);
};
const fakeUid = (real) => {
    if (!real) return real;
    // UID-shaped but outside the real range (real platform UIDs start with 100…).
    if (!uids.has(String(real))) uids.set(String(real), `9${String(Math.floor(rand() * 1e12)).padStart(12, '0')}`);
    return uids.get(String(real));
};

const { data: rows, error } = await supabase.from('matches').select('*').in('match_id', MATCH_IDS);
if (error) throw error;
const byId = new Map(rows.map((r) => [r.match_id, r]));
const missing = MATCH_IDS.filter((id) => !byId.has(id));
if (missing.length) throw new Error(`Missing matches: ${missing.join(', ')}`);

// Owners of the source matches all become the demo player; the most frequent real
// teammate becomes one recurring partner (gives the Teammates tab something to show).
const ownerUids = new Set(rows.map((r) => String(r.uid)));
const tmCount = new Map();
for (const r of rows) {
    for (const tm of matchFromRow(r, { includeDetail: true }).teamStats ?? []) {
        if (tm?.uid && !ownerUids.has(String(tm.uid))) tmCount.set(String(tm.uid), (tmCount.get(String(tm.uid)) ?? 0) + 1);
    }
}
const partnerReal = [...tmCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
/** Every name a source account went by → that account's uid. */
const ownerNameToUid = new Map();
for (const r of rows) {
    const m = matchFromRow(r, { includeDetail: true });
    for (const n of [r.player_name, m.playerName]) if (n) ownerNameToUid.set(n, String(r.uid));
}
for (const r of rows) {
    for (const tm of matchFromRow(r, { includeDetail: true }).teamStats ?? []) {
        if (tm?.uid && ownerUids.has(String(tm.uid)) && tm.name) ownerNameToUid.set(tm.name, String(tm.uid));
    }
}

const round1 = (n) => (typeof n === 'number' ? Math.round(n * 10) / 10 : n);

/** Simplified ranked scoring: placement + kill points − entry cost. */
const PLACE_RP = [125, 95, 70, 55, 45, 30, 20, 20, 10, 10, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0];
const ENTRY_COST = 45;

const chronological = [...MATCH_IDS].reverse();
let rankScore = 9100;
const out = [];
for (const id of chronological) {
    const row = byId.get(id);
    const m = matchFromRow(row, { includeDetail: true });
    const selfUid = String(row.uid);
    const mapName = (real) => {
        const owner = ownerNameToUid.get(real);
        if (owner) return owner === selfUid ? DEMO_PLAYER : PARTNER2.name;
        return fakeName(real);
    };

    const teamStats = (m.teamStats ?? []).map((tm) => {
        const tmUid = String(tm.uid);
        if (partnerReal && tmUid === partnerReal) {
            if (tm.name) names.set(tm.name, PARTNER.name);
            return { uid: PARTNER.uid, name: PARTNER.name, legend: tm.legend, kills: tm.kills ?? 0 };
        }
        if (ownerUids.has(tmUid)) {
            return { uid: PARTNER2.uid, name: PARTNER2.name, legend: tm.legend, kills: tm.kills ?? 0 };
        }
        return { uid: fakeUid(tm.uid), name: fakeName(tm.name), legend: tm.legend, kills: tm.kills ?? 0 };
    });
    const teammateKills = Object.fromEntries(
        Object.entries(m.teammateKills ?? {}).map(([k, v]) => [names.get(k) ?? mapName(k), v]),
    );

    const events = (m.events ?? []).map((e) => {
        const { raw: _raw, ...rest } = e;
        return { ...rest, attacker: mapName(e.attacker), victim: mapName(e.victim) };
    });

    const trio = AS_TRIO.has(id);
    let rank = { name: 'Platinum', score: rankScore, startScore: rankScore };
    let rpChange = null;
    if (!trio) {
        const place = Math.max(1, Number(m.placement) || 20);
        const kp = Math.min(m.kills ?? 0, 6) * 12 + Math.min(m.assists ?? 0, 4) * 6;
        rpChange = (PLACE_RP[place - 1] ?? 0) + kp - ENTRY_COST;
        const start = rankScore;
        rankScore = Math.max(8000, rankScore + rpChange);
        rank = { name: 'Platinum', score: rankScore, startScore: start };
    }

    out.push({
        ...m,
        matchId: `demo_${id}`,
        platformId: 'demo',
        playerName: DEMO_PLAYER,
        mode: trio ? 'Trio' : 'Ranked',
        rank,
        rankScore: trio ? null : rankScore,
        rpChange,
        rpProcessed: !trio,
        missingSignals: [],
        path: (m.path ?? []).map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })),
        ringRounds: (m.ringRounds ?? []).map((r) => ({
            ...r,
            activeSamples: (r.activeSamples ?? []).map((s) => ({ ...s, x: round1(s.x), y: round1(s.y), r: round1(s.r) })),
        })),
        events,
        teamStats,
        teammateKills,
    });
}
out.reverse(); // newest first

// Leak check: no real name or uid may survive anywhere in the payload.
const json = JSON.stringify({ player: DEMO_PLAYER, rankScore, matches: out });
const realNames = [...names.keys(), ...ownerNameToUid.keys()].filter((n) => n && n.length >= 3 && n !== 'Unknown');
const realUids = [...uids.keys(), ...ownerUids, partnerReal].filter(Boolean);
const leaks = [...realNames, ...realUids].filter((s) => json.includes(`"${s}"`));
if (leaks.length) throw new Error(`Real identifiers left in demo data: ${leaks.slice(0, 5).join(', ')}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, json);
console.log(`Wrote ${out.length} matches (${(json.length / 1024).toFixed(0)} KB) → ${OUT}`);
console.log(`Final RP ${rankScore}; ${names.size} names, ${uids.size} uids remapped.`);

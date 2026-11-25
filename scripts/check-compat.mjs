/**
 * Shared-backend compatibility check against the store build still in users' hands.
 *
 * Supabase (languages table, schema) and the proxy are shared by every client version, so a
 * change made for the next release can break the live one. This checks what can be checked
 * from the repo:
 *   1. Language seeds: every key the base build has must still exist, with the same
 *      {{interpolation}} variables. Changed values are listed (they change the live app's text).
 *   2. Migrations added since the base: flags statements that remove or rename things
 *      (drop / rename / alter type / set not null / revoke) — those need the live client checked.
 *
 * Usage:
 *   node scripts/check-compat.mjs                 # base = c68b2ce (v0.0.15 store-QA build)
 *   node scripts/check-compat.mjs --ref v1.0.0    # another base once a newer build is live
 * Exit code 1 when a language key is missing or its variables changed.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Live store build. Update when a newer version is the one users run. */
const DEFAULT_BASE = 'c68b2ce';

const args = process.argv.slice(2);
const refIdx = args.indexOf('--ref');
const base = refIdx >= 0 ? args[refIdx + 1] : DEFAULT_BASE;

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const flat = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]],
    );
const strings = (json) => new Map(flat(json.strings ?? json));
const vars = (s) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((v) => v.replace(/\s/g, '')).sort().join(',');

let failed = false;
console.log(`Compatibility base: ${base}\n`);

// 1) Language seeds
const SEED_DIR = 'scripts/locale-seeds';
console.log('## Language seeds');
for (const file of readdirSync(SEED_DIR).filter((f) => f.endsWith('.json')).sort()) {
    let oldJson;
    try {
        oldJson = JSON.parse(git('show', `${base}:${SEED_DIR}/${file}`));
    } catch {
        console.log(`- ${file}: new language (not in base)`);
        continue;
    }
    const before = strings(oldJson);
    const after = strings(JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8')));
    const missing = [...before.keys()].filter((k) => !after.has(k));
    const varChanged = [...before.keys()].filter((k) => after.has(k) && vars(before.get(k)) !== vars(after.get(k)));
    const textChanged = [...before.keys()].filter((k) => after.has(k) && before.get(k) !== after.get(k));
    const status = missing.length || varChanged.length ? 'FAIL' : 'ok';
    if (status === 'FAIL') failed = true;
    console.log(`- ${file}: ${status} — base ${before.size} keys, now ${after.size}, missing ${missing.length}, variables changed ${varChanged.length}, text changed ${textChanged.length}`);
    for (const k of missing) console.log(`    missing: ${k}`);
    for (const k of varChanged) console.log(`    variables: ${k} (${vars(before.get(k))} → ${vars(after.get(k))})`);
    for (const k of textChanged) console.log(`    text: ${k}: "${before.get(k)}" → "${after.get(k)}"`);
}

// 2) New migrations
console.log('\n## Migrations added since base');
const MIG_DIR = 'supabase/migrations';
const baseMigrations = new Set(
    git('ls-tree', '--name-only', `${base}:${MIG_DIR}`).split('\n').filter(Boolean),
);
const RISKY = /\b(drop\s+(table|column|function|policy|view|index)|rename\s+(column|to)|alter\s+column\s+\S+\s+(type|set\s+not\s+null)|revoke\b)/gi;
const added = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql') && !baseMigrations.has(f)).sort();
if (!added.length) console.log('- none');
for (const file of added) {
    const sql = readFileSync(join(MIG_DIR, file), 'utf8').replace(/--.*$/gm, '');
    const hits = [...new Set((sql.match(RISKY) ?? []).map((h) => h.toLowerCase().replace(/\s+/g, ' ')))];
    console.log(`- ${file}: ${hits.length ? `CHECK live client (${hits.join(', ')})` : 'additive'}`);
}

console.log(failed ? '\nResult: FAIL — the live build would lose strings.' : '\nResult: ok');
process.exit(failed ? 1 : 0);

/**
 * Seed public.weapons from WEAPON_FALLBACK_ROWS.
 * Run: npm run seed:weapons
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { WEAPON_FALLBACK_ROWS } from '../src/utils/weaponFallbackRows.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

function loadEnvFiles(...paths: string[]) {
    for (const path of paths) {
        if (!existsSync(path)) continue;
        for (const line of readFileSync(path, 'utf-8').split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq === -1) continue;
            const key = trimmed.slice(0, eq).trim();
            const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
            if (process.env[key] == null || process.env[key] === '') {
                process.env[key] = value;
            }
        }
    }
}

loadEnvFiles(join(ROOT_DIR, '.env'), join(ROOT_DIR, 'trace-proxy-server', '.env'));

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ureuzkxyyozzzluzawwr.supabase.co';
const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const rows = WEAPON_FALLBACK_ROWS.map((w, i) => ({
    id: w.id,
    base_id: w.baseId ?? null,
    variant: w.variant,
    category: w.category,
    fire_modes: w.FireMods,
    ammo_types: w.ammoType,
    image_url: w.image,
    stats: w.stats,
    attachments: w.attachments,
    hopup: w.hopup ?? null,
    care_hopup: w.care_hopup ?? null,
    hopup_point: w.hopup_point ?? null,
    name_key: w.nameKey,
    desc_key: w.descKey,
    schema_version: 1,
    is_active: true,
    sort_order: i,
    updated_at: new Date().toISOString(),
}));

const { error } = await supabase.from('weapons').upsert(rows, { onConflict: 'id' });
if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
}
console.log(`Seeded ${rows.length} weapons.`);

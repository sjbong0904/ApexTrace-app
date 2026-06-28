/**
 * Seed public.languages from scripts/locale-seeds/*.json
 * Run: npm run seed:languages
 * Requires SUPABASE_SERVICE_ROLE_KEY or temporary grant on upsert_language_pack.
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SEEDS_DIR = join(__dirname, 'locale-seeds');

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

loadEnvFiles(
    join(ROOT_DIR, '.env'),
    join(ROOT_DIR, 'trace-proxy-server', '.env'),
);

const SUPABASE_URL =
    process.env.SUPABASE_URL ?? 'https://ureuzkxyyozzzluzawwr.supabase.co';
const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error(
        'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY. Copy .env.example to .env and fill in values.',
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function loadSeed(lang: string): Record<string, unknown> {
    const path = join(SEEDS_DIR, `${lang}.json`);
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

const LANGUAGE_PACKS: { lang: string; display_name: string; is_default?: boolean }[] = [
    { lang: 'en', display_name: 'English', is_default: true },
    { lang: 'ja', display_name: '日本語' },
    { lang: 'ko', display_name: '한국어' },
    { lang: 'zh-CN', display_name: '简体中文（中国大陆）' },
    { lang: 'zh-TW', display_name: '繁體中文（台灣）' },
    { lang: 'fr', display_name: 'Français' },
    { lang: 'es-ES', display_name: 'Español (España)' },
    { lang: 'es-MX', display_name: 'Español (México)' },
    { lang: 'pt-BR', display_name: 'Português (Brasil)' },
    { lang: 'pt-PT', display_name: 'Português (Portugal)' },
];

const LEGACY_LANGS = ['zh', 'zh-tw', 'es', 'es-mx', 'pt', 'pt-pt'];

async function main() {
    const packs = LANGUAGE_PACKS.map((meta) => ({
        ...meta,
        strings: loadSeed(meta.lang),
        version: 5,
        is_default: meta.is_default ?? false,
    }));

    for (const pack of packs) {
        const { error } = await supabase.rpc('upsert_language_pack', {
            p_lang: pack.lang,
            p_display_name: pack.display_name,
            p_strings: pack.strings,
            p_is_default: pack.is_default,
            p_version: pack.version,
        });

        if (error) {
            console.error(`Failed to upsert ${pack.lang}:`, error.message);
            process.exit(1);
        }
        console.log(`✅ languages.${pack.lang} (${Object.keys(pack.strings).length} top-level keys)`);
    }

    const { error: deactivateError } = await supabase
        .from('languages')
        .update({ is_active: false })
        .in('lang', LEGACY_LANGS);

    if (deactivateError) {
        console.warn('Could not deactivate legacy lang codes:', deactivateError.message);
    } else {
        console.log(`✅ Deactivated legacy codes: ${LEGACY_LANGS.join(', ')}`);
    }
}

main();

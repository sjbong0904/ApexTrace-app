import i18n from 'i18next';
import { supabase } from './supabase';

const CACHE_KEY = 'languages_cache_v1';

type LanguageRow = { lang: string; strings: Record<string, unknown>; version?: number };

function applyBundles(rows: LanguageRow[]) {
    for (const row of rows) {
        if (!row.strings || typeof row.strings !== 'object') continue;
        i18n.addResourceBundle(row.lang, 'translation', row.strings, true, true);
        if (row.version != null) {
            localStorage.setItem(`languages_version_${row.lang}`, String(row.version));
        }
    }
}

function readCache(): LanguageRow[] | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LanguageRow[];
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
        return null;
    }
}

/** Supabase languages 테이블에서 번역 로드 (실패 시 localStorage 캐시) */
export async function loadRemoteLanguages(): Promise<void> {
    let rows: LanguageRow[] | null = null;

    try {
        const { data, error } = await supabase
            .from('languages')
            .select('lang, strings, version')
            .eq('is_active', true);

        if (!error && data?.length) {
            rows = data as LanguageRow[];
            localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
        }
    } catch (e) {
        console.warn('[i18n] Remote languages fetch failed:', e);
    }

    if (!rows?.length) {
        rows = readCache();
        if (rows?.length) {
            console.warn('[i18n] Using cached translations (offline or DB unavailable)');
        }
    }

    if (!rows?.length) {
        throw new Error('[i18n] No translations available. Check Supabase languages table or network.');
    }

    applyBundles(rows);
    await i18n.changeLanguage(i18n.language);
}

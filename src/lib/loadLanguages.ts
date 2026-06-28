import i18n from 'i18next';
import { supabase } from './supabase';

const CACHE_KEY = 'languages_cache_v3';

type LanguageRow = { lang: string; strings: Record<string, unknown>; version?: number };
type LanguageVersionRow = { lang: string; version: number | null };

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

async function fetchRemoteVersions(): Promise<LanguageVersionRow[] | null> {
    try {
        const { data, error } = await supabase
            .from('languages')
            .select('lang, version')
            .eq('is_active', true);

        if (error || !data?.length) return null;
        return data as LanguageVersionRow[];
    } catch {
        return null;
    }
}

function isCacheFresh(cached: LanguageRow[], versions: LanguageVersionRow[]): boolean {
    if (cached.length !== versions.length) return false;

    return versions.every((remote) => {
        const cachedRow = cached.find((row) => row.lang === remote.lang);
        if (!cachedRow?.strings) return false;
        const cachedVersion = cachedRow.version ?? null;
        if (cachedVersion == null || remote.version == null) return false;
        return cachedVersion === remote.version;
    });
}

async function fetchFullLanguageRows(): Promise<LanguageRow[] | null> {
    try {
        const { data, error } = await supabase
            .from('languages')
            .select('lang, strings, version')
            .eq('is_active', true);

        if (error || !data?.length) return null;
        return data as LanguageRow[];
    } catch {
        return null;
    }
}

/** Supabase languages 테이블에서 번역 로드 (버전 동일 시 캐시만 사용) */
export async function loadRemoteLanguages(): Promise<void> {
    const cached = readCache();
    const remoteVersions = await fetchRemoteVersions();

    if (cached && remoteVersions && isCacheFresh(cached, remoteVersions)) {
        applyBundles(cached);
        await i18n.changeLanguage(i18n.language);
        return;
    }

    let rows: LanguageRow[] | null = await fetchFullLanguageRows();
    if (rows?.length) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
    }

    if (!rows?.length) {
        rows = cached;
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

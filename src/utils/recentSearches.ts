export type RecentSearchProfile = {
    uid: string;
    name: string;
    rankName: string;
    rankScore: number;
    level: number;
    prestige: number;
    legend: string;
    searchedAt: number;
};

export type RecentSearchScope = 'app' | 'web';

const STORAGE_KEYS: Record<RecentSearchScope, string> = {
    app: 'apex_recent_searches_app',
    web: 'apex_recent_searches_web',
};

/** Older keys — migrated once into the matching scope. */
const LEGACY_KEYS: Partial<Record<RecentSearchScope, string[]>> = {
    web: ['apextrace_web_recent_searches'],
};

const MAX_RECENT = 5;

const isValidEntry = (value: unknown): value is RecentSearchProfile => {
    if (!value || typeof value !== 'object') return false;
    const row = value as Record<string, unknown>;
    return typeof row.uid === 'string'
        && row.uid.length > 0
        && typeof row.name === 'string';
};

const parseEntries = (raw: string | null): RecentSearchProfile[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isValidEntry).slice(0, MAX_RECENT);
    } catch {
        return [];
    }
};

const persist = (scope: RecentSearchScope, entries: RecentSearchProfile[]) => {
    try {
        localStorage.setItem(STORAGE_KEYS[scope], JSON.stringify(entries.slice(0, MAX_RECENT)));
    } catch {
        // ignore quota / private mode
    }
};

export const loadRecentSearches = (scope: RecentSearchScope): RecentSearchProfile[] => {
    try {
        const current = parseEntries(localStorage.getItem(STORAGE_KEYS[scope]));
        if (current.length > 0) return current;

        for (const legacyKey of LEGACY_KEYS[scope] ?? []) {
            const legacy = parseEntries(localStorage.getItem(legacyKey));
            if (legacy.length === 0) continue;
            persist(scope, legacy);
            try {
                localStorage.removeItem(legacyKey);
            } catch {
                // ignore
            }
            return legacy;
        }
        return [];
    } catch {
        return [];
    }
};

export const pushRecentSearch = (
    scope: RecentSearchScope,
    profile: Omit<RecentSearchProfile, 'searchedAt'>,
): RecentSearchProfile[] => {
    if (!profile.uid || !profile.name) return loadRecentSearches(scope);

    const next: RecentSearchProfile = {
        uid: String(profile.uid),
        name: profile.name,
        rankName: profile.rankName || 'Unranked',
        rankScore: Number(profile.rankScore) || 0,
        level: Number(profile.level) || 0,
        prestige: Number(profile.prestige) || 0,
        legend: profile.legend || 'unknown',
        searchedAt: Date.now(),
    };
    const prev = loadRecentSearches(scope).filter((entry) => entry.uid !== next.uid);
    const merged = [next, ...prev].slice(0, MAX_RECENT);
    persist(scope, merged);
    return merged;
};

export const removeRecentSearch = (scope: RecentSearchScope, uid: string): RecentSearchProfile[] => {
    const next = loadRecentSearches(scope).filter((entry) => entry.uid !== uid);
    persist(scope, next);
    return next;
};

export const clearRecentSearches = (scope: RecentSearchScope): RecentSearchProfile[] => {
    persist(scope, []);
    return [];
};

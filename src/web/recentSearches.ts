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

const STORAGE_KEY = 'apextrace_web_recent_searches';
const MAX_RECENT = 5;

const isValidEntry = (value: unknown): value is RecentSearchProfile => {
    if (!value || typeof value !== 'object') return false;
    const row = value as Record<string, unknown>;
    return typeof row.uid === 'string'
        && row.uid.length > 0
        && typeof row.name === 'string';
};

export const loadRecentSearches = (): RecentSearchProfile[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isValidEntry).slice(0, MAX_RECENT);
    } catch {
        return [];
    }
};

const persist = (entries: RecentSearchProfile[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
    } catch {
        // ignore quota / private mode
    }
};

export const pushRecentSearch = (profile: Omit<RecentSearchProfile, 'searchedAt'>): RecentSearchProfile[] => {
    const next: RecentSearchProfile = {
        uid: profile.uid,
        name: profile.name,
        rankName: profile.rankName || 'Unranked',
        rankScore: Number(profile.rankScore) || 0,
        level: Number(profile.level) || 0,
        prestige: Number(profile.prestige) || 0,
        legend: profile.legend || 'unknown',
        searchedAt: Date.now(),
    };
    const prev = loadRecentSearches().filter((entry) => entry.uid !== next.uid);
    const merged = [next, ...prev].slice(0, MAX_RECENT);
    persist(merged);
    return merged;
};

export const removeRecentSearch = (uid: string): RecentSearchProfile[] => {
    const next = loadRecentSearches().filter((entry) => entry.uid !== uid);
    persist(next);
    return next;
};

export const clearRecentSearches = (): RecentSearchProfile[] => {
    persist([]);
    return [];
};

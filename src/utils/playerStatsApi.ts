export type StatisticsMode = 'ALL' | 'RANKED' | 'TRIO' | 'DUO';

export interface PlayerStatsResponse {
    uid: string;
    season_id: number;
    mode: StatisticsMode;
    match_count: number;
    schema_version: number;
    updated_at: string | null;
    payload: {
        matches?: unknown[];
    };
}

const statsCache = new Map<string, PlayerStatsResponse>();

const cacheKey = (uid: string, seasonId: number, mode: StatisticsMode) =>
    `${uid}:${seasonId}:${mode}`;

export function invalidatePlayerStatsCache(uid?: string | null): void {
    if (!uid) {
        statsCache.clear();
        return;
    }

    const prefix = `${uid}:`;
    for (const key of statsCache.keys()) {
        if (key.startsWith(prefix)) statsCache.delete(key);
    }
}

const getProxyBaseUrl = () => {
    const bg = window.overwolf?.windows?.getMainWindow() as { PROXY_BASE_URL?: string } | undefined;
    return bg?.PROXY_BASE_URL ?? 'https://trace-proxy-server.vercel.app/api';
};

async function requestPlayerStats(
    uid: string,
    seasonId: number,
    mode: StatisticsMode,
): Promise<PlayerStatsResponse | null> {
    const bg = window.overwolf?.windows?.getMainWindow() as {
        apexData?: { fetchPlayerStats?: (u: string, s: number, m: StatisticsMode) => Promise<PlayerStatsResponse | null> };
        APIService?: { getPlayerStats?: (u: string, s: number, m: StatisticsMode) => Promise<PlayerStatsResponse | null> };
    } | undefined;

    if (bg?.apexData?.fetchPlayerStats) {
        return bg.apexData.fetchPlayerStats(uid, seasonId, mode);
    }

    if (bg?.APIService?.getPlayerStats) {
        return bg.APIService.getPlayerStats(uid, seasonId, mode);
    }

    const url = `${getProxyBaseUrl()}/player-stats?uid=${encodeURIComponent(uid)}&season_id=${encodeURIComponent(seasonId)}&mode=${encodeURIComponent(mode)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json() as PlayerStatsResponse;
    } catch {
        return null;
    }
}

export async function fetchPlayerStats(
    uid: string,
    seasonId: number,
    mode: StatisticsMode = 'ALL',
): Promise<PlayerStatsResponse | null> {
    const key = cacheKey(uid, seasonId, mode);
    const cached = statsCache.get(key);
    if (cached) return cached;

    const result = await requestPlayerStats(uid, seasonId, mode);
    if (result) statsCache.set(key, result);
    return result;
}

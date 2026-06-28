import { MAP_DATA as LOCAL_MAP_DATA } from './constants';

export const getRankColor = (rank: number | string) => {
    if (rank === 1 || rank === '1' || rank === '#1') return 'var(--color-rank-first)';
    const r = parseInt(String(rank).replace('#', ''));
    if (!isNaN(r) && r <= 5) return 'var(--color-rank-top5)';
    return 'var(--color-rank-other)';
};

export type RankTierKey =
    | 'bronze'
    | 'silver'
    | 'gold'
    | 'platinum'
    | 'diamond'
    | 'master'
    | 'predator'
    | 'unranked'
    | 'unknown';

/** Apex ranked tier from API rank name (division suffix ignored). */
export const getRankTierKey = (rankName: string | null | undefined): RankTierKey => {
    const tier = String(rankName ?? '').toLowerCase();
    if (tier.includes('predator') || tier.includes('apex')) return 'predator';
    if (tier.includes('master')) return 'master';
    if (tier.includes('diamond')) return 'diamond';
    if (tier.includes('platinum')) return 'platinum';
    if (tier.includes('gold')) return 'gold';
    if (tier.includes('silver')) return 'silver';
    if (tier.includes('bronze')) return 'bronze';
    if (tier.includes('unranked')) return 'unranked';
    return 'unknown';
};

/** Brand-adjacent colors aligned with in-app rank UI (PlayerSelectionModal). */
export const getRankTierColor = (rankName: string | null | undefined): string => {
    switch (getRankTierKey(rankName)) {
        case 'bronze': return '#cd7f32';
        case 'silver': return '#bdc3c7';
        case 'gold': return '#f1c40f';
        case 'platinum': return '#55efc4';
        case 'diamond': return '#74b9ff';
        case 'master': return '#a29bfe';
        case 'predator': return '#ff7675';
        case 'unranked': return 'var(--color-text-muted)';
        default: return 'var(--color-mode-ranked)';
    }
};

const RANK_ROMAN_SUFFIX = /\s+(IV|III|II|I)$/i;

export const getRankRoman = (div: number | null | undefined): string => {
    if (!div) return '';
    return ['', 'I', 'II', 'III', 'IV'][div] ?? '';
};

export const stripRankRomanSuffix = (rankName: string): string =>
    rankName.trim().replace(RANK_ROMAN_SUFFIX, '').trim();

export const stripAllRankRomanSuffixes = (rankName: string): string => {
    let result = rankName.trim();
    let prev = '';
    while (prev !== result) {
        prev = result;
        result = stripRankRomanSuffix(result);
    }
    return result;
};

/** Normalize tier + division; prevents duplicate suffixes like "Diamond II II". */
export const formatFullRankName = (
    rankName: string | null | undefined,
    rankDiv?: number | null,
): string => {
    const trimmed = (rankName ?? 'Unranked').trim() || 'Unranked';
    if (['Unranked', 'Master', 'Apex Predator', '-', 'Waiting...'].includes(trimmed)) {
        return trimmed;
    }

    const roman = getRankRoman(rankDiv);
    if (!roman) {
        return trimmed.replace(/\s+(IV|III|II|I)(\s+\1)+$/i, ' $1');
    }

    const base = stripAllRankRomanSuffixes(trimmed);
    if (['Master', 'Apex Predator'].includes(base)) return base;
    return `${base} ${roman}`;
};

export const formatMatchTime = (ms: number, style: 'digital' | 'text' = 'digital') => {
    if (ms < 0) ms = 0;
    
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;

    if (style === 'digital') {
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    
    if (style === 'text') {
        return `${m}m ${s}s`;
    }
    
    return "";
};

/** Relative duration only (e.g. `3h`, `5m`). Use `formatRelativeTime` for display. */
export const getRelativeTime = (timestamp: number | string): string => {
    if (!timestamp) return "";

    const timeMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    if (isNaN(timeMs) || timeMs <= 0) return "";

    const now = Date.now();
    const diff = now - timeMs;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const month = 30 * day;
    const year = 365 * day;

    if (diff < 0) return 'justNow';
    if (diff < minute) return 'justNow';
    if (diff < hour) return `${Math.floor(diff / minute)}m`;
    if (diff < day) return `${Math.floor(diff / hour)}h`;
    if (diff < month) return `${Math.floor(diff / day)}d`;
    if (diff < year) return `${Math.floor(diff / month)}M`;
    return `${Math.floor(diff / year)}y`;
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export const formatRelativeTime = (
    time: string,
    t: TranslateFn,
    options: { agoKey?: string; justNowKey?: string } = {}
): string => {
    const { agoKey = 'relativeTime.ago', justNowKey = 'relativeTime.justNow' } = options;
    if (!time) return '';
    if (time === 'justNow') return t(justNowKey);
    return t(agoKey, { time });
};

export const getMapConfig = (mapName: string) => {
    if (!mapName) return LOCAL_MAP_DATA["Unknown"];
    const bg = window.overwolf?.windows?.getMainWindow() as any;
    const remoteData = bg?.BG_MAP_DATA;
    if (!remoteData) {
        console.warn("⚠️ 백그라운드 데이터가 없습니다. 로컬 데이터를 사용합니다.");
    }
    
    const mapSource = (remoteData && remoteData[mapName]) ? remoteData : LOCAL_MAP_DATA;
    if (mapSource[mapName]) {
        return mapSource[mapName];
    }
    const lowerName = mapName.toLowerCase();
    const foundKey = Object.keys(mapSource).find(key => {
        const k = key.toLowerCase();
        if (k.includes(lowerName) || lowerName.includes(k)) return true;
        if (lowerName.includes('canyon') && k.includes('kings')) return true;
        if (lowerName.includes('olympus') && k.includes('olympus')) return true;
        if (lowerName.includes('world') && k.includes('world')) return true;
        if (lowerName.includes('storm') && k.includes('storm')) return true;
        if (lowerName.includes('broken') && k.includes('broken')) return true;
        if (lowerName.includes('district') && k.includes('district')) return true;
        return false;
    });

    if (foundKey) {
        console.log(`🗺️ Map Config Loaded [${foundKey}]:`, mapSource[foundKey]); 
        return mapSource[foundKey];
    }

    return mapSource["Unknown"] || LOCAL_MAP_DATA["Unknown"];
};

export const getCssPos = (x: number, y: number, mapName: string) => {
    const config = getMapConfig(mapName);
    const scale = config.scale || 30;
    const xOff = config.xOffset || 0;
    const yOff = config.yOffset || 0;

    return { 
        x: 50 + (x / scale) + xOff, 
        y: 50 - (y / scale) + yOff 
    };
};

/** Clan tags and whitespace ignored — matches background isSamePlayer(). */
export const isSamePlayer = (name1?: string | null, name2?: string | null): boolean => {
    if (!name1 || !name2) return false;
    const clean = (value: string) => value.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    return clean(name1) === clean(name2);
};

/** Alphabetical teammate sort key — strips `[tag]` prefixes/suffixes, keeps nickname spacing. */
export const getTeammateSortKey = (name: string): string =>
    name.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();

export const normalizeLegendKey = (legend?: string | null): string =>
    (legend || 'unknown').toLowerCase().trim();

/** Matches with missing/unknown legend are excluded from statistics aggregation. */
export const isKnownLegend = (legend?: string | null): boolean => {
    const key = normalizeLegendKey(legend);
    return key !== '' && key !== 'unknown' && key !== 'none';
};

export const getPlatformInfo = (hw?: number | null) => {
    if (hw === undefined || hw === null) {
        return { id: 'unknown', label: 'Unknown' };
    }

    const h = Number(hw);
    
    switch (h) {
        case 7: return { id: 'steam', label: 'PC (Steam)' };
        case 2: return { id: 'origin', label: 'PC (Origin)' };
        case 1: return { id: 'ps', label: 'PlayStation' };
        case 0: return { id: 'xbox', label: 'Xbox' };
        case 9: return { id: 'switch', label: 'Nintendo Switch' };
        default: return { id: 'unknown', label: 'Unknown' };
    }
};
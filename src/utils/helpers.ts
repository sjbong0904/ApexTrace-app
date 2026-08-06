import { MAP_DATA as LOCAL_MAP_DATA } from './constants';
import type { Season } from './match';

/** Season 30 Split 1 start (World's Edge layout refresh). Fallback if seasons not loaded. */
export const WORLDS_EDGE_S30_START_MS = Date.parse('2026-08-04T17:00:00.000Z');

const isBlankOrUnknownMapToken = (value: string | null | undefined): boolean => {
    if (value == null) return true;
    const lower = String(value).trim().toLowerCase();
    return !lower || lower === 'unknown' || lower === 'none' || lower === 'null';
};

/** Normalize GEP raw ids / UNKNOWN tokens to display names used in history & stats. */
export const normalizeMapDisplayName = (raw: string | null | undefined): string => {
    if (isBlankOrUnknownMapToken(raw)) return 'Unknown';
    const trimmed = String(raw).trim();
    const lower = trimmed.toLowerCase();

    if (
        lower.includes('desertlands')
        || lower === "world's edge"
        || lower === 'worlds edge'
        || (lower.includes('world') && lower.includes('edge'))
    ) {
        return "World's Edge";
    }
    if (lower.includes('canyonlands') || (lower.includes('canyon') && !lower.includes('staging'))) {
        return 'Kings Canyon';
    }
    if (lower.includes('olympus')) return 'Olympus';
    if (lower.includes('tropic') || lower.includes('storm')) return 'Storm Point';
    if (lower.includes('moon') || lower.includes('broken')) return 'Broken Moon';
    if (lower.includes('district')) return 'E-District';

    return trimmed;
};

export const resolveWorldsEdgeMapImage = (
    matchTimeMs?: number | null,
    seasons?: Season[] | null,
): string => {
    const s30 = seasons?.find((s) => /season\s*30/i.test(s.name ?? ''));
    const cutoff = s30?.startTime != null && s30.startTime > 0
        ? s30.startTime
        : WORLDS_EDGE_S30_START_MS;
    if (matchTimeMs != null && Number.isFinite(matchTimeMs) && matchTimeMs >= cutoff) {
        return 'worlds_edge_s30.png';
    }
    return 'worlds_edge_s29.png';
};

const isWorldsEdgeMap = (mapName: string): boolean =>
    normalizeMapDisplayName(mapName) === "World's Edge";

export const getRankColor = (rank: number | string) => {
    if (rank === 1 || rank === '1' || rank === '#1') return 'var(--color-rank-first)';
    const r = parseInt(String(rank).replace('#', ''));
    if (!isNaN(r) && r <= 5) return 'var(--color-rank-top5)';
    return 'var(--color-rank-other)';
};

/** Shared performance-stat color tiers: low → normal → high → elite. */
export const STAT_TIER_COLOR = {
    missing: 'var(--color-text-faint)',
    low: 'var(--color-text-muted)',
    normal: 'var(--color-text-primary)',
    high: '#4ade80',
    elite: '#fdcb6e',
} as const;

const parseStatNumber = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined || value === '' || value === '-') return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/%/g, ''));
    return Number.isFinite(n) ? n : null;
};

/** Higher is better: [0, lowMax) low · [lowMax, highMin) normal · [highMin, eliteMin) high · ≥eliteMin elite. */
const colorForHigherIsBetter = (
    value: string | number | null | undefined,
    lowMax: number,
    highMin: number,
    eliteMin: number,
): string => {
    const n = parseStatNumber(value);
    if (n === null) return STAT_TIER_COLOR.missing;
    if (n < lowMax) return STAT_TIER_COLOR.low;
    if (n < highMin) return STAT_TIER_COLOR.normal;
    if (n < eliteMin) return STAT_TIER_COLOR.high;
    return STAT_TIER_COLOR.elite;
};

/** Win rate %: <5 gray · 5–10 white · 10–15 green · ≥15 gold. */
export const getWinRateColor = (
    winRate: string | number,
    opts?: { hasValue?: boolean },
): string => {
    if (opts?.hasValue === false) return STAT_TIER_COLOR.missing;
    return colorForHigherIsBetter(winRate, 5, 10, 15);
};

/** K/D: <0.8 gray · 0.8–1.2 white · 1.2–2 green · ≥2 gold. */
export const getKdColor = (kd: string | number): string =>
    colorForHigherIsBetter(kd, 0.8, 1.2, 2);

/** KA/D: <1 gray · 1–1.5 white · 1.5–2.5 green · ≥2.5 gold. */
export const getKadColor = (kad: string | number): string =>
    colorForHigherIsBetter(kad, 1, 1.5, 2.5);

/** Avg damage: <300 gray · 300–500 white · 500–800 green · ≥800 gold. */
export const getAvgDamageColor = (avgDamage: string | number): string =>
    colorForHigherIsBetter(avgDamage, 300, 500, 800);

/** Avg placement (lower is better): ≤3 gold · ≤5 green · ≤8 white · >8 gray. */
export const getAvgPlacementColor = (avgPlacement: string | number): string => {
    const val = parseStatNumber(avgPlacement);
    if (val === null) return STAT_TIER_COLOR.missing;
    if (val <= 3) return STAT_TIER_COLOR.elite;
    if (val <= 5) return STAT_TIER_COLOR.high;
    if (val <= 8) return STAT_TIER_COLOR.normal;
    return STAT_TIER_COLOR.low;
};

/** Compact win-rate chip (map/legend breakdown badges). */
export const getWinRateChipStyle = (winRate: string | number): {
    color: string;
    background: string;
    border: string;
} => {
    const color = getWinRateColor(winRate);
    if (color === STAT_TIER_COLOR.elite) {
        return {
            color,
            background: 'rgba(253, 203, 110, 0.15)',
            border: '1px solid rgba(253, 203, 110, 0.35)',
        };
    }
    if (color === STAT_TIER_COLOR.high) {
        return {
            color,
            background: 'rgba(74, 222, 128, 0.15)',
            border: '1px solid rgba(74, 222, 128, 0.35)',
        };
    }
    return {
        color,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid var(--color-border)',
    };
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

/** Raw elapsed from session startTime (no dropship offset). */
export const toGameElapsedMs = (elapsedFromMatchStartMs: number): number =>
    Math.max(0, elapsedFromMatchStartMs);

export const formatMatchElapsedTime = (
    elapsedFromMatchStartMs: number,
    style: 'digital' | 'text' = 'digital',
) => formatMatchTime(toGameElapsedMs(elapsedFromMatchStartMs), style);

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

export const getMapConfig = (mapName: string, matchTimeMs?: number | null, seasons?: Season[] | null) => {
    if (!mapName || isBlankOrUnknownMapToken(mapName)) return LOCAL_MAP_DATA["Unknown"];
    const displayName = normalizeMapDisplayName(mapName);
    const bg = window.overwolf?.windows?.getMainWindow() as any;
    const remoteData = bg?.BG_MAP_DATA;
    if (!remoteData) {
        console.warn("⚠️ 백그라운드 데이터가 없습니다. 로컬 데이터를 사용합니다.");
    }

    const mapSource = (remoteData && (remoteData[displayName] || remoteData[mapName]))
        ? remoteData
        : LOCAL_MAP_DATA;
    let config = mapSource[displayName] || mapSource[mapName] || null;

    if (!config) {
        const lowerName = displayName.toLowerCase();
        const foundKey = Object.keys(mapSource).find(key => {
            const k = key.toLowerCase();
            if (k.includes(lowerName) || lowerName.includes(k)) return true;
            if (lowerName.includes('canyon') && k.includes('kings')) return true;
            if (lowerName.includes('olympus') && k.includes('olympus')) return true;
            if (lowerName.includes('world') && k.includes('world')) return true;
            if (lowerName.includes('storm') && k.includes('storm')) return true;
            if (lowerName.includes('broken') && k.includes('broken')) return true;
            if (lowerName.includes('district') && k.includes('district')) return true;
            if (lowerName.includes('desertlands') && k.includes('world')) return true;
            return false;
        });

        if (foundKey) {
            console.log(`🗺️ Map Config Loaded [${foundKey}]:`, mapSource[foundKey]);
            config = mapSource[foundKey];
        }
    }

    if (!config) {
        return mapSource["Unknown"] || LOCAL_MAP_DATA["Unknown"];
    }

    if (isWorldsEdgeMap(displayName)) {
        return {
            ...config,
            img: resolveWorldsEdgeMapImage(matchTimeMs, seasons),
        };
    }

    return config;
};

export const getCssPos = (x: number, y: number, mapName: string, matchTimeMs?: number | null) => {
    const config = getMapConfig(mapName, matchTimeMs);
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

/**
 * K/D death denominator for a match.
 * Prefers stored/event death count (each finisher / squad-elim death).
 * Legacy rows without `deaths` fall back to loss=1 / win=0.
 */
export const getMatchDeaths = (match: {
    deaths?: number | null;
    placement?: number | string | null;
    events?: Array<{ type?: string; victim?: string }> | null;
    playerName?: string | null;
}): number => {
    if (typeof match.deaths === 'number' && Number.isFinite(match.deaths) && match.deaths >= 0) {
        return match.deaths;
    }

    const playerName = match.playerName;
    const events = match.events;
    if (playerName && Array.isArray(events) && events.length > 0) {
        let counted = 0;
        for (const event of events) {
            if (String(event?.type || '').toLowerCase() !== 'death') continue;
            if (isSamePlayer(event.victim, playerName)) counted += 1;
        }
        return counted;
    }

    const placement = match.placement != null ? Number(match.placement) : NaN;
    return placement === 1 ? 0 : 1;
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
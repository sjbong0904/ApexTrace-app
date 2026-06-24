import { MAP_DATA as LOCAL_MAP_DATA } from './constants';

export const getRankColor = (rank: number | string) => {
    if (rank === 1 || rank === '1' || rank === '#1') return 'var(--color-rank-first)';
    const r = parseInt(String(rank).replace('#', ''));
    if (!isNaN(r) && r <= 5) return 'var(--color-rank-top5)';
    return 'var(--color-rank-other)';
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
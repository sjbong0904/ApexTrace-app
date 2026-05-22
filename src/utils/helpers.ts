import { MAP_DATA as LOCAL_MAP_DATA } from './constants';

export const getRankColor = (rank: number | string) => {
    if (rank === 1 || rank === '1' || rank === '#1') return "#ff4757";
    const r = parseInt(String(rank).replace('#',''));
    if (!isNaN(r)) {
        if (r <= 5) return "#00d2be";
    }
    return "#dfe6e9";
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

export const getRelativeTime = (timestamp: number | string) => {
    if (!timestamp) return "";

    // 🟢 [수정] 입력값이 문자열(ISO Date)인 경우 숫자로 변환
    const timeMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    
    // 유효하지 않은 날짜 포맷 방어
    if (isNaN(timeMs) || timeMs <= 0) return "Never Searched";

    const now = Date.now();
    const diff = now - timeMs;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const month = 30 * day;
    const year = 365 * day;

    // 미래의 시간일 경우 처리 (서버-클라이언트 시간 오차 대비)
    if (diff < 0) return 'Just now';

    if (diff < minute) return 'Just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < month) return `${Math.floor(diff / day)}d ago`;
    if (diff < year) return `${Math.floor(diff / month)}M ago`;
    return `${Math.floor(diff / year)}y ago`;
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
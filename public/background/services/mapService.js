/** Built-in fallbacks when game_constants.map_id_map is slow/missing. */
const MAP_ID_FALLBACKS = {
    desertlands: "World's Edge",
    canyonlands: "Kings Canyon",
    olympus: "Olympus",
    tropic_island: "Storm Point",
    divided_moon: "Broken Moon",
    district: "E-District",
    skulltown: "Skull Town",
    lobby: "Lobby",
    canyonlands_staging_mu1: "Firing Range",
};

const isBlankOrUnknownMap = (value) => {
    if (value == null) return true;
    const lower = String(value).trim().toLowerCase();
    return !lower || lower === 'unknown' || lower === 'none' || lower === 'null';
};

class MapService {
    static getMapName(mapId) {
        if (isBlankOrUnknownMap(mapId)) return null;
        const lower = String(mapId).toLowerCase();

        const mapIdMap = { ...MAP_ID_FALLBACKS, ...(window.MAP_ID_MAP ?? {}) };
        // Longer keys first so staging/firing-range beats canyonlands.
        const entries = Object.entries(mapIdMap).sort((a, b) => b[0].length - a[0].length);
        for (const [key, name] of entries) {
            if (key && lower.includes(key.toLowerCase())) return name;
        }

        const mapData = window.BG_MAP_DATA ?? {};
        for (const knownName of Object.keys(mapData)) {
            if (knownName.toLowerCase() === lower) return knownName;
        }

        // Heuristic for raw GEP ids (mp_rr_*)
        if (lower.includes('desertlands') || (lower.includes('world') && lower.includes('edge'))) {
            return "World's Edge";
        }
        if (lower.includes('canyonlands') || lower.includes('canyon')) return "Kings Canyon";
        if (lower.includes('olympus')) return "Olympus";
        if (lower.includes('tropic') || lower.includes('storm')) return "Storm Point";
        if (lower.includes('moon') || lower.includes('broken')) return "Broken Moon";
        if (lower.includes('district')) return "E-District";

        if (!lower.startsWith('mp_')) return mapId;

        return null;
    }

    /** map_id 우선, 실패 시 map_name — null/UNKNOWN으로 기존 값을 덮어쓰지 않음 */
    static resolveMap(mapId, mapName) {
        const fromId = mapId ? this.getMapName(mapId) : null;
        if (fromId) return fromId;

        if (mapName) {
            const fromName = this.getMapName(mapName);
            if (fromName) return fromName;
            if (!isBlankOrUnknownMap(mapName) && !String(mapName).toLowerCase().startsWith('mp_')) {
                return mapName;
            }
        }

        if (mapId && !isBlankOrUnknownMap(mapId)) return mapId;
        if (mapName && !isBlankOrUnknownMap(mapName)) return mapName;
        return null;
    }

    static isUnknownMap(value) {
        return isBlankOrUnknownMap(value);
    }
}

window.MapService = MapService;

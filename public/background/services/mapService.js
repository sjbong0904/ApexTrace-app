class MapService {
    static getMapName(mapId) {
        if (!mapId) return null;
        const lower = mapId.toLowerCase();

        const mapIdMap = window.MAP_ID_MAP ?? {};
        for (const [key, name] of Object.entries(mapIdMap)) {
            if (lower.includes(key)) return name;
        }

        const mapData = window.BG_MAP_DATA ?? {};
        for (const knownName of Object.keys(mapData)) {
            if (knownName.toLowerCase() === lower) return knownName;
        }

        if (!lower.startsWith('mp_')) return mapId;

        return null;
    }

    /** map_id 우선, 실패 시 map_name — null로 기존 값을 덮어쓰지 않음 */
    static resolveMap(mapId, mapName) {
        const fromId = mapId ? this.getMapName(mapId) : null;
        if (fromId) return fromId;

        if (mapName) {
            const fromName = this.getMapName(mapName);
            if (fromName) return fromName;
            if (!String(mapName).toLowerCase().startsWith('mp_')) return mapName;
        }

        return mapId || mapName || null;
    }
}

window.MapService = MapService;
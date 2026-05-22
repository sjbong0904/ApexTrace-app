// src/utils/gameData.ts

export const COLORS = {
    CHART: ['#db4545', '#ff9f43', '#54a0ff', '#5f27cd', '#1dd1a1', '#c8d6e5'],
    NEON_RED: "#ff4757",
    NEON_ORANGE: "#e67e22",
};

export const AMMO_COLORS: Record<string, string> = {
    'Light': '#ffb157', 'Heavy': '#48e0a6', 'Energy': '#bbdf39',
    'Sniper': '#5b9af7', 'Shotgun': '#da292a', 'Mythic': '#e62952', 'Arrows': '#ddb739'
};

export const TARGET_MAPS = ["World's Edge", "Kings Canyon", "Olympus", "Storm Point", "Broken Moon", "E-District"];

export const MAP_THUMBNAILS: Record<string, string> = {
    "World's Edge": "thumbnail-worlds_edge.png",
    "Kings Canyon": "thumbnail-kings_canyon.png",
    "Olympus": "thumbnail-olympus.png",
    "Storm Point": "thumbnail-storm_point.png",
    "Broken Moon": "thumbnail-broken_moon.png",
    "E-District": "thumbnail-e-district.png"
};

export const LEGENDS_LIST = [
    "bangalore", "fuse", "ash", "mad maggie", "ballistic", "pathfinder", "wraith", "octane", "revenant", "horizon", "alter", "axle",
    "bloodhound", "crypto", "valkyrie", "seer", "vantage", "sparrow", "gibraltar", "lifeline", "mirage", "loba", "newcastle",
    "conduit", "caustic", "wattson", "rampart", "catalyst"
];

export const SHORT_WEAPON_NAMES = (rawName: string | null): string | null => {
    if (!rawName) return null;
    const lower = rawName.toLowerCase();

    // 아킴보 우선
    if (lower.includes('mozam') && lower.includes('akimbo')) return "MOZAMBIQUE AKIMBO";
    if (lower.includes('p2020') && lower.includes('akimbo')) return "P2020 AKIMBO";

    // 충돌 위험군 우선
    if (lower.includes('r301') || lower.includes('r-301') || lower.includes('rspn101')) return "R-301";
    if (lower.includes('c.a.r') || lower.includes('_car') || lower.includes('car_') || lower === 'car') return "C.A.R.";
    if (lower.includes('g7') || lower.includes('scout') || lower.includes('g2')) return "G7 SCOUT";
    if (lower.includes('hemlok') || lower.includes('hemlock')) return "HEMLOK";

    // 일반 스캔
    if (lower.includes('r99') || lower.includes('r-99') || lower.includes('r97')) return "R-99";
    if (lower.includes('flatline') || lower.includes('vinson')) return "FLATLINE";
    if (lower.includes('nemesis')) return "NEMESIS";
    if (lower.includes('havoc') || lower.includes('energy_ar')) return "HAVOC";
    if (lower.includes('alternator')) return "ALTERNATOR";
    if (lower.includes('prowler') || lower.includes('pdw')) return "PROWLER";
    if (lower.includes('volt')) return "VOLT";
    if (lower.includes('devotion') || lower.includes('esaw')) return "DEVOTION";
    if (lower.includes('lstar') || lower.includes('l-star')) return "L-STAR";
    if (lower.includes('spitfire')) return "SPITFIRE";
    if (lower.includes('rampage') || lower.includes('dragon')) return "RAMPAGE";
    if (lower.includes('3030') || lower.includes('30-30') || lower.includes('repeater')) return "30-30";
    if (lower.includes('triple') || lower.includes('doubletake')) return "TRIPLE TAKE";
    if (lower.includes('longbow') || lower.includes('dmr')) return "LONGBOW";
    if (lower.includes('bocek') || lower.includes('bow') || lower.includes('composite')) return "BOCEK";
    if (lower.includes('charge') || lower.includes('defender')) return "CHARGE RIFLE";
    if (lower.includes('sentinel')) return "SENTINEL";
    if (lower.includes('wingman')) return "WINGMAN";
    if (lower.includes('eva')) return "EVA-8";
    if (lower.includes('mastiff')) return "MASTIFF";
    if (lower.includes('peacekeeper')) return "PEACEKEEPER";
    if (lower.includes('mozambique')) return "MOZAMBIQUE";
    if (lower.includes('p2020')) return "P2020";
    if (lower.includes('re45') || lower.includes('re-45') || lower.includes('r45')) return "RE-45";
    if (lower.includes('kraber')) return "KRABER";

    return null;
};

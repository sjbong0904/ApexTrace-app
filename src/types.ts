export interface MatchEvent {
    type: 'kill' | 'death' | 'knockdown' | 'assist' | 'damage' | 'ring_damage' | 'ability_used' | 'item_dibs' | 'team_revive_attempt' | 'team_respawn_success' | 'revive' | 'respawn';
    attacker?: string;
    victim?: string;
    weapon?: string;
    damageAmount?: number;
    desc?: string;
    timestamp: number;
    raw?: string;
}

/** One GEP `active_ring` reading. Raw GEP units (not meters like path); `d` = 1 while local player dead. */
export interface RingSample {
    t: number;
    x: number;
    y: number;
    r: number;
    d?: 0 | 1;
}

export interface RingRound {
    round: number;
    /** First/last observed shrink (active radius decreasing) — epoch ms. */
    startTime?: number;
    endTime?: number;
    /** null for a placeholder round when active_ring arrived before any next_ring. */
    nextRingCenterX: number | null;
    nextRingCenterY: number | null;
    nextRingRadius: number | null;
    revealedAt?: number | null;
    revealedWhileDead?: boolean;
    /** 'active_end' = GEP next_ring center was invalid; filled from the shrink's final active center. */
    centerSource?: 'active_end';
    /** Raw GEP next_ring [x, y] as received (garbage as of GEP 318.0) — kept only to detect a GEP fix. */
    gepCenterRaw?: [number, number];
    activeSamples?: RingSample[];
}

export interface WeaponTimelineEntry {
    timestamp: number;
    primary?: string | null;
    secondary?: string | null;
    previousPrimary?: string | null;
    previousSecondary?: string | null;
    equipped?: string | null;
    action?: 'pickup' | 'drop' | 'swap' | 'equip' | 'loadout_change' | 'unknown';
}

export type WeaponCombatEntry = {
    kills: number;
    assists: number;
    /** Total possession time in this match (ms). */
    holdMs: number;
    /** K/D deaths attributed this match (may be fractional via hold-time share). */
    deaths: number;
    /** Whether this weapon qualifies for win rate / avg placement. */
    qualify: boolean;
};

export type WeaponCombatMap = Record<string, WeaponCombatEntry>;

/** Weapons that knocked / eliminated the local player (summary-safe). */
export type WeaponThreatEntry = {
    /** Deaths credited via knockdown-preferring weapon logic. */
    kills: number;
    /** Times the local player was knocked by this weapon. */
    knockdowns: number;
};

export type WeaponThreatMap = Record<string, WeaponThreatEntry>;

export interface Match {
    matchId: string;
    platformId: string | null;
    playerName: string;
    
    mode: string;
    map: string;
    legend: string | null;
    
    /** Null when GEP tabs were untrusted (incomplete match). */
    placement: number | string | null;
    kills: number | null;
    assists: number | null;
    /** Local player deaths this match (combat-log count). Null/omit = legacy. */
    deaths?: number | null;
    knocks: number | null;
    damage: number | null;
    /** GEP signals missing/estimated at capture; shown in the incomplete-badge tooltip. */
    missingSignals?: string[];
    squadKills: number;
    ultimatesUsed: number;
    headshots?: number;
    grenadeDamage?: number;
    /** Every GEP `damage` hit this match (headshot-rate denominator). Null/omit = build that did not count it. */
    damageHits?: number | null;

    rank: {
        name: string;
        score: number;
        startScore: number;
    };
    
    rpChange: number;
    rpProcessed: boolean;
    rankScore?: number;

    startTime: number;
    endTime: number;
    
    loadout: {
        primary: string | null;
        secondary: string | null;
    };

    /** Per-weapon kill/assist counts from combat log (summary-safe). */
    weaponCombat?: WeaponCombatMap;
    /** Weapons that knocked / eliminated the local player (summary-safe). */
    weaponThreats?: WeaponThreatMap;

    path: { x: number; y: number; t?: number; p?: string; s?: number }[];
    ringRounds?: RingRound[];
    /** GEP ring units per location meter (100 as of GEP 317.4). */
    ringUnitsPerMeter?: number;
    weaponTimeline?: WeaponTimelineEntry[];
    events: MatchEvent[];
    teamStats: {
        uid: string | null;
        name: string; 
        legend: string;
        kills?: number;
    }[];
    teammateKills?: Record<string, number>;
    /** Client-only flag: Tier-2 detail fetched and merged */
    _detailLoaded?: boolean;
    /** MATCH_DETAIL_VERSION the detail was fetched under (missing = pre-ring cache). */
    _detailVersion?: number;
}

/** A search hit / address-book row as the background returns it (snake_case DB rows or camelCase ALS data). */
export interface PlayerCandidate {
    uid: string;
    name: string;
    /** Platform hardware id (7 Steam, 2 Origin, 1 PS, 0 Xbox, 9 Switch); the background sends it as a string. */
    hw?: number | string | null;
    level?: number;
    prestige?: number;
    legend?: string | null;
    avatar?: string | null;
    rank_name?: string | null;
    rankName?: string | null;
    rank_score?: number | null;
    rankScore?: number | null;
    rank_div?: number | null;
    rankDiv?: number | null;
    updated_at?: string | null;
    updatedAt?: string | null;
    matchType?: 'name' | 'alias';
}

export interface User {
    uid: string | null;
    name: string;
    level: number;
    prestige: number;
    rankName: string;
    rankScore: number;
    legend: string | null;
    avatar: string | null;
    /** GEP player_stats_career (local player live, or DB once they used the app). */
    currentXp?: number | null;
    neededXp?: number | null;
    gepSyncedAt?: string | null;
}

/** One BR season block from GEP player_stats (`br_*_latest` / `br_*_history[]`). */
export interface GepBrSeasonStats {
    season: number;
    games: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
    knockdowns: number;
    damage_dealt: number;
    top_5s: number;
    teammates_revived: number;
    teammates_respawned: number;
    win_rate: number;
    average_damage: number;
    kill_death_ratio: number;
    /** Ranked keys only (undocumented by Overwolf; equals ALS RP). */
    rank_score?: number;
    highest_damage?: number;
    highest_kills?: number;
    longest_win_streak?: number;
}

/** GET /account-stats row (or live Store snapshot for the local player). */
export interface AccountStats {
    uid: string;
    gep_season: number | null;
    career: {
        level: number;
        current_xp: number;
        needed_xp: number;
        total_xp: number;
        battle_royale?: Omit<GepBrSeasonStats, 'season' | 'rank_score'>;
        arenas?: Record<string, number>;
    } | null;
    br_ranked_latest: GepBrSeasonStats | null;
    br_unranked_latest: GepBrSeasonStats | null;
    br_ranked_history: GepBrSeasonStats[] | null;
    br_unranked_history: GepBrSeasonStats[] | null;
    captured_at: string | null;
    source?: 'live';
}

export {};
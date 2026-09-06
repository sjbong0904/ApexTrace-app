// src/types.ts
export interface MatchEvent {
    type: 'kill' | 'death' | 'knockdown' | 'assist' | 'damage' | 'ring_damage' | 'kill_leader' | 'ability_used' | 'item_dibs' | 'team_revive_attempt' | 'team_respawn_success' | 'revive' | 'respawn';
    attacker?: string;
    victim?: string;
    weapon?: string;
    damageAmount?: number;
    desc?: string;
    timestamp: number;
    raw?: string;
}

export interface RingRound {
    round: number;
    startTime?: number;
    endTime?: number;
    nextRingCenterX: number;
    nextRingCenterY: number;
    nextRingRadius: number;
    revealedAt?: number;
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
    /** K/D deaths attributed this match. */
    deaths: number;
    /** Whether this weapon qualifies for win rate / avg placement. */
    qualify: boolean;
};

export type WeaponCombatMap = Record<string, WeaponCombatEntry>;

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
    
    path: { x: number; y: number; t?: number; p?: string; s?: number }[];
    ringRounds?: RingRound[];
    weaponTimeline?: WeaponTimelineEntry[];
    events: MatchEvent[];
    teamStats: {
        uid: any; 
        name: string; 
        legend: string;
        kills?: number;
    }[];
    teammateKills?: Record<string, number>;
    isKillLeader?: boolean;
    /** Client-only flag: Tier-2 detail fetched and merged */
    _detailLoaded?: boolean;
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
}

export {};
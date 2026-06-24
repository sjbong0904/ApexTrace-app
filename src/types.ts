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

export interface Match {
    matchId: string;
    platformId: string | null;
    playerName: string;
    
    mode: string;
    map: string;
    legend: string | null;
    
    placement: number | string;
    kills: number;
    assists: number;
    knocks: number;
    damage: number;
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
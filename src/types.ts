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

    startTime: number;
    endTime: number;
    
    loadout: {
        primary: string | null;
        secondary: string | null;
    };
    
    path: { x: number; y: number; t?: number; p?: string; s?: number }[];
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
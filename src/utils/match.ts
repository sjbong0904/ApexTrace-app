// src/utils/match.ts
export interface MatchHistory {
    kills?: number;
    damage?: number;
    assists?: number;
    placement?: number;
    legend?: string;
    loadout?: {
        primary?: string;
        secondary?: string;
    };
}

export interface Season {
    id: number;
    name: string;
    startTime: number | null; // ISO 문자열 or null
}
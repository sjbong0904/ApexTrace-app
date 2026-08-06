import type { MatchEvent } from '../types';
import type { WeaponCombatMap } from './weaponCombat';

export type MatchDataQuality = 'complete' | 'estimated' | 'unrecoverable';

export interface MatchHistory {
    kills?: number;
    damage?: number;
    assists?: number;
    /** Combat-log death count; omit/null → legacy win/loss fallback in getMatchDeaths. */
    deaths?: number | null;
    placement?: number;
    legend?: string;
    playerName?: string;
    startTime?: number;
    endTime?: number;
    loadout?: {
        primary?: string;
        secondary?: string;
    };
    /** Per-weapon combat summary (summary-safe). */
    weaponCombat?: WeaponCombatMap;
    weaponTimeline?: import('../types').WeaponTimelineEntry[];
    /** Present on detail-loaded matches; used as fallback for weaponCombat. */
    events?: MatchEvent[];
    /** Persistable quality — incomplete GEP boundaries still keep the record. */
    dataQuality?: MatchDataQuality;
    confidence?: number;
    missingSignals?: string[];
}

export interface Season {
    id: number;
    name: string;
    startTime: number | null;
    /** Epoch ms exclusive end; null/undefined = open-ended or unknown */
    endTime?: number | null;
}

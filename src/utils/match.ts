import type { MatchEvent } from '../types';
import type { WeaponCombatMap } from './weaponCombat';

export interface MatchHistory {
    kills?: number | null;
    damage?: number | null;
    assists?: number | null;
    knocks?: number | null;
    /** Combat-log death count; omit/null → legacy win/loss fallback in getMatchDeaths. */
    deaths?: number | null;
    placement?: number | string | null;
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
    /** GEP signals missing/estimated at capture; shown in the incomplete-badge tooltip. */
    missingSignals?: string[];
}

type MatchStatsLike = {
    placement?: number | string | null;
    kills?: number | null;
    assists?: number | null;
    damage?: number | null;
};

/**
 * Untrusted tab stats — exclude from averages and WR.
 * The background nulls placement/kills/assists/damage when the scoreboard was
 * unreliable, so null stats are the incomplete marker.
 */
export const hasUsableMatchStats = (match?: MatchStatsLike | null): boolean => {
    if (!match) return false;
    if (match.placement == null) return false;
    if (match.kills == null && match.assists == null && match.damage == null) return false;
    return true;
};

export const isIncompleteMatchStats = (match?: MatchStatsLike | null): boolean =>
    !hasUsableMatchStats(match);

export interface Season {
    id: number;
    name: string;
    startTime: number | null;
    /** Epoch ms exclusive end; null/undefined = open-ended or unknown */
    endTime?: number | null;
}

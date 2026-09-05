import { supabase } from '../lib/supabase';
import type { Season } from './match';
import { resolveSeasonEndMs } from './seasons';

export interface DailyRankSnapshot {
    snapshot_date: string;
    rank_score: number;
    rank_name: string | null;
}

/** UTC calendar date string (YYYY-MM-DD) for an instant. */
function utcDateString(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

/** Previous UTC calendar day as YYYY-MM-DD. */
function previousUtcDateString(dateStr: string): string {
    const ms = Date.parse(`${dateStr}T00:00:00.000Z`);
    return utcDateString(ms - 24 * 60 * 60 * 1000);
}

/**
 * Inclusive UTC date range for daily_rank_snapshots belonging to a season.
 *
 * Season boundaries are mid-day UTC (typically 18:00). The calendar date of the
 * exclusive end is the next season's start day; after reset, ALS overwrites that
 * day's snapshot with the post-reset RP (table is keyed by uid+date only).
 * Exclude that transition date from the previous season so net change / last-day
 * delta do not absorb the season reset.
 */
export function getSeasonSnapshotDateRange(
    seasons: Season[],
    selectedSeasonId: number,
): { startDate: string; endDate: string } | null {
    const current = seasons.find(s => s.id === selectedSeasonId);
    if (!current?.startTime) return null;

    const startDate = utcDateString(current.startTime);
    const exclusiveEnd = resolveSeasonEndMs(seasons, selectedSeasonId);

    let endDate: string;
    if (exclusiveEnd == null) {
        endDate = utcDateString(Date.now());
    } else {
        // Day before next season's start date (exclusiveEnd's UTC calendar day).
        endDate = previousUtcDateString(utcDateString(exclusiveEnd));
        if (endDate < startDate) endDate = startDate;
    }

    return { startDate, endDate };
}

export async function fetchDailyRankSnapshots(
    uid: string,
    startDate: string,
    endDate: string,
): Promise<DailyRankSnapshot[]> {
    if (!uid) return [];

    const { data, error } = await supabase
        .from('daily_rank_snapshots')
        .select('snapshot_date, rank_score, rank_name')
        .eq('uid', uid)
        .gte('snapshot_date', startDate)
        .lte('snapshot_date', endDate)
        .order('snapshot_date', { ascending: true });

    if (error || !data) {
        return [];
    }

    return data.map(row => ({
        snapshot_date: String(row.snapshot_date),
        rank_score: Number(row.rank_score) || 0,
        rank_name: row.rank_name != null ? String(row.rank_name) : null,
    }));
}

/**
 * Drop leading 0-RP days so placement jumps (season start → first rank) are not drawn.
 * Graph begins at the first snapshot with RP > 0.
 */
export function trimLeadingZeroSnapshots(snapshots: DailyRankSnapshot[]): DailyRankSnapshot[] {
    if (snapshots.length === 0) return snapshots;

    const firstRankedIdx = snapshots.findIndex(s => s.rank_score > 0);
    if (firstRankedIdx <= 0) return snapshots;

    const hadLeadingZeros = snapshots.slice(0, firstRankedIdx).every(s => s.rank_score === 0);
    if (!hadLeadingZeros) return snapshots;

    return snapshots.slice(firstRankedIdx);
}

/** Hide chart when the player never left 0 RP (no ranked games this season). */
export function hasRankProgressChartData(snapshots: DailyRankSnapshot[]): boolean {
    const trimmed = trimLeadingZeroSnapshots(snapshots);
    return trimmed.some(s => s.rank_score > 0);
}

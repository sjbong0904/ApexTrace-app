import { supabase } from '../lib/supabase';
import type { Season } from './match';

export interface DailyRankSnapshot {
    snapshot_date: string;
    rank_score: number;
    rank_name: string | null;
}

export function getSeasonSnapshotDateRange(
    seasons: Season[],
    selectedSeasonId: number,
): { startDate: string; endDate: string } | null {
    const current = seasons.find(s => s.id === selectedSeasonId);
    if (!current?.startTime) return null;

    const next = seasons.find(s => s.id === selectedSeasonId + 1);
    const startDate = new Date(current.startTime).toISOString().slice(0, 10);
    const endMs = next?.startTime ? next.startTime - 1 : Date.now();
    const endDate = new Date(endMs).toISOString().slice(0, 10);

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
        console.warn('[rankSnapshots] fetch failed:', error?.message);
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

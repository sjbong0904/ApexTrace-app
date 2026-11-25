import { hasUsableMatchStats } from './match';

/** Minimum earlier matches before "vs your recent games" means anything. */
export const COMPARISON_MIN_SAMPLE = 5;
const COMPARISON_WINDOW = 20;

interface ComparableMatch {
    matchId?: string;
    damage?: number | null;
    kills?: number | null;
    placement?: number | string | null;
    startTime?: number | null;
    endTime?: number | null;
}

/** Lowest / highest raw value across this match + the sample (placement: min = best). */
interface MetricRange {
    min: number;
    max: number;
}

export interface RecentComparison {
    /** Earlier matches the averages come from (≤ 20). */
    sampleSize: number;
    damage: { value: number; avg: number; deltaPct: number } & MetricRange;
    kills: { value: number; avg: number; delta: number } & MetricRange;
    placement: { value: number; avg: number; delta: number } & MetricRange;
    /** 1-based damage rank of this match among itself + the sample. */
    damageRank: number;
}

const toPlacement = (p: number | string | null | undefined): number | null => {
    const n = typeof p === 'number' ? p : Number(p);
    return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * This match against the user's previous (older) usable matches in `history`
 * (newest first, already filtered to the same mode tab).
 */
export const buildRecentComparison = (
    match: ComparableMatch,
    history: ComparableMatch[],
): RecentComparison | null => {
    if (!hasUsableMatchStats(match)) return null;
    const placement = toPlacement(match.placement);
    if (placement == null) return null;

    const idx = history.findIndex((m) => m.matchId === match.matchId);
    const older = (idx >= 0 ? history.slice(idx + 1) : history)
        .filter((m) => m.matchId !== match.matchId && hasUsableMatchStats(m) && toPlacement(m.placement) != null)
        .slice(0, COMPARISON_WINDOW);
    if (older.length < COMPARISON_MIN_SAMPLE) return null;

    const avg = (pick: (m: ComparableMatch) => number) => older.reduce((sum, m) => sum + pick(m), 0) / older.length;
    const damage = match.damage ?? 0;
    const kills = match.kills ?? 0;
    const avgDamage = avg((m) => m.damage ?? 0);
    const avgKills = avg((m) => m.kills ?? 0);
    const avgPlacement = avg((m) => toPlacement(m.placement) ?? 20);
    // Include this match so a new personal best/worst lands exactly on the bar's end.
    const range = (value: number, pick: (m: ComparableMatch) => number): MetricRange => {
        const values = [value, ...older.map(pick)];
        return { min: Math.min(...values), max: Math.max(...values) };
    };

    return {
        sampleSize: older.length,
        damage: { value: damage, avg: avgDamage, deltaPct: avgDamage > 0 ? Math.round(((damage - avgDamage) / avgDamage) * 100) : 0, ...range(damage, (m) => m.damage ?? 0) },
        kills: { value: kills, avg: avgKills, delta: kills - avgKills, ...range(kills, (m) => m.kills ?? 0) },
        placement: { value: placement, avg: avgPlacement, delta: placement - avgPlacement, ...range(placement, (m) => toPlacement(m.placement) ?? 20) },
        damageRank: 1 + older.filter((m) => (m.damage ?? 0) > damage).length,
    };
};

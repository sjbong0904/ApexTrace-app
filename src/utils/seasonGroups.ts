import { getSelectableSeasons, resolveSeasonEndMs, type SeasonBoundary } from './seasons';

/**
 * Season-level grouping of the split rows in the `seasons` table.
 * The table stays one row per split; seasons are grouped client-side by the
 * "Season N" part of the name ("Season 28 : Split 2" → 28), so no schema change.
 */
export interface SeasonGroup<T extends SeasonBoundary = SeasonBoundary> {
    /** Stable key: "s28", or "id:5" for a row whose name has no season number. */
    key: string;
    seasonNumber: number | null;
    /** Started splits, oldest first. */
    splits: T[];
}

export const parseSeasonNumberFromName = (name: string | null | undefined): number | null => {
    const m = /season\s*(\d+)/i.exec(String(name ?? ''));
    return m ? Number(m[1]) : null;
};

const parseSplitNumber = (name: string | null | undefined): number | null => {
    const m = /split\s*(\d+)/i.exec(String(name ?? ''));
    return m ? Number(m[1]) : null;
};

const keyFor = (season: SeasonBoundary): string => {
    const n = parseSeasonNumberFromName(season.name);
    return n != null ? `s${n}` : `id:${season.id}`;
};

/** Started seasons grouped by season number, newest season first. */
export function groupSeasons<T extends SeasonBoundary>(seasons: T[], now = Date.now()): SeasonGroup<T>[] {
    const started = getSelectableSeasons(seasons, now); // newest first
    const groups = new Map<string, SeasonGroup<T>>();
    for (const s of started) {
        const key = keyFor(s);
        let g = groups.get(key);
        if (!g) {
            g = { key, seasonNumber: parseSeasonNumberFromName(s.name), splits: [] };
            groups.set(key, g);
        }
        g.splits.unshift(s); // started is newest-first → splits end up oldest-first
    }
    return [...groups.values()];
}

export function findSeasonGroup<T extends SeasonBoundary>(groups: SeasonGroup<T>[], seasonId: number): SeasonGroup<T> | undefined {
    return groups.find((g) => g.splits.some((s) => s.id === seasonId));
}

/** "Split 2" from the name, else its position in the season. */
export function splitNumberOf(group: SeasonGroup, seasonId: number): number {
    const idx = group.splits.findIndex((s) => s.id === seasonId);
    const split = group.splits[idx];
    return parseSplitNumber(split?.name) ?? idx + 1;
}

/** Whole season as one range: first split start → end of the last started split. */
export function getSeasonGroupRange(
    seasons: SeasonBoundary[],
    group: SeasonGroup,
): { startTime: number | null; endTime: number | null } {
    const first = group.splits[0];
    const last = group.splits[group.splits.length - 1];
    return {
        startTime: first?.startTime ?? null,
        endTime: last ? resolveSeasonEndMs(seasons, last.id) : null,
    };
}

/** Filter range for the current selection (one split, or the whole season). */
export function getSelectionRange(
    seasons: SeasonBoundary[],
    groups: SeasonGroup[],
    selectedSeasonId: number,
    wholeSeason: boolean,
): { startTime: number | null; endTime: number | null } | null {
    const group = findSeasonGroup(groups, selectedSeasonId);
    if (wholeSeason && group && group.splits.length > 1) return getSeasonGroupRange(seasons, group);
    const current = seasons.find((s) => s.id === selectedSeasonId);
    if (!current) return null;
    return { startTime: current.startTime, endTime: resolveSeasonEndMs(seasons, selectedSeasonId) };
}

export const WHOLE_SEASON_STORAGE_KEY = 'apex_stats_whole_season';

export const readWholeSeason = (): boolean => {
    try { return localStorage.getItem(WHOLE_SEASON_STORAGE_KEY) === '1'; } catch { return false; }
};

export const storeWholeSeason = (next: boolean): void => {
    try { localStorage.setItem(WHOLE_SEASON_STORAGE_KEY, next ? '1' : '0'); } catch { /* per-viewer convenience only */ }
};

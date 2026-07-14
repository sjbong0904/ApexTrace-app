/** Season boundary used for UI default selection and dropdown filtering. */
export interface SeasonBoundary {
    id: number;
    name: string;
    startTime: number | null;
    endTime?: number | null;
}

const startMs = (season: SeasonBoundary): number => season.startTime ?? 0;

/** True when season has begun (start_time <= now). */
export function hasSeasonStarted(season: SeasonBoundary, now = Date.now()): boolean {
    return startMs(season) <= now;
}

/**
 * Seasons eligible for the dropdown: already started, newest first.
 * Future (pre-inserted) seasons are hidden until their start_time.
 */
export function getSelectableSeasons<T extends SeasonBoundary>(
    seasons: T[],
    now = Date.now(),
): T[] {
    return seasons
        .filter((season) => hasSeasonStarted(season, now))
        .sort((a, b) => startMs(b) - startMs(a));
}

/**
 * Current competitive season: start_time <= now < end_time
 * (end_time null = open-ended). Falls back to the latest started season.
 */
export function resolveCurrentSeason<T extends SeasonBoundary>(
    seasons: T[],
    now = Date.now(),
): T | undefined {
    const started = getSelectableSeasons(seasons, now);
    if (started.length === 0) return undefined;

    const containing = started.find((season) => {
        const end = season.endTime;
        return end == null || now < end;
    });

    return containing ?? started[0];
}

export function resolveCurrentSeasonId(
    seasons: SeasonBoundary[],
    now = Date.now(),
): number | undefined {
    return resolveCurrentSeason(seasons, now)?.id;
}

/** Exclusive end boundary: explicit endTime, else next season's startTime. */
export function resolveSeasonEndMs(
    seasons: SeasonBoundary[],
    selectedSeasonId: number,
): number | null {
    const current = seasons.find((s) => s.id === selectedSeasonId);
    if (!current) return null;
    if (current.endTime != null) return current.endTime;

    const next = seasons
        .filter((s) => startMs(s) > startMs(current))
        .sort((a, b) => startMs(a) - startMs(b))[0];

    return next ? startMs(next) : null;
}

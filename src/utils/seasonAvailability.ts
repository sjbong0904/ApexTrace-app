import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { resolveCurrentSeason, type SeasonBoundary } from './seasons';
import { parseSeasonNumberFromName } from './seasonGroups';

/** season_id values with at least one stored match for this uid (mode ALL), cached per uid. */
const cache = new Map<string, Promise<Set<number> | null>>();

function fetchSeasonIdsWithData(uid: string): Promise<Set<number> | null> {
    let pending = cache.get(uid);
    if (!pending) {
        pending = (async () => {
            const { data, error } = await supabase
                .from('player_season_stats')
                .select('season_id')
                .eq('uid', uid)
                .eq('mode', 'ALL')
                .gt('match_count', 0);
            if (error || !data) return null;
            return new Set(data.map((row) => Number(row.season_id)));
        })();
        cache.set(uid, pending);
        pending.then((ids) => { if (ids == null) cache.delete(uid); });
    }
    return pending;
}

/** Drop the cached set (e.g. after a new match is saved). */
export function invalidateSeasonAvailability(uid?: string | null): void {
    if (uid) cache.delete(uid);
    else cache.clear();
}

/**
 * Season rows for the dropdown, limited to seasons where this player has stored matches.
 * A season counts when any of its splits has data, and all of that season's splits stay
 * (the split buttons keep their own "not started" handling). The current season is always kept.
 *
 * Falls back to the full list when there is no uid, the lookup fails, or nothing is found
 * (stats are stored under the main uid of linked accounts, so an alt uid can return nothing).
 */
export function useSeasonsWithData<T extends SeasonBoundary>(uid: string | null | undefined, seasons: T[]): T[] {
    const [loaded, setLoaded] = useState<{ uid: string; ids: Set<number> | null } | null>(null);

    useEffect(() => {
        if (!uid) return;
        let cancelled = false;
        fetchSeasonIdsWithData(uid).then((ids) => {
            if (!cancelled) setLoaded({ uid, ids });
        });
        return () => { cancelled = true; };
    }, [uid]);

    // Ignore a result that belongs to the previously viewed player.
    const ids = uid && loaded?.uid === uid ? loaded.ids : null;

    return useMemo(() => {
        if (!ids || ids.size === 0) return seasons;
        const keyOf = (s: T) => {
            const n = parseSeasonNumberFromName(s.name);
            return n != null ? `s${n}` : `id:${s.id}`;
        };
        const keep = new Set<string>();
        for (const s of seasons) {
            if (ids.has(s.id)) keep.add(keyOf(s));
        }
        const current = resolveCurrentSeason(seasons);
        if (current) keep.add(keyOf(current));
        return seasons.filter((s) => keep.has(keyOf(s)));
    }, [ids, seasons]);
}

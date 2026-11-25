import type { Match } from '../types';
import { normalizeMatchForFrontend } from './matchNormalizer';

type DetailCapableMatch = Partial<Match> & { _detailLoaded?: boolean; _detailVersion?: number };

/**
 * Bump when server-side detail gains fields that cached copies (LocalDB) lack, so those
 * copies are refetched once on open. v2 = ring_rounds (static ring overlay).
 */
export const MATCH_DETAIL_VERSION = 2;

export function hasMatchDetail(match: DetailCapableMatch | null | undefined): boolean {
    if (!match) return false;
    if (match._detailLoaded) return true;
    if ((match.events?.length ?? 0) > 0) return true;
    if ((match.path?.length ?? 0) > 0) return true;
    if ((match.weaponTimeline?.length ?? 0) > 0) return true;
    return false;
}

/** Detail present AND fetched under the current detail version (otherwise refetch). */
export function isMatchDetailFresh(match: DetailCapableMatch | null | undefined): boolean {
    if (!hasMatchDetail(match)) return false;
    return (match?._detailVersion ?? 0) >= MATCH_DETAIL_VERSION;
}

export function mergeMatchDetail(existing: Match, detailInput: unknown): Match | null {
    const detail = normalizeMatchForFrontend(detailInput);
    if (!detail) return existing;

    return {
        ...existing,
        ...detail,
        matchId: existing.matchId,
        _detailLoaded: true,
        _detailVersion: MATCH_DETAIL_VERSION,
    };
}

/** Live Store matches carry everything the current build captures (ringRounds included). */
export function markMatchDetailLoaded(match: Match): Match {
    return { ...match, _detailLoaded: true, _detailVersion: MATCH_DETAIL_VERSION };
}

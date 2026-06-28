import type { Match } from '../types';
import { normalizeMatchForFrontend } from './matchNormalizer';

type DetailCapableMatch = Partial<Match> & { _detailLoaded?: boolean };

export function hasMatchDetail(match: DetailCapableMatch | null | undefined): boolean {
    if (!match) return false;
    if (match._detailLoaded) return true;
    if ((match.events?.length ?? 0) > 0) return true;
    if ((match.path?.length ?? 0) > 0) return true;
    if ((match.weaponTimeline?.length ?? 0) > 0) return true;
    return false;
}

export function mergeMatchDetail(existing: Match, detailInput: unknown): Match | null {
    const detail = normalizeMatchForFrontend(detailInput);
    if (!detail) return existing;

    return {
        ...existing,
        ...detail,
        matchId: existing.matchId,
        _detailLoaded: true,
    };
}

export function markMatchDetailLoaded(match: Match): Match {
    return { ...match, _detailLoaded: true };
}

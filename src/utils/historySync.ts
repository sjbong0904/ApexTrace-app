import { hasMatchDetail, MATCH_DETAIL_VERSION } from './matchDetail';

export const MATCH_SAVED_MESSAGE = 'apex_trace_match_saved';

export interface MatchSavedPayload {
    uid: string;
    matchId: string;
}

export const isArchiveFullySynced = (uid: string): boolean =>
    localStorage.getItem(`ARCHIVE_FULL_SYNC_${uid}`) === 'true';

export const markArchiveFullySynced = (uid: string): void => {
    localStorage.setItem(`ARCHIVE_FULL_SYNC_${uid}`, 'true');
};

export const clearArchiveSyncState = (uid: string): void => {
    localStorage.removeItem(`ARCHIVE_FULL_SYNC_${uid}`);
};

/** Fields the history helpers read; Match and stored/raw rows all fit. */
export type HistoryRow = { matchId?: unknown; startTime?: number; endTime?: number; platformId?: unknown; ownerUid?: unknown };

const matchTime = (match: { startTime?: number; endTime?: number } | null | undefined): number =>
    match?.endTime || match?.startTime || 0;

const matchRichness = (match: Record<string, unknown> | null | undefined): number => {
    if (!match) return 0;

    let score = 0;
    if (hasMatchDetail(match)) score += 1_000;
    if (match._detailLoaded) score += 500;
    // A refetch under the current detail version beats an older cached copy of the same match.
    if (Number(match._detailVersion ?? 0) >= MATCH_DETAIL_VERSION) score += 250;
    score += (Array.isArray(match.ringRounds) ? match.ringRounds.length : 0) * 5;
    score += (Array.isArray(match.events) ? match.events.length : 0) * 2;
    score += Array.isArray(match.path) ? match.path.length : 0;
    score += (Array.isArray(match.weaponTimeline) ? match.weaponTimeline.length : 0) * 3;
    return score;
};

/**
 * Ranked RP is filled server-side after the upload (GEP player_stats → /account-stats),
 * so the richer copy (local detail) often lacks it while a summary refetch has it.
 */
const carryRankedRp = <T extends object>(winner: T, other: T): T => {
    const w = winner as Record<string, unknown>;
    const o = other as Record<string, unknown>;
    if (w.rpProcessed || !o.rpProcessed) return winner;
    return { ...winner, rankScore: o.rankScore, rpChange: o.rpChange, rpProcessed: true };
};

/** Keep the richer or newer row when the same matchId appears in multiple sources. */
export const preferRicherMatch = <T extends object>(existing: T | undefined, incoming: T): T => {
    if (!existing) return incoming;

    const existingRichness = matchRichness(existing as Record<string, unknown>);
    const incomingRichness = matchRichness(incoming as Record<string, unknown>);
    let winner: T;
    let other: T;
    if (incomingRichness !== existingRichness) {
        [winner, other] = incomingRichness > existingRichness ? [incoming, existing] : [existing, incoming];
    } else {
        [winner, other] = matchTime(incoming as HistoryRow) >= matchTime(existing as HistoryRow) ? [incoming, existing] : [existing, incoming];
    }
    return carryRankedRp(winner, other);
};

export const mergeAndSortHistory = <T extends HistoryRow>(...sources: (T | null | undefined)[][]): T[] => {
    const uniqueMap = new Map<string, T>();
    for (const list of sources) {
        for (const match of list) {
            if (!match?.matchId) continue;
            const matchId = String(match.matchId);
            uniqueMap.set(matchId, preferRicherMatch(uniqueMap.get(matchId), match));
        }
    }
    return Array.from(uniqueMap.values()).sort(
        (a, b) => matchTime(b) - matchTime(a),
    );
};

/** Same keys with identical (===) values — cheap, and enough for objects rebuilt from the same parts. */
export const shallowEqualRecord = (a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return false;
    return aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key]);
};

/**
 * Background polling rebuilds the history array (and, via carryRankedRp, some match objects)
 * even when nothing changed. Reuse the previous objects — and the previous array when every
 * row is unchanged — so React skips re-rendering the whole match list on each poll.
 */
export const reuseUnchangedHistory = <T extends { matchId?: unknown }>(prev: T[], next: T[]): T[] => {
    if (prev === next) return prev;
    const prevById = new Map(prev.map((m) => [String(m?.matchId), m]));
    let allSame = prev.length === next.length;
    const out = next.map((match, i) => {
        const old = prevById.get(String(match?.matchId));
        const kept = old && shallowEqualRecord(old as Record<string, unknown>, match as Record<string, unknown>) ? old : match;
        if (kept !== prev[i]) allSame = false;
        return kept;
    });
    return allSame ? prev : out;
};

export const withLiveMatchProtection = <T extends HistoryRow>(merged: T[], prevHistory: T[], viewingUid?: string | null): T[] => {
    if (prevHistory.length === 0) return merged;

    const uniqueMap = new Map(merged.map((m) => [m.matchId, m]));
    const potentialLiveMatch = prevHistory[0];
    if (viewingUid) {
        const matchUid = potentialLiveMatch.platformId ?? potentialLiveMatch.ownerUid;
        if (matchUid && String(matchUid) !== String(viewingUid)) {
            return merged;
        }
    }
    if (!uniqueMap.has(potentialLiveMatch.matchId)) {
        // Missing times → NaN → not recent (same as before typing).
        const liveMatchTime = (potentialLiveMatch.endTime || potentialLiveMatch.startTime) ?? NaN;
        const isRecent = Date.now() - liveMatchTime < 120_000;
        if (isRecent) {
            uniqueMap.set(potentialLiveMatch.matchId, potentialLiveMatch);
        }
    }

    return Array.from(uniqueMap.values()).sort(
        (a, b) => matchTime(b) - matchTime(a),
    );
};

export const getOldestMatchTime = (matches: HistoryRow[]): number => {
    if (matches.length === 0) return Date.now();
    return Math.min(...matches.map((m) => m.startTime || m.endTime || Date.now()));
};

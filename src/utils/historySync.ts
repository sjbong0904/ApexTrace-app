import { hasMatchDetail } from './matchDetail';

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

const matchTime = (match: { startTime?: number; endTime?: number } | null | undefined): number =>
    match?.endTime || match?.startTime || 0;

const matchRichness = (match: Record<string, unknown> | null | undefined): number => {
    if (!match) return 0;

    let score = 0;
    if (hasMatchDetail(match)) score += 1_000;
    if (match._detailLoaded) score += 500;
    score += (Array.isArray(match.events) ? match.events.length : 0) * 2;
    score += Array.isArray(match.path) ? match.path.length : 0;
    score += (Array.isArray(match.weaponTimeline) ? match.weaponTimeline.length : 0) * 3;
    return score;
};

/** Keep the richer or newer row when the same matchId appears in multiple sources. */
export const preferRicherMatch = <T extends Record<string, unknown>>(existing: T | undefined, incoming: T): T => {
    if (!existing) return incoming;

    const existingRichness = matchRichness(existing);
    const incomingRichness = matchRichness(incoming);
    if (incomingRichness !== existingRichness) {
        return incomingRichness > existingRichness ? incoming : existing;
    }

    return matchTime(incoming) >= matchTime(existing) ? incoming : existing;
};

export const mergeAndSortHistory = (...sources: any[][]): any[] => {
    const uniqueMap = new Map<string, any>();
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

export const withLiveMatchProtection = (merged: any[], prevHistory: any[], viewingUid?: string | null): any[] => {
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
        const liveMatchTime = potentialLiveMatch.endTime || potentialLiveMatch.startTime;
        const isRecent = Date.now() - liveMatchTime < 120_000;
        if (isRecent) {
            uniqueMap.set(potentialLiveMatch.matchId, potentialLiveMatch);
        }
    }

    return Array.from(uniqueMap.values()).sort(
        (a, b) => matchTime(b) - matchTime(a),
    );
};

export const getOldestMatchTime = (matches: any[]): number => {
    if (matches.length === 0) return Date.now();
    return Math.min(...matches.map((m) => m.startTime || m.endTime || Date.now()));
};

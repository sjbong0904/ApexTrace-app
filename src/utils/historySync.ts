export const INITIAL_ARCHIVE_SYNC_TARGET = 100;

/** Overwolf window message id — background sends after a match is saved + prepended. */
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

export const mergeAndSortHistory = (...sources: any[][]): any[] => {
    const uniqueMap = new Map<string, any>();
    for (const list of sources) {
        for (const match of list) {
            if (match?.matchId) uniqueMap.set(match.matchId, match);
        }
    }
    return Array.from(uniqueMap.values()).sort(
        (a, b) => (b.startTime || b.endTime) - (a.startTime || a.endTime),
    );
};

export const withLiveMatchProtection = (merged: any[], prevHistory: any[]): any[] => {
    if (prevHistory.length === 0) return merged;

    const uniqueMap = new Map(merged.map((m) => [m.matchId, m]));
    const potentialLiveMatch = prevHistory[0];
    if (!uniqueMap.has(potentialLiveMatch.matchId)) {
        const matchTime = potentialLiveMatch.endTime || potentialLiveMatch.startTime;
        const isRecent = Date.now() - matchTime < 120_000;
        if (isRecent) {
            uniqueMap.set(potentialLiveMatch.matchId, potentialLiveMatch);
        }
    }

    return Array.from(uniqueMap.values()).sort(
        (a, b) => (b.startTime || b.endTime) - (a.startTime || a.endTime),
    );
};

export const getOldestMatchTime = (matches: any[]): number => {
    if (matches.length === 0) return Date.now();
    return Math.min(...matches.map((m) => m.startTime || m.endTime || Date.now()));
};

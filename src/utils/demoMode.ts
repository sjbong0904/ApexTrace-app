/**
 * First-run demo: until the in-game account is detected, the Records screen shows a sample
 * profile built from real (anonymized) matches, with Premium views unlocked, instead of an
 * empty page. It lives only in view state — the real `user` / `history` stay empty, so the
 * moment the background reports the local account (or the user searches someone), the
 * real profile replaces it through the normal flow.
 *
 * Data: src/assets/demo/demoMatches.json, built by scripts/build-demo-matches.mjs.
 */
import type { Match, User } from '../types';
import { normalizeHistoryForFrontend } from './matchNormalizer';
import { markMatchDetailLoaded } from './matchDetail';

export const DEMO_UID = 'demo';
/** Fired by the map replay when it starts playing (demo checklist listens). */
export const REPLAY_PLAYED_EVENT = 'apex-replay-played';

const RETIRED_KEY = 'demo_retired';

/** Fresh install only: no pinned profile, never saw real data, never dismissed the demo. */
export const isDemoEligible = (): boolean => {
    try {
        return localStorage.getItem(RETIRED_KEY) !== '1'
            && !localStorage.getItem('apex_pinned_uid')
            && localStorage.getItem('first_record_seen') !== '1';
    } catch {
        return false;
    }
};

/** Demo is done for this device (own account showed up, or the user closed it). */
export const retireDemo = () => {
    try { localStorage.setItem(RETIRED_KEY, '1'); } catch { /* per-device convenience */ }
};

export const reviveDemo = () => {
    try { localStorage.removeItem(RETIRED_KEY); } catch { /* per-device convenience */ }
};

type DemoFile = { player: string; rankScore: number; matches: unknown[] };

const HOUR = 3_600_000;

/** Moves every timestamp of a match (summary + detail) by `delta` ms. */
const shiftMatch = (m: Match, delta: number): Match => ({
    ...m,
    startTime: m.startTime + delta,
    endTime: m.endTime + delta,
    path: (m.path ?? []).map((p) => (typeof p.t === 'number' ? { ...p, t: p.t + delta } : p)),
    events: (m.events ?? []).map((e) => ({ ...e, timestamp: e.timestamp + delta })),
    weaponTimeline: (m.weaponTimeline ?? []).map((w) => ({ ...w, timestamp: w.timestamp + delta })),
    ringRounds: (m.ringRounds ?? []).map((r) => ({
        ...r,
        startTime: typeof r.startTime === 'number' ? r.startTime + delta : r.startTime,
        endTime: typeof r.endTime === 'number' ? r.endTime + delta : r.endTime,
        revealedAt: typeof r.revealedAt === 'number' ? r.revealedAt + delta : r.revealedAt,
        activeSamples: (r.activeSamples ?? []).map((s) => ({ ...s, t: s.t + delta })),
    })),
});

/**
 * Re-times the sample so it reads like the user's own recent sessions: the newest match
 * ended ~40 min ago, back-to-back games keep their real gaps (a few minutes where the
 * order was changed), and long breaks between sessions collapse to about half a day.
 */
const retime = (matches: Match[], now: number): Match[] => {
    // File order is the display order (newest first), not necessarily the original times.
    const sorted = matches;
    const out: Match[] = [];
    let targetEnd = now - 40 * 60_000;
    sorted.forEach((m, i) => {
        const delta = targetEnd - m.endTime;
        out.push(shiftMatch(m, delta));
        const older = sorted[i + 1];
        if (!older) return;
        const gap = m.startTime - older.endTime;
        const keptGap = gap <= 0
            ? 4 * 60_000 // reordered inside a session
            : gap < 2 * HOUR ? gap : (i % 2 === 0 ? 13 : 19) * HOUR;
        targetEnd = m.startTime + delta - keptGap;
    });
    return out;
};

export interface DemoProfile {
    user: User & { rankDiv?: number | null };
    history: Match[];
}

let cached: Promise<DemoProfile> | null = null;

export const loadDemoProfile = (): Promise<DemoProfile> => {
    // ?raw: separate lazy chunk, and tsc doesn't infer a type for ~700 KB of JSON.
    cached ??= import('../assets/demo/demoMatches.json?raw').then((mod) => {
        const file = JSON.parse(mod.default) as DemoFile;
        const history = retime(normalizeHistoryForFrontend(file.matches), Date.now())
            .map((m) => markMatchDetailLoaded(m));
        const latest = history[0];
        return {
            user: {
                uid: DEMO_UID,
                name: file.player,
                level: 287,
                prestige: 1,
                rankName: 'Platinum',
                rankDiv: 2,
                rankScore: file.rankScore,
                legend: latest?.legend ?? 'pathfinder',
                avatar: null,
                currentXp: 41_200,
                neededXp: 61_800,
            },
            history,
        };
    });
    return cached;
};

/** Season-stats payload filter, same split as the server's player_season_stats. */
export const filterDemoMatchesByMode = (
    matches: Match[],
    mode: 'ALL' | 'RANKED' | 'TRIO' | 'DUO',
): Match[] => matches.filter((m) => {
    const n = String(m.mode ?? '').toLowerCase();
    if (mode === 'ALL') return n.includes('ranked') || n.includes('trio') || n.includes('duo');
    if (mode === 'RANKED') return n.includes('ranked');
    if (mode === 'TRIO') return n.includes('trio') && !n.includes('ranked');
    return n.includes('duo') && !n.includes('ranked');
});

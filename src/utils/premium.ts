/**
 * Free → Premium funnel helpers shared across the desktop shell.
 *
 * - `openPremiumDialog()` lets any component open the compare sheet without prop drilling.
 * - Launch-notify opt-in and the free daily replay are kept per device (localStorage) until
 *   the backend tracks them; both are conveniences, not entitlements.
 */

export const PREMIUM_DIALOG_EVENT = 'apex-open-premium';
export const PREMIUM_STATE_EVENT = 'apex-premium-state';

export type PremiumSource = 'nav' | 'ads' | 'stats-lock' | 'replay' | 'sidebar';

export const openPremiumDialog = (source: PremiumSource) => {
    window.dispatchEvent(new CustomEvent(PREMIUM_DIALOG_EVENT, { detail: { source } }));
};

const notifyState = () => window.dispatchEvent(new CustomEvent(PREMIUM_STATE_EVENT));

const NOTIFY_KEY = 'premium_launch_notify';

export const isLaunchNotifyOn = (): boolean => {
    try { return localStorage.getItem(NOTIFY_KEY) === '1'; } catch { return false; }
};

export const setLaunchNotify = (on: boolean) => {
    try {
        if (on) localStorage.setItem(NOTIFY_KEY, '1');
        else localStorage.removeItem(NOTIFY_KEY);
    } catch { /* per-device convenience only */ }
    notifyState();
};

// ---- Free daily replay ------------------------------------------------------------

const REPLAY_KEY = 'free_replay_day';

interface FreeReplayRecord {
    day: string;
    matchId: string;
}

/** Local calendar day — the free replay refills at local midnight. */
const today = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const readReplayRecord = (): FreeReplayRecord | null => {
    try {
        const raw = localStorage.getItem(REPLAY_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as FreeReplayRecord;
        return parsed && typeof parsed.day === 'string' && typeof parsed.matchId === 'string' ? parsed : null;
    } catch {
        return null;
    }
};

/**
 * - `unlocked`: today's free replay was spent on this match → it stays open all day.
 * - `available`: nothing spent today.
 * - `used`: today's free replay went to another match.
 */
export type FreeReplayState = 'unlocked' | 'available' | 'used';

export const getFreeReplayState = (matchId: string): FreeReplayState => {
    const rec = readReplayRecord();
    if (!rec || rec.day !== today()) return 'available';
    return rec.matchId === matchId ? 'unlocked' : 'used';
};

/** Spends today's free replay on `matchId`. Returns false when it was already spent elsewhere. */
export const consumeFreeReplay = (matchId: string): boolean => {
    const state = getFreeReplayState(matchId);
    if (state === 'used') return false;
    if (state === 'available') {
        try {
            localStorage.setItem(REPLAY_KEY, JSON.stringify({ day: today(), matchId } satisfies FreeReplayRecord));
        } catch { /* storage blocked: still let this session watch it */ }
        notifyState();
    }
    return true;
};

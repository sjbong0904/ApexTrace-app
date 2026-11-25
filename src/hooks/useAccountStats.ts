import { useEffect, useState } from 'react';
import type { AccountStats } from '../types';

/** Live snapshot moves after each ranked match (~80s after match_end); DB copy after upload. */
const REFRESH_MS = 60_000;

/**
 * GEP player_stats account snapshot for `uid`: the background's live Store for the local
 * player, otherwise GET /account-stats (only players who have used the app have one).
 * Desktop only — returns null where the Overwolf background is unavailable (web shell).
 */
export const useAccountStats = (uid: string | null | undefined): AccountStats | null => {
    // Keyed by uid so a profile switch never shows the previous player's numbers.
    const [loaded, setLoaded] = useState<{ uid: string; data: AccountStats | null } | null>(null);

    useEffect(() => {
        if (!uid) return;
        let cancelled = false;
        const load = async () => {
            try {
                const bg = window.overwolf?.windows?.getMainWindow?.();
                const data = await bg?.apexData?.fetchAccountStats?.(uid);
                if (!cancelled) setLoaded({ uid, data: data ?? null });
            } catch {
                if (!cancelled) setLoaded({ uid, data: null });
            }
        };
        void load();
        const id = setInterval(load, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [uid]);

    return uid && loaded?.uid === uid ? loaded.data : null;
};

/** "Season 31 : Split 1" → 31. GEP seasons have no split. */
export const parseSeasonNumber = (name: string | null | undefined): number | null => {
    const m = /season\s*(\d+)/i.exec(String(name ?? ''));
    return m ? Number(m[1]) : null;
};

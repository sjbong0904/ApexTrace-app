import { useEffect, useState } from 'react';
import { APEX_GAME_ID } from '../utils/gepStatus';

/** Overwolf: is Apex running right now? Null outside Overwolf. */
export const useApexRunning = (): boolean | null => {
    const [running, setRunning] = useState<boolean | null>(null);
    useEffect(() => {
        if (typeof overwolf === 'undefined') return;
        const apply = (info?: { classId?: number; isRunning?: boolean } | null) =>
            setRunning(!!info && info.isRunning !== false && Number(info.classId) === APEX_GAME_ID);
        overwolf.games.getRunningGameInfo((info) => apply(info));
        const onUpdate = (e: overwolf.games.GameInfoUpdatedEvent) => apply(e.gameInfo ?? null);
        overwolf.games.onGameInfoUpdated.addListener(onUpdate);
        return () => overwolf.games.onGameInfoUpdated.removeListener(onUpdate);
    }, []);
    return running;
};

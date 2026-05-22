/// <reference types="vite/client" />
/// <reference types="@overwolf/types" />
import type { User, Match } from './types';

declare global {
    interface Window {
        Store: {
            user: User;
            game: {
                phase: string;
                map: string;
                mode: string;
            };
            activeMatch: Match | null;
            history: Match[];
            system: {
                localUid: string | null;
                identityState: string;
                candidates: any[] | null;
            };
        };

        apexData: {
            user: User;
            localUid: string | null;
            getHistory: () => Match[];
            getStatus: () => string;
            getIdentityState: () => { state: string; candidates: any[] | null };
            activeMatch?: Match | null;
            searchUser: (query: string, skipDb?: boolean) => Promise<any>;
            getUserDetail: (uid: string) => Promise<any>;
            lockProfile: (uid: string) => void;
            resetIdentity: () => void;
            processWorkerResult: (result: any) => Promise<void>;
        };

        overwolf: any;
        Utils: any;
        CloudRepository: any;
        APIService: any;
        MatchService: any;
        WEAPON_MAP: { [key: string]: string };
        LEGEND_MAP: { [key: string]: string };
        BG_MAP_DATA: any;
        GAME_MODE_MAP: { [key: string]: string };
        ACTION_TO_LEGEND: { [key: string]: string };
    }
}

export {};
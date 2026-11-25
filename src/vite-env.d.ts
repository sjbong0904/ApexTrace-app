/// <reference types="vite/client" />
/// <reference types="@overwolf/types" />
import type { User, Match, AccountStats, PlayerCandidate } from './types';

declare global {
    /** Profile as the background hands it to the desktop (ALS / DB): User fields, plus DB snake_case aliases. */
    type BgProfile = Omit<User, 'uid'> & {
        uid: string;
        rank_name?: string | null;
        rank_score?: number | null;
        /** Marks a profile rebuilt from UI state when the API failed. */
        _source?: string;
    };

    /** Anything the desktop can open a profile from: a search hit, favorite, recent search, teammate or pinned uid. */
    type SelectableProfile = {
        uid: string;
        name?: string;
        level?: number;
        prestige?: number;
        rankScore?: number | null;
        rank_score?: number | null;
        rankName?: string | null;
        rank_name?: string | null;
        legend?: string | null;
        avatar?: string | null;
    };

    /** Stored global_profiles row (may carry numbers as strings). */
    type StoredProfileRow = {
        level?: number | string | null;
        prestige?: number | string | null;
        rank_score?: number | string | null;
        rankScore?: number | string | null;
        rank_name?: string | null;
        rankName?: string | null;
        rank_div?: number | null;
        rankDiv?: number | null;
        legend?: string | null;
        avatar?: string | null;
    };

    type BgProfileResult =
        | { success: true; data: BgProfile; history?: unknown[] }
        | { success: false; message?: string };

    type BgSearchResult =
        | { success: true; data: BgProfile }
        | { success: false; status: 'AMBIGUOUS'; candidates: PlayerCandidate[] }
        | { success: false; status?: undefined; message?: string };

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
                candidates: PlayerCandidate[] | null;
                localUser?: { uid: string; name?: string };
            };
        };

        apexData: {
            user: User;
            localUid: string | null;
            getHistory: () => Match[];
            getStatus: () => string;
            getOverlayHealth?: () => { hookError: boolean; at?: number };
            getIdentityState: () => { state: string; candidates: PlayerCandidate[] | null };
            activeMatch?: Match | null;
            searchUser: (query: string, skipDb?: boolean) => Promise<BgSearchResult>;
            getUserDetail: (
                uid: string,
                cachedProfile?: SelectableProfile | null,
                options?: {
                    preloadedHistory?: unknown[] | Promise<unknown[]>;
                    preloadedDbInfo?: Promise<StoredProfileRow | null>;
                },
            ) => Promise<BgProfileResult>;
            /** Early history (DB) while the profile call is still running. */
            fetchUserHistory?: (uid: string) => Promise<unknown[]>;
            fetchStoredProfile?: (uid: string) => Promise<StoredProfileRow | null>;
            fetchAccountStats?: (uid: string) => Promise<AccountStats | null>;
            lockProfile: (uid: string) => void;
            resetIdentity: () => void;
            processWorkerResult: (result: unknown) => Promise<void>;
        };

        /** Only inside Overwolf (the web build runs without it). */
        overwolf?: typeof overwolf;
        /** Background helpers (plain JS); the desktop only uses APIService. */
        Utils?: unknown;
        CloudRepository?: unknown;
        APIService?: {
            getHistorySince: (uid: string, sinceMs: number) => Promise<unknown[]>;
            getHistoryPage: (uid: string, cursor: number) => Promise<unknown[]>;
        };
        MatchService?: unknown;
        /** Seasons loaded by the background's ConfigController. */
        SEASONS?: Array<{ id: number; name: string; startTime: number; endTime?: number | null }>;
        WEAPON_MAP: { [key: string]: string };
        LEGEND_MAP: { [key: string]: string };
        BG_MAP_DATA?: Record<string, import('./utils/constants').MapConfig>;
        GAME_MODE_MAP: { [key: string]: string };
        ACTION_TO_LEGEND: { [key: string]: string };
    }
}

export {};

// src/background/main.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ureuzkxyyozzzluzawwr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZXV6a3h5eW96enpsdXphd3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NjYyMDYsImV4cCI6MjA4MjM0MjIwNn0.iErYt2OhF2HYiQUVHjbCkO-c9zJPRodYpJZ2DB3WIp0";

// 3. window 객체에 할당
if (!window._supabase) {
    console.log("🔧 Initializing Supabase Client manually...");
    window._supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

console.log("🚀 Initializing Apex Trace");

const TARGET_GAME_ID = 21566;
const HOTKEYS = {
    desktop: 'toggle_desktop_window',
    inGame: 'toggle_in_game_window'
};
const isApexGame = (gameId) => (gameId === TARGET_GAME_ID || Math.floor(gameId / 10) === TARGET_GAME_ID);

window.GAME_MODE_MAP = window.GAME_MODE_MAP || {};
window.LEGEND_MAP = window.LEGEND_MAP || {};
window.WEAPON_MAP = window.WEAPON_MAP || {};
window.BG_MAP_DATA = window.BG_MAP_DATA || {};

// 0. SAFETY CHECKS
if (!window.Utils || !window.CloudRepository || !window.APIService) {
    console.error("Critical: Required modules (Utils, Repository, APIService) not loaded!");
}

const WindowController = {
    _isWindowOpen: false,
    _workerWindowId: null,
    _lastGameMonitorHandle: null,

    _normalizeMonitorHandle: (handle) => (
        handle === undefined || handle === null || handle === '' ? null : String(handle)
    ),

    _displayArea: (display) => (Number(display?.width || 0) * Number(display?.height || 0)),

    _displayMatchesHandle: (display, monitorHandle) => {
        if (!display || monitorHandle === undefined || monitorHandle === null) return false;
        const handle = String(monitorHandle);
        return [
            display.id,
            display.handle,
            display.monitorHandle,
            display.monitor_handle,
            display.name,
        ].filter((value) => value !== undefined && value !== null)
            .some((value) => String(value) === handle);
    },

    _selectSecondScreen: (displays, gameInfo) => {
        const primaryDisplay = displays.find(d => d.is_primary) || displays[0];
        const gameRunning = gameInfo && gameInfo.isRunning && isApexGame(gameInfo.classId);
        const gameMonitorHandle = gameInfo?.monitorHandle;

        if (!gameRunning) return primaryDisplay;

        const gameDisplay = displays.find((display) =>
            WindowController._displayMatchesHandle(display, gameMonitorHandle)
        );

        const nonGameDisplays = gameDisplay
            ? displays.filter((display) => display !== gameDisplay)
            : displays.filter((display) => !display.is_primary);

        return [...nonGameDisplays].sort((a, b) =>
            WindowController._displayArea(b) - WindowController._displayArea(a)
        )[0] || primaryDisplay;
    },

    _repositionDesktopIfVisible: () => {
        overwolf.windows.obtainDeclaredWindow("desktop", (res) => {
            if (res.status !== "success") return;
            const state = res.window.stateEx || res.window.state;
            const isVisible = state === "normal" || state === "maximized";
            if (isVisible) WindowController.centerWindow(res.window.id);
        });
    },

    centerWindow: (windowId) => {
        overwolf.utils.getMonitorsList((res) => {
            if (res.success && res.displays && res.displays.length > 0) {
                const displays = res.displays;

                overwolf.games.getRunningGameInfo((gameRes) => {
                    const targetDisplay = WindowController._selectSecondScreen(displays, gameRes);

                    // 현재 창의 크기를 가져와서 중앙 좌표 계산
                    overwolf.windows.obtainDeclaredWindow("desktop", (winRes) => {
                        if (winRes.success) {
                            const winWidth = winRes.window.width || 1540;
                            const winHeight = winRes.window.height || 850;

                            const centerX = targetDisplay.x + Math.round((targetDisplay.width - winWidth) / 2);
                            const centerY = targetDisplay.y + Math.round((targetDisplay.height - winHeight) / 2);

                            overwolf.windows.changePosition(windowId, centerX, Math.max(targetDisplay.y, centerY));
                        }
                    });
                });
            }
        });
    },

    toggleDeclaredWindow: (targetWindow) => {
        overwolf.windows.obtainDeclaredWindow(targetWindow, (winRes) => {
            if (winRes.status === "success") {
                const winState = winRes.window.stateEx;
                const isVisible = winState === "normal" || winState === "maximized";

                if (isVisible) {
                    overwolf.windows.hide(winRes.window.id);
                } else {
                    overwolf.windows.restore(winRes.window.id, () => {
                        if (targetWindow === "desktop") WindowController.centerWindow(winRes.window.id);
                    });
                }
            }
        });
    },

    toggleWindow: () => {
        overwolf.games.getRunningGameInfo((res) => {
            const inGame = res && res.isRunning && isApexGame(res.classId);
            WindowController.toggleDeclaredWindow(inGame ? "in_game" : "desktop");
        });
    },

    showSecondScreen: () => {
        overwolf.windows.obtainDeclaredWindow("desktop", (res) => {
            if (res.status === "success") {
                overwolf.windows.restore(res.window.id, () => {
                    WindowController._isWindowOpen = true;
                    WindowController.centerWindow(res.window.id);
                    overwolf.windows.bringToFront(res.window.id, false, () => {});
                });
            }
        });
    },

    openMainWindow: () => {
        if (WindowController._isWindowOpen) return;
        overwolf.windows.obtainDeclaredWindow("desktop", (res) => {
            if (res.status === "success") {
                overwolf.windows.restore(res.window.id, (result) => {
                    if (result.success) {
                        WindowController._isWindowOpen = true; 
                        WindowController.centerWindow(res.window.id);
                    }
                });
            }
        });
    },
    
    startWorker: () => {
        overwolf.windows.obtainDeclaredWindow("worker", (res) => {
            if (res.status === "success") {
                WindowController._workerWindowId = res.window.id;
                overwolf.windows.restore(res.window.id);
            }
        });
    },

    closeWorker: () => {
        if (WindowController._workerWindowId) {
            overwolf.windows.close(WindowController._workerWindowId);
            WindowController._workerWindowId = null;
            return;
        }

        overwolf.windows.obtainDeclaredWindow("worker", (res) => {
            if (res.status === "success") overwolf.windows.close(res.window.id);
        });
    }
};

const ConfigController = {
    init: async () => {
        console.log("🚀 [ConfigController] init() called");
        if (!window._supabase) return;
        try {
            const { data, error } = await window._supabase
                .from('game_constants')
                .select('key, value');

            if (error) throw error;
            if (!data || data.length === 0) return;

            data.forEach(({ key, value }) => {
                if (key === 'gep_features') window.GEP_FEATURES = value;
                if (key === 'platform_map') window.PLATFORM_MAP = value;
                if (key === 'proxy_base_url') window.PROXY_BASE_URL = value;
                if (key === 'junk_match_thresholds') window.JUNK_MATCH_THRESHOLDS = value;
                if (key === 'legend_map')    Object.assign(window.LEGEND_MAP, value);
                if (key === 'game_mode_map') Object.assign(window.GAME_MODE_MAP, value);
                if (key === 'map_id_map') window.MAP_ID_MAP = value;
                if (key === 'map_data')      Object.assign(window.BG_MAP_DATA, value);
                if (key === 'weapon_map')    Object.assign(window.WEAPON_MAP, value);
                if (key === 'discord_webhook_url') window.DISCORD_WEBHOOK_URL = value;
                if (key === 'maintenance_mode')    window.MAINTENANCE_MODE = value;
                if (key === 'sync_config') window.SYNC_CONFIG = value;
                if (key === 'seasons') {
                    window.SEASONS = value.map(s => ({
                        id: s.id,
                        name: s.name,
                        startTime: s.startTime ? new Date(s.startTime).getTime() : 0
                    }));
                }
            });

            console.log("✅ [ConfigController] Config loaded from DB");
        } catch (e) {
            console.error("💥 [ConfigController] Error:", e);
        }
    }
};

// 1. STORE (UI 표시용 데이터)
window.Store = {
    user: {
        uid: null,
        name: "Search for a player...", 
        level: 0,
        prestige: 0,
        rankName: "-",
        rankScore: 0,
        legend: null,
        avatar: null,
        updated_at: null
    },
    game: { phase: "OFFLINE", map: "Unknown", mode: "Unknown" },
    activeMatch: null, 
    history: [],
    preMatchRoster: [],
    pendingMatches: [],
    system: { candidates: null }
};

/** 매치 종료 업로드 큐 — startMatch가 finalize 완료 전에 세션을 덮어쓰지 않도록 함 */
const MatchLifecycle = {
    _queue: Promise.resolve(),

    enqueue(task) {
        const run = this._queue.then(() => task());
        this._queue = run.catch((e) => console.error('[MatchLifecycle]', e));
        return run;
    },

    whenIdle() {
        return this._queue;
    }
};

const GameStatePoller = {
    interval: null,
    start: () => {
        if (GameStatePoller.interval) return;
        
        GameStatePoller.interval = setInterval(() => {
            overwolf.games.events.getInfo((res) => {
                if (!res || !res.res) return;

                const info = res.res;
                const matchInfo = info.match_info || {};
                const gameInfo = info.game_info || {};
                const mapId = matchInfo.map_id || gameInfo.map_id;
                const mapNameRaw = matchInfo.map_name || gameInfo.map_name;

                if (mapId || mapNameRaw) {
                    const mapName = window.MapService
                        ? window.MapService.resolveMap(mapId, mapNameRaw)
                        : (mapNameRaw || mapId);
                    if (mapName) {
                        if (window.Store.game.map !== mapName) window.Store.game.map = mapName;
                        const am = window.Store.activeMatch;
                        if (am && (!am.map || am.map === 'Unknown')) am.map = mapName;
                    }
                }

                const rawMode = matchInfo.game_mode || matchInfo.mode_name || gameInfo.game_mode || gameInfo.mode_name;
                if (rawMode) {
                    const modeName = window.Utils ? window.Utils.normalizeMode(rawMode) : rawMode;
                    if (window.Store.game.mode !== modeName) window.Store.game.mode = modeName;
                    if (window.Store.activeMatch && window.Store.activeMatch.mode === 'Unknown') window.Store.activeMatch.mode = modeName;
                }

                if (window.Store.activeMatch) {
                    const locData = gameInfo.location || matchInfo.location;
                    if (locData) {
                        try {
                            const loc = JSON.parse(locData);
                            if (loc.x !== undefined && loc.y !== undefined) {
                                window.CoreController.updateMatch('LOCATION_UPDATE', { x: loc.x, y: loc.y, z: loc.z || 0 });
                            }
                        } catch (e) {}
                    }
                }
            });
        }, 2000);
    },
    stop: () => {
        if (GameStatePoller.interval) {
            clearInterval(GameStatePoller.interval);
            GameStatePoller.interval = null;
        }
    }
};
window.GameStatePoller = GameStatePoller;
window.MatchLifecycle = MatchLifecycle;

const PENDING_MATCHES_KEY = 'apex_trace_pending_matches';

const persistPendingMatches = () => {
    try {
        const list = window.Store.pendingMatches || [];
        localStorage.setItem(PENDING_MATCHES_KEY, JSON.stringify(list));
    } catch (e) {}
};

const loadPendingMatches = () => {
    try {
        const raw = localStorage.getItem(PENDING_MATCHES_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
            window.Store.pendingMatches = parsed;
        }
    } catch (e) {}
};

// 2. CORE CONTROLLER (비즈니스 로직)
const mapSearchCandidate = (c) => ({
    uid: String(c.uid),
    name: String(c.name || c.global?.name || 'Unknown'),
    level: (Number(c.level) || 0) + ((Number(c.prestige ?? c.levelPrestige) || 0) * 500),
    prestige: Number(c.prestige ?? c.levelPrestige) || 0,
    rankScore: Number(c.rank_score ?? c.rankScore ?? 0),
    rankName: String(c.rank_name ?? c.rankName ?? 'Unranked'),
    rankDiv: (c.rank_div ?? c.rankDiv) != null ? Number(c.rank_div ?? c.rankDiv) : null,
    updatedAt: c.updated_at ?? c.updatedAt ?? null,
    legend: c.legend ? String(c.legend) : null,
    avatar: c.avatar || null,
    role: c.role || null,
    linked_uid: c.linked_uid ?? c.linkedUid ?? null,
    rank_score: Number(c.rank_score ?? c.rankScore ?? 0),
    rank_name: String(c.rank_name ?? c.rankName ?? 'Unranked'),
    updated_at: c.updated_at ?? c.updatedAt ?? null,
});

const canUseCachedStats = (uid, cached) => {
    if (!cached || String(cached.uid) !== String(uid)) return false;
    if (cached.rank_score != null || cached.rankScore != null) return true;
    if (cached.level != null && Number(cached.level) > 0) return true;
    return !!(cached.name && cached.name !== 'Unknown');
};

const CoreController = {
    loadUserProfile: async (uid, cachedProfile = null) => {
        if (!uid) return { success: false };
        
        try {
            const useCachedStats = canUseCachedStats(uid, cachedProfile);
            const statsTask = useCachedStats
                ? Promise.resolve(cachedProfile)
                : window.APIService.fetchUserStats(uid, 'uid');

            const [apiStats, remoteHistory, dbInfo] = await Promise.all([
                statsTask,
                window.CloudRepository.fetchHistoryFile(uid),
                window.CloudRepository.fetchUserByUid
                    ? window.CloudRepository.fetchUserByUid(uid)
                    : Promise.resolve(null),
            ]);

            let finalData = apiStats;
            let source = useCachedStats ? 'CACHE' : 'API';

            if (dbInfo) {
                if (!finalData) {
                    finalData = dbInfo;
                    source = 'DB_FETCH';
                } else {
                    // 🌟 [방어 로직] ALS API 닉네임 오염 방지 (로컬 DB 우선)
                    if (dbInfo.name && dbInfo.name !== "Unknown") finalData.name = dbInfo.name;
                    if (dbInfo.role) finalData.role = dbInfo.role;
                    if (dbInfo.linked_uid && !finalData.linked_uid) finalData.linked_uid = dbInfo.linked_uid;
                }
            }

            if (!finalData && cachedProfile) {
                finalData = cachedProfile;
                source = 'DB_CACHE';
            }

            if (finalData) {
                if (!finalData.name || finalData.name.trim() === "" || finalData.name === "Unknown") {
                    if (cachedProfile && cachedProfile.name) {
                        finalData.name = cachedProfile.name;
                    } else if (window.Store.user && window.Store.user.uid == uid && window.Store.user.name !== "Search for a player...") {
                        finalData.name = window.Store.user.name;
                    }
                }
                // 🌟 [깔끔한 정제] 흩어진 스탯 필드들을 예쁜 단일 객체로 통일
                let fullRankName = window.Utils.formatFullRankName(
                    finalData.rankName || finalData.rank_name || "Unranked",
                    finalData.rankDiv ?? finalData.rank_div,
                );
                
                const normalizedUser = {
                    uid: finalData.uid,
                    name: finalData.name, 
                    level: finalData.level || 0,
                    prestige: finalData.prestige || 0,
                    rankName: fullRankName,
                    rankScore: finalData.rankScore || finalData.rank_score || 0,
                    legend: finalData.legend || null,
                    avatar: finalData.avatar || null,
                    updated_at: finalData.updated_at || null,
                    role: finalData.role || null,
                    linked_uid: finalData.linked_uid || finalData.linkedUid || null
                };

                // DB 주소록 업데이트 시 정제된 객체 전달
                if (window.CloudRepository) {
                    window.CloudRepository.updateAddressBook(normalizedUser.name, normalizedUser.uid, normalizedUser);
                    if (!useCachedStats && apiStats && window.CloudRepository.upsertDailyRankSnapshot) {
                        window.CloudRepository
                            .upsertDailyRankSnapshot(normalizedUser.uid, normalizedUser, 'als')
                            .catch((e) => console.warn('[Repository] Daily rank snapshot failed:', e));
                    }
                }
                
                // Store 업데이트 (라이브 prepend 매치 보존)
                window.Store.user = normalizedUser;
                window.Store.history = CoreController._mergeHistoryLists(window.Store.history, remoteHistory);
                window.Store.system.candidates = null;

                if (window.Store.activeMatch) {
                    const active = window.Store.activeMatch;
                    if (!active.platformId) active.platformId = normalizedUser.uid;
                    if (active.playerName === 'Unknown') active.playerName = normalizedUser.name;
                    if ((!active.legend || active.legend === 'Unknown') && normalizedUser.legend) {
                        active.legend = window.Utils?.normalizeLegend?.(normalizedUser.legend) || normalizedUser.legend;
                    }
                }
            
                console.log(`[Core] User Profile Loaded from ${source} (Name: ${window.Store.user.name}, History: ${window.Store.history.length})`);
                return { success: true, data: window.Store.user, history: window.Store.history };
            } else {
                return { success: false, message: "Failed to load user profile" };
            }
        } catch (e) { 
            console.error("Profile Load Error:", e);
            return { success: false }; 
        }
    },

    searchUser: async (query) => {
        console.log(`Searching User: ${query}`); 
        if (!query || query.trim().length < 1) return { success: false, message: "Query too short" };
        
        try {
            const candidates = await window.CloudRepository.findCandidatesByName(query);
            const totalFound = candidates ? candidates.length : 0;

            if (totalFound > 1) {
                const limitedCandidates = candidates.slice(0, 10); 
                // 🌟 [깔끔한 매핑] DB에서 온 데이터이므로 무조건 snake_case만 바라보도록 수정
                const safeCandidates = limitedCandidates.map(c => ({
                    uid: String(c.uid),
                    name: String(c.name),
                    level: (Number(c.level) || 0) + ((Number(c.prestige) || 0) * 500),
                    rankScore: Number(c.rank_score || 0),
                    rankName: String(c.rank_name || 'Unranked'),
                    rankDiv: (c.rank_div !== undefined && c.rank_div !== null) ? Number(c.rank_div) : null,
                    updatedAt: c.updated_at || null,
                    legend: c.legend ? String(c.legend) : null,
                    avatar: c.avatar || null,
                    hw: (c.hw !== undefined && c.hw !== null) ? String(c.hw) : null
                }));
                
                window.Store.system.candidates = safeCandidates;
                return { success: false, status: 'AMBIGUOUS', candidates: safeCandidates };
            }

            if (totalFound === 1) {
                return { success: true, data: mapSearchCandidate(candidates[0]) };
            }
            
            const apiStats = await window.APIService.fetchUserStats(query, 'player');
            if (apiStats) return { success: true, data: mapSearchCandidate(apiStats) };

            return { success: false, message: "Not found" };

        } catch (e) {
            console.error("Search Error:", e);
            return { success: false, message: "Search Error" };
        }
    },

    handleWorkerIdentity: async (identity) => {
        if (!identity || !identity.uid) return;
        window.Store.user.uid = identity.uid;
        window.Store.user.name = identity.name;

        if (!window.Store.system) window.Store.system = {};
        window.Store.system.localUser = { uid: identity.uid, name: identity.name };
        
        if (window.Store.user.name === "Search for a player...") {
             window.Store.user.uid = identity.uid;
             window.Store.user.name = identity.name;
        }

        if (window.Store.activeMatch) {
            const active = window.Store.activeMatch;
            if (active.platformId !== identity.uid) {
                active.platformId = identity.uid;
                active.playerName = identity.name;
                window.MatchService.updateSession(active, 'CHECK_ROSTER_AGAIN', null);
            }
            if ((!active.legend || active.legend === 'Unknown') && window.Store.user?.legend) {
                active.legend = window.Utils?.normalizeLegend?.(window.Store.user.legend) || window.Store.user.legend;
            }
        }
        
        if (window.Store.pendingMatches.length > 0) {
            const myCleanName = window.Utils.cleanName(identity.name);
            const recoverables = window.Store.pendingMatches.filter(m => 
                window.Utils.cleanName(m.playerName) === myCleanName && !m.platformId
            );

            if (recoverables.length > 0) {
                for (const match of recoverables) {
                    match.platformId = identity.uid;
                    match.playerName = identity.name;
                    await window.MatchService.finalizeAndUpload(match);
                }
                window.Store.pendingMatches = window.Store.pendingMatches.filter(m => !recoverables.includes(m));
                persistPendingMatches();
                const h = await window.CloudRepository.fetchHistoryFile(identity.uid);
                if (CoreController._shouldUpdateStoreHistory(identity.uid)) {
                    window.Store.history = CoreController._mergeHistoryLists(window.Store.history, h);
                }
            }
        }
    },

    correctPreviousMatchRP: async (currentRealRP) => {
        if (!window.Store.history || window.Store.history.length === 0) return;
        const lastMatch = window.Store.history[0];

        if (lastMatch.rpProcessed || !lastMatch.rank || lastMatch.rank.startScore === undefined) return;

        const saveUid = lastMatch.platformId || window.Store.user?.uid;
        if (!saveUid) return;

        const actualChange = currentRealRP - lastMatch.rank.startScore;
        lastMatch.rankScore = currentRealRP;
        lastMatch.rpChange = actualChange;
        lastMatch.rpProcessed = true;

        if (window.CloudRepository) {
            await window.CloudRepository.appendMatchHistory(saveUid, lastMatch);
        }
    },

    _shouldUpdateStoreHistory: (savedUid) => {
        if (!savedUid) return false;
        const viewingUid = window.Store.user?.uid;
        const localUid = window.Store.system?.localUser?.uid;
        if (!viewingUid || viewingUid === 'null') return !!localUid && String(localUid) === String(savedUid);
        return String(viewingUid) === String(savedUid)
            || (localUid && String(localUid) === String(savedUid) && String(viewingUid) === String(localUid));
    },

    _mergeHistoryLists: (localList, remoteList) => {
        const map = new Map();
        for (const m of (remoteList || [])) {
            if (m?.matchId) map.set(m.matchId, m);
        }
        for (const m of (localList || [])) {
            if (!m?.matchId) continue;
            const existing = map.get(m.matchId);
            if (!existing || (m.endTime || 0) >= (existing.endTime || 0)) {
                map.set(m.matchId, m);
            }
        }
        return Array.from(map.values()).sort(
            (a, b) => (b.startTime || b.endTime || 0) - (a.startTime || a.endTime || 0),
        );
    },

    _notifyMatchSaved: (uid, match) => {
        if (!uid || !match?.matchId) return;
        const payload = { uid: String(uid), matchId: String(match.matchId) };
        if (window.Utils?.broadcastToUiWindows) {
            window.Utils.broadcastToUiWindows('apex_trace_match_saved', payload);
        }
    },

    _prependHistory: (match, savedUid) => {
        if (!CoreController._shouldUpdateStoreHistory(savedUid)) return;
        const currentHistory = window.Store.history || [];
        if (currentHistory.some(h => h.matchId === match.matchId)) return;
        window.Store.history = [match, ...currentHistory];
        CoreController._notifyMatchSaved(savedUid, match);
    },

    _applySaveResult: (result, match) => {
        if (!window.Store.activeMatch) window.Store.preMatchRoster = [];
        if (result.saved && result.uid) CoreController._prependHistory(match, result.uid);
        else console.warn(`[Match] Not saved: ${result.reason || 'UNKNOWN'}`, {
            matchId: match?.matchId,
            playerName: match?.playerName,
            platformId: match?.platformId,
            damage: match?.damage,
            kills: match?.kills,
            durationMs: match?.endTime && match?.startTime ? match.endTime - match.startTime : undefined
        });
    },

    _isJunkMatch: (match) => {
        if (window.Utils?.hasRealMatchEvidence?.(match)) return false;

        let displacement = 99999;
        if (match.startPos && match.endPos) {
            const dx = match.endPos.x - match.startPos.x;
            const dy = match.endPos.y - match.startPos.y;
            displacement = Math.sqrt(dx * dx + dy * dy);
        }

        const duration = Date.now() - match.startTime;
        const isNoStats = (!match.damage || match.damage === 0) && (!match.kills || match.kills === 0);
        const thresholds = window.JUNK_MATCH_THRESHOLDS ?? { min_duration_ms: 120000, min_displacement: 100 };
        return isNoStats && (duration < thresholds.min_duration_ms || displacement < thresholds.min_displacement);
    },

    _queueMatchUpload: (match) => MatchLifecycle.enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (!match.teammateKills) match.teammateKills = {};

        if (!match.platformId) {
            const fallbackUser = window.Store.system?.localUser || window.Store.user;
            if (fallbackUser?.uid && fallbackUser.uid !== 'null') {
                match.platformId = fallbackUser.uid;
                match.playerName = fallbackUser.name || match.playerName;
            } else {
                if (match.playerName && match.playerName !== 'Unknown') {
                    window.Store.pendingMatches.push(match);
                    persistPendingMatches();
                    console.warn(`[Match] Deferred save until local UID is resolved: ${match.playerName}`);
                } else {
                    console.warn('[Match] Dropped match because no local UID or player name was available', {
                        matchId: match.matchId,
                        damage: match.damage,
                        kills: match.kills
                    });
                }
                return;
            }
        }

        if ((!match.map || match.map === 'Unknown') && window.Store.game.map && window.Store.game.map !== 'Unknown') {
            match.map = window.Store.game.map;
        }
        if (match.mode === 'Unknown' && window.Store.game.mode !== 'Unknown') match.mode = window.Store.game.mode;

        window.EventRouter?.ensureDeathCombatLogForPlayer?.(match);

        const result = await window.MatchService.finalizeDetached(match);
        CoreController._applySaveResult(result, match);
    }),

    /** Finalize a captured session even if it is no longer Store.activeMatch */
    finalizeMatchSession: async (match) => {
        if (!match || match._ending) return;
        if (window.Store.activeMatch === match) {
            return CoreController.endMatch();
        }

        match._ending = true;
        if (CoreController._isJunkMatch(match)) {
            console.warn('[Match] Discarded junk session', {
                matchId: match.matchId,
                ...(window.Utils?.getMatchEvidenceSummary?.(match) || {}),
            });
            if (window.MatchService?.data === match) {
                window.MatchService.isStarted = false;
                window.MatchService.data = null;
            }
            return;
        }

        return CoreController._queueMatchUpload(match);
    },

    startMatch: async (triggerData = null) => {
        if (window.Store.activeMatch) await CoreController.endMatch();
        await MatchLifecycle.whenIdle();

        window.SyncManager._hwSaved = false;
        window.SyncManager._lastRosterSize = 0;
        const currentMap = window.Store.game.map;
        const currentMode = window.Store.game.mode
        const anonymousUser = { uid: null, name: "Unknown", rankScore: 0, rankName: 'Unknown', level: 0 };

        const service = window.MatchService;
        if (!service) return;

        const newSession = service.createSession(anonymousUser);
        
        if (window.Store.game.map !== "Unknown") newSession.map = window.Store.game.map;
        if (window.Store.game.mode !== "Unknown") newSession.mode = window.Store.game.mode;

        window.Store.activeMatch = newSession;

        try {
            if (triggerData) {
                window.MatchService.updateSession(newSession, 'ROSTER_INFO', triggerData);
            }

            if (window.Store.preMatchRoster.length > 0) {
                window.Store.preMatchRoster.forEach(info => {
                    if (info) window.MatchService.updateSession(newSession, 'ROSTER_INFO', info);
                });
                window.Store.preMatchRoster = [];
            }
        } catch (e) {
            console.error("❌ Match Init Error (Handled safely):", e);
        }

        // 🌟 에러가 나든 안 나든, 워커(Worker) 스캐너는 무조건 켜지도록 보장됨!
        GameStatePoller.start();
        if (window.Utils && window.Utils.sendWorkerMessage) {
            window.Utils.sendWorkerMessage('CMD_START_SCAN', { targetName: null });
        }
    },

    updateMatch: (type, data) => {
        if (window.Store.activeMatch) {
            const match = window.Store.activeMatch;

            if (type === 'TEAMMATE_KILL') {
                if (!match.teammateKills) match.teammateKills = {}; 
                const rawName = data; 
                const cleanName = window.Utils ? window.Utils.cleanName(rawName) : rawName;
                match.teammateKills[cleanName] = (match.teammateKills[cleanName] || 0) + 1;
            }

            if (type === 'TEAMMATE' && data.name) {
                data.name = window.Utils ? window.Utils.cleanName(data.name) : data.name;
            }

            if (type === 'LOCATION_UPDATE') {
                if (!match.startPos) match.startPos = data;
                match.endPos = data;
                window.MatchService.updateSession(match, 'PATH', data);
                return;
            }

            window.MatchService.updateSession(match, type, data);
            return;
        }

        if (type === 'ROSTER_INFO') {
            const index = window.Store.preMatchRoster.findIndex(p => p.playerName === data.playerName);
            if (index !== -1) {
                window.Store.preMatchRoster[index] = data;
            } else {
                window.Store.preMatchRoster.push(data);
            }
        }
    },

    endMatch: async () => {
        const match = window.Store.activeMatch;
        if (!match || match._ending) return;
        match._ending = true;
        window.Store.activeMatch = null;
        window.Utils.sendWorkerMessage('CMD_STOP_SCAN');
        GameStatePoller.stop();

        if (CoreController._isJunkMatch(match)) {
            console.warn('[Match] Discarded junk active session', {
                matchId: match.matchId,
                ...(window.Utils?.getMatchEvidenceSummary?.(match) || {}),
            });
            if (window.MatchService?.data === match) {
                window.MatchService.isStarted = false;
                window.MatchService.data = null;
            }
            if (match.roster) {
                const rosterList = Array.isArray(match.roster) ? match.roster : Object.values(match.roster);
                if (rosterList.length > 0) rosterList.forEach(p => window.Store.preMatchRoster.push(p));
            }
            if (match.legend && match.legend !== 'Unknown') {
                window.Store.preMatchRoster.push({
                    is_local: true,
                    playerName: match.playerName || window.Store.user.name,
                    legend: match.legend,
                    platformId: match.platformId
                });
            }
            return;
        }

        return CoreController._queueMatchUpload(match);
    },
    
    addEvent: (evt) => {
        if (window.Store.activeMatch) window.MatchService.addEvent(window.Store.activeMatch, evt);
    }
};

window.CoreController = CoreController;

window.SyncManager = {
    _lastRosterUpdate: 0,
    _hwSaved: false,
    _lastRosterSize: 0,

    receiveWorkerResult: (payload) => {
        if (payload.uid && payload.source === 'roster_local') {
            CoreController.handleWorkerIdentity(payload);
        }

        if (payload.teammates && window.Store.activeMatch) {
            payload.teammates.forEach(t => {
                if (t.name) t.name = window.Utils ? window.Utils.cleanName(t.name) : t.name;
                window.MatchService.updateSession(window.Store.activeMatch, 'TEAMMATE', t);
            });
        }

        if (payload.addressBook && Array.isArray(payload.addressBook) && payload.addressBook.length > 0) {
            if (window.CloudRepository) {
                const now = Date.now();
                const syncConfig = window.SYNC_CONFIG ?? { roster_update_cooldown_ms: 300000 };
                const COOLDOWN = syncConfig.roster_update_cooldown_ms;
                const isExpired = now - window.SyncManager._lastRosterUpdate > COOLDOWN;
                const hasHw = payload.addressBook.some(u => u.hw !== null && u.hw !== undefined);
                const currentSize = payload.addressBook.length;
                const prevSize = window.SyncManager._lastRosterSize;

                // ✅ roster가 커졌으면 (더 많은 플레이어 발견) 즉시 전송
                const isGrowing = currentSize > prevSize;

                if ((!window.SyncManager._hwSaved && hasHw) || isGrowing || isExpired) {
                    window.CloudRepository.updateAddressBookBulk(payload.addressBook);
                    window.SyncManager._lastRosterSize = currentSize;
                    
                    if (hasHw) window.SyncManager._hwSaved = true;
                    if (isExpired || isGrowing) window.SyncManager._lastRosterUpdate = now;
                }
            }
        }
    }
};

// PROCESS MONITOR & BOOTSTRAP
const GameProcessMonitor = {
    _featuresRegistered: false,
    _retryTimer: null,
    
    init: () => {
        overwolf.games.onGameInfoUpdated.addListener((res) => {
            if (res && res.gameInfo) GameProcessMonitor.checkGameStatus(res.gameInfo);
        });

        overwolf.games.getRunningGameInfo((res) => {
            if (res) GameProcessMonitor.checkGameStatus(res);
        });

        GameProcessMonitor.registerFeatures();
    },

    checkGameStatus: (gameInfo) => {
        if (!gameInfo) return;

        const isApex = (gameInfo.classId === TARGET_GAME_ID) || (gameInfo.title && gameInfo.title.includes("Apex Legends"));
        const isRunning = gameInfo.isRunning;

        if (isApex && isRunning) {
            const wasOffline = window.Store.game.phase === 'OFFLINE';
            if (wasOffline) {
                window.Store.game.phase = 'LOBBY';
                WindowController.showSecondScreen();
            }
            if (!GameProcessMonitor._featuresRegistered) GameProcessMonitor.registerFeatures();

            const currentMonitorHandle = WindowController._normalizeMonitorHandle(
                gameInfo.monitorHandle ?? gameInfo.monitor_handle
            );
            if (currentMonitorHandle) {
                const previousHandle = WindowController._lastGameMonitorHandle;
                if (previousHandle !== currentMonitorHandle) {
                    WindowController._lastGameMonitorHandle = currentMonitorHandle;
                    // Only relocate when the game actually moved monitors — not on focus clicks
                    // (handle type flicker used to re-center every time the game was focused).
                    if (previousHandle) WindowController._repositionDesktopIfVisible();
                }
            }
        } else if (isApex && !isRunning) {
            if (window.Store.game.phase !== 'OFFLINE') {
                window.Store.game.phase = 'OFFLINE';
                WindowController._lastGameMonitorHandle = null;
                if (window.Store.activeMatch) window.CoreController.endMatch();
                GameProcessMonitor._featuresRegistered = false;
                
                // 🌟 게임이 꺼지면 떠있던 인게임 창을 완전히 닫습니다.
                overwolf.windows.obtainDeclaredWindow("in_game", (res) => {
                    if (res.status === "success") overwolf.windows.close(res.window.id);
                });
                
                // 이전에 작성했던 바탕화면 창(desktop) 띄우기 로직...
                console.log("Game closed. Restoring desktop window...");
                overwolf.windows.obtainDeclaredWindow("desktop", (res) => {
                    if (res.status === "success") {
                        overwolf.windows.restore(res.window.id, () => {
                            WindowController.centerWindow(res.window.id);
                        });
                    }
                });
            }
        }
    },

    registerFeatures: () => {
        if (GameProcessMonitor._featuresRegistered || GameProcessMonitor._retryTimer) return; 

        const REQUIRED_FEATURES = window.GEP_FEATURES ?? [
            'gep_internal', 'game_info', 'match_info', 'kill', 'death', 'revive',
            'me', 'roster', 'rank', 'team', 'location', 'inventory', 'kill_feed', 'match_state', 'damage'
        ];
        const RETRY_DELAY = 3000;

        overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, (res) => {
            if (res.status === 'success') {
                GameProcessMonitor._featuresRegistered = true;
                if (GameProcessMonitor._retryTimer) {
                    clearTimeout(GameProcessMonitor._retryTimer);
                    GameProcessMonitor._retryTimer = null;
                }
                overwolf.games.events.getInfo((infoRes) => {
                    if (infoRes && infoRes.res && infoRes.status === 'success') {
                        if (window.EventRouter && window.EventRouter.onInfoUpdates) {
                            window.EventRouter.onInfoUpdates({ info: infoRes.res });
                        }
                    }
                });
            } else {
                GameProcessMonitor._retryTimer = setTimeout(() => {
                    GameProcessMonitor._retryTimer = null;
                    overwolf.games.getRunningGameInfo((game) => {
                        const isRunning = game && (game.classId === TARGET_GAME_ID || game.title === "Apex Legends") && game.isRunning;
                        if (isRunning) GameProcessMonitor.registerFeatures();
                    });
                }, RETRY_DELAY);
            }
        });
    }
};

window.apexData = {
    get user() { return window.Store.user; },
    getHistory: () => window.Store.history,
    getStatus: () => window.Store.game.phase,
    getLocalUid: () => window.Store.system?.localUser?.uid ?? null,
    getIdentityState: () => ({ state: "SEARCH_MODE", candidates: window.Store.system.candidates }),
    searchUser: CoreController.searchUser,
    getUserDetail: CoreController.loadUserProfile,
    processWorkerResult: window.SyncManager.receiveWorkerResult
};

const initApp = () => {
    try {
        loadPendingMatches();
        if (window.Store.pendingMatches.length > 0 && window.Store.system?.localUser) {
            CoreController.handleWorkerIdentity(window.Store.system.localUser);
        }
        WindowController.startWorker();
        WindowController.openMainWindow();
        GameProcessMonitor.init();

        const startConfigSync = () => {
            if (window._supabase) {
                ConfigController.init();
            } else {
                setTimeout(startConfigSync, 100); 
            }
        };

        startConfigSync(); 
    } catch (e) { console.error("Init Error:", e); }
};

initApp();

overwolf.settings.hotkeys.onPressed.addListener((event) => {
    if (event.name === HOTKEYS.desktop) {
        WindowController.toggleDeclaredWindow("desktop");
        return;
    }

    if (event.name === HOTKEYS.inGame) {
        WindowController.toggleDeclaredWindow("in_game");
        return;
    }

});

overwolf.extensions.onAppLaunchTriggered.addListener(() => {
    WindowController.toggleWindow();
});

window.addEventListener('beforeunload', () => {
    if (window.Store.activeMatch) CoreController.endMatch();
    WindowController.closeWorker();
});

window.WindowController = WindowController;

if (window.EventRouter) {
    overwolf.games.events.onNewEvents.removeListener(window.EventRouter.onNewEvents);
    overwolf.games.events.onNewEvents.addListener(window.EventRouter.onNewEvents);
    overwolf.games.events.onInfoUpdates2.removeListener(window.EventRouter.onInfoUpdates);
    overwolf.games.events.onInfoUpdates2.addListener(window.EventRouter.onInfoUpdates);
}
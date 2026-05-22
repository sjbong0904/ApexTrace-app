// src/background/worker.js
console.log("👷 Worker: Roster Tracker Started (Lite Mode)");

if (typeof Utils === 'undefined') console.error("❌ Utils missing!");

const getPlatformMap = () => {
    try {
        return overwolf.windows.getMainWindow()?.PLATFORM_MAP ?? {};
    } catch(e) {
        return {};
    }
};

// 1. MAIN BRIDGE
const MainBridge = {
    reportLocalIdentity: (uid, name) => {
        try {
            const mainWindow = overwolf.windows.getMainWindow();
            if (mainWindow?.SyncManager) {
                mainWindow.SyncManager.receiveWorkerResult({
                    uid, name, source: 'roster_local'
                });
            }
        } catch (e) {}
    },

    reportTeammates: (teammates) => {
        try {
            const mainWindow = overwolf.windows.getMainWindow();
            if (mainWindow?.SyncManager) {
                mainWindow.SyncManager.receiveWorkerResult({ teammates });
            }
        } catch (e) {}
    },

    reportAddressBook: (updates) => {
        try {
            const mainWindow = overwolf.windows.getMainWindow();
            if (mainWindow?.SyncManager) {
                mainWindow.SyncManager.receiveWorkerResult({ addressBook: updates });
            }
        } catch (e) {}
    }
};

// 2. ROSTER SCANNER
const RosterScanner = {
    interval: null,
    isScanning: false,

    start: () => {
        if (RosterScanner.isScanning) return;
        RosterScanner.isScanning = true;
        RosterScanner.interval = setInterval(() => {
            overwolf.games.events.getInfo((res) => {
                if (res?.res) RosterScanner.analyze(res.res);
            });
        }, 1000);
    },

    stop: () => {
        if (RosterScanner.interval) clearInterval(RosterScanner.interval);
        RosterScanner.interval = null;
        RosterScanner.isScanning = false;
    },

    analyze: (info) => {
        const PLATFORM_MAP = getPlatformMap();
        let potentialRoster = [];
        if (info.roster) {
            potentialRoster = Object.values(info.roster);
        } else if (info.match_info) {
            for (const key in info.match_info) {
                if (key.startsWith('roster_')) potentialRoster.push(info.match_info[key]);
            }
        }

        if (potentialRoster.length === 0) return;

        const teammates = [];
        const addressBookUpdates = [];

        potentialRoster.forEach(rawPlayer => {
            try {
                const p = typeof rawPlayer === 'string' ? JSON.parse(rawPlayer) : rawPlayer;
                if (!p.name) return;

                const pName = Utils.cleanName(p.name);
                const hwId = p.platform_hw ?? null;

                // ✅ platform_hw → 플랫폼 문자열 (Origin/Steam 구분)
                const platform = (hwId !== null && hwId !== undefined)
                    ? (PLATFORM_MAP[hwId] ?? `hw_${hwId}`)  // 알 수 없는 값은 hw_숫자로 로깅
                    : null;

                // ✅ origin_id(EA) 우선, 없으면 platform_id(Steam 등)
                const originId = p.origin_id || null;
                const platformId = p.platform_id || null;
                const mainUid = originId || platformId;
                const linkedUid = (originId && platformId && originId !== platformId) ? platformId : null;

                if (mainUid) {
                    addressBookUpdates.push({
                        name: pName,
                        uid: mainUid,
                        linked_uid: linkedUid,
                        hw: hwId !== null ? String(hwId) : null,  // ✅ String으로 저장
                        platform                                    // ✅ "Origin", "Steam" 등
                    });
                }

                const isLocal = (p.is_local === true || p.is_local === "true" || p.is_local == 1);
                if (isLocal && mainUid) {
                    // ✅ 알 수 없는 hw값 발견 시 로그
                    if (hwId !== null && !PLATFORM_MAP[hwId]) {
                        console.warn(`[Worker] Unknown platform_hw: ${hwId} for ${pName}`);
                    }
                    MainBridge.reportLocalIdentity(mainUid, pName);
                }

                const isTeammate = (p.is_teammate === true || p.is_teammate === "true" || p.is_teammate == 1);
                if (isTeammate && !isLocal) {
                    teammates.push({
                        name: pName,
                        uid: mainUid,
                        legend: p.legendName || "unknown",
                        hw: hwId !== null ? String(hwId) : null,
                        platform
                    });
                }
            } catch(e) {}
        });

        if (addressBookUpdates.length > 0) {
            MainBridge.reportAddressBook(addressBookUpdates);
        }

        if (teammates.length > 0) {
            MainBridge.reportTeammates(teammates);
        }
    }
};

overwolf.windows.onMessageReceived.addListener((message) => {
    if (message.id === 'CMD_START_SCAN') RosterScanner.start();
    if (message.id === 'CMD_STOP_SCAN') RosterScanner.stop();
});
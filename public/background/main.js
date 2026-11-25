import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ureuzkxyyozzzluzawwr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZXV6a3h5eW96enpsdXphd3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NjYyMDYsImV4cCI6MjA4MjM0MjIwNn0.iErYt2OhF2HYiQUVHjbCkO-c9zJPRodYpJZ2DB3WIp0";

if (!window._supabase) {
    window._supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

const TARGET_GAME_ID = 21566;
const HOTKEYS = {
    desktop: 'toggle_desktop_window',
    inGame: 'toggle_in_game_window'
};
const isApexGame = (gameId) => (gameId === TARGET_GAME_ID || Math.floor(gameId / 10) === TARGET_GAME_ID);
const DESKTOP_BOUNDS_KEY = 'apextrace_desktop_bounds';

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

    /** Map a raw monitor handle (number or object) onto one display. Unresolved handles must not move the window. */
    _resolveDisplayByHandle: (displays, handle) => {
        if (!Array.isArray(displays) || displays.length === 0 || handle == null || handle === '') return null;
        const keys = [];
        const push = (value) => {
            if (value === undefined || value === null || value === '') return;
            keys.push(String(value));
        };
        if (typeof handle === 'object') {
            push(handle.value);
            push(handle.handle);
            push(handle.id);
            push(handle.monitorHandle);
            push(handle.monitor_handle);
            push(handle.name);
        } else {
            push(handle);
        }
        if (keys.length === 0) return null;
        return displays.find((display) =>
            keys.some((key) => WindowController._displayMatchesHandle(display, key))
        ) || null;
    },

    /**
     * Identity of a monitor, ignoring width/height.
     * Fullscreen and DPI make those numbers wobble; treating that as a new monitor
     * called changeSize and flashed the native window white.
     */
    _displayKey: (display) => {
        if (!display) return null;
        const id = display.id ?? display.handle ?? display.name;
        if (id != null && id !== '') return `id:${id}`;
        const x = Math.round((Number(display.x) || 0) / 50) * 50;
        const y = Math.round((Number(display.y) || 0) / 50) * 50;
        return `pos:${x}:${y}`;
    },

    _selectSecondScreen: (displays, gameInfo) => {
        const primaryDisplay = displays.find((d) => d.is_primary) || displays[0];
        if (!displays || displays.length <= 1) return primaryDisplay;

        const gameRunning = gameInfo && gameInfo.isRunning && isApexGame(gameInfo.classId);
        const gameMonitorHandle = gameInfo?.monitorHandle ?? gameInfo?.monitor_handle;

        const pickLargest = (list) => (
            [...list].sort((a, b) => WindowController._displayArea(b) - WindowController._displayArea(a))[0]
        );

        if (gameRunning) {
            const gameDisplay = WindowController._resolveDisplayByHandle(displays, gameMonitorHandle);

            const nonGameDisplays = gameDisplay
                ? displays.filter((display) => display !== gameDisplay)
                : displays.filter((display) => !display.is_primary);

            return pickLargest(nonGameDisplays) || primaryDisplay;
        }

        const secondaryDisplays = displays.filter((display) => !display.is_primary);
        return pickLargest(secondaryDisplays) || primaryDisplay;
    },

    _boundsDisplay: (bounds, displays) => {
        if (!bounds || !Array.isArray(displays) || displays.length === 0) return null;

        const left = Number(bounds.left);
        const top = Number(bounds.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return null;

        const width = Number(bounds.width) || 1540;
        const height = Number(bounds.height) || 850;
        const centerX = left + (width / 2);
        const centerY = top + (height / 2);

        return displays.find((display) => (
            centerX >= display.x
            && centerX < display.x + display.width
            && centerY >= display.y
            && centerY < display.y + display.height
        )) || null;
    },

    _sameDisplay: (a, b) => {
        if (!a || !b) return false;
        if (a === b) return true;
        const idA = a.id ?? a.handle ?? a.name;
        const idB = b.id ?? b.handle ?? b.name;
        if (idA != null && idB != null && String(idA) !== '' && String(idA) === String(idB)) return true;
        return Math.abs((Number(a.x) || 0) - (Number(b.x) || 0)) < 80
            && Math.abs((Number(a.y) || 0) - (Number(b.y) || 0)) < 80;
    },

    /** Work area inset — keep clear of the Windows taskbar (usually bottom). */
    _TASKBAR_INSET: 48,

    _displayWorkArea: (display) => {
        if (!display) return null;
        const inset = WindowController._TASKBAR_INSET;
        return {
            x: Number(display.x) || 0,
            y: Number(display.y) || 0,
            width: Math.max(0, Number(display.width) || 0),
            height: Math.max(0, (Number(display.height) || 0) - inset),
        };
    },

    _clampToWorkArea: (width, height, work) => {
        if (!work) {
            return {
                width: Math.floor(width),
                height: Math.floor(height),
            };
        }
        return {
            width: Math.floor(Math.min(width, work.width)),
            height: Math.floor(Math.min(height, work.height)),
        };
    },

    _centerInWorkArea: (width, height, work) => {
        if (!work) return { left: 0, top: 0 };
        const maxLeft = work.x + Math.max(0, work.width - width);
        const maxTop = work.y + Math.max(0, work.height - height);
        const left = work.x + Math.max(0, Math.round((work.width - width) / 2));
        const top = work.y + Math.max(0, Math.round((work.height - height) / 2));
        return {
            left: Math.min(Math.max(left, work.x), maxLeft),
            top: Math.min(Math.max(top, work.y), maxTop),
        };
    },

    /**
     * Native changeSize / changePosition repaint the whole window white, even when
     * the numbers did not change. Skip the call unless size or position actually moves.
     * @param {string} windowId
     * @param {object | null | undefined} current
     * @param {{ width: number, height: number, left: number, top: number }} next
     * @param {() => void} [done]
     */
    _commitBounds: (windowId, current, next, done) => {
        const finish = () => {
            if (typeof done === 'function') done();
        };
        const state = String(current?.stateEx || current?.state || '').toLowerCase();
        if (state === 'maximized') {
            finish();
            return;
        }

        const width = Math.floor(Number(next.width));
        const height = Math.floor(Number(next.height));
        const left = Math.round(Number(next.left));
        const top = Math.round(Number(next.top));
        if (![width, height, left, top].every(Number.isFinite)) {
            finish();
            return;
        }

        const hasCurrent = current
            && Number.isFinite(Number(current.width))
            && Number.isFinite(Number(current.height))
            && Number.isFinite(Number(current.left))
            && Number.isFinite(Number(current.top));
        const sizeChanged = !hasCurrent
            || Math.abs(Number(current.width) - width) > 4
            || Math.abs(Number(current.height) - height) > 4;
        const posChanged = !hasCurrent
            || Math.abs(Number(current.left) - left) > 4
            || Math.abs(Number(current.top) - top) > 4;

        if (!sizeChanged && !posChanged) {
            finish();
            return;
        }

        const move = () => {
            if (!posChanged) {
                finish();
                return;
            }
            overwolf.windows.changePosition(windowId, left, top, finish);
        };

        if (!sizeChanged) {
            move();
            return;
        }

        overwolf.windows.changeSize({
            window_id: windowId,
            width,
            height,
        }, move);
    },

    /**
     * Resize (optional preferred size) and center a window inside a display's work area.
     * @param {string} windowId
     * @param {object} display
     * @param {number} preferredWidth
     * @param {number} preferredHeight
     * @param {() => void} [done]
     * @param {object} [currentWindow] live bounds — required to skip a no-op repaint
     */
    _applySizeAndCenter: (windowId, display, preferredWidth, preferredHeight, done, currentWindow) => {
        const work = WindowController._displayWorkArea(display);
        const { width, height } = WindowController._clampToWorkArea(
            preferredWidth,
            preferredHeight,
            work,
        );
        const { left, top } = WindowController._centerInWorkArea(width, height, work);
        WindowController._commitBounds(windowId, currentWindow, { width, height, left, top }, done);
    },

    /**
     * Rescue a window that is no longer on any display.
     * A window already on a monitor is left alone: changeSize/changePosition flash a native window white.
     * Called from the desktop/in-game UI via getMainWindow().WindowController.
     */
    resizeWindowToDisplay: (windowInfo, _preferredWidth, _preferredHeight) => {
        if (!windowInfo?.id) return;
        const state = String(windowInfo.stateEx || windowInfo.state || '').toLowerCase();
        if (state === 'maximized' || state === 'minimized') return;

        WindowController._getMonitorsList((res) => {
            const displays = res.success && res.displays?.length ? res.displays : [];
            if (displays.length === 0) return;

            const boundsDisplay = WindowController._boundsDisplay({
                left: windowInfo.left,
                top: windowInfo.top,
                width: windowInfo.width,
                height: windowInfo.height,
            }, displays);
            if (boundsDisplay) return;

            overwolf.games.getRunningGameInfo((gameRes) => {
                const display = WindowController._selectSecondScreen(displays, gameRes);
                WindowController._applySizeAndCenter(
                    windowInfo.id,
                    display,
                    Number(windowInfo.width) || 1540,
                    Number(windowInfo.height) || 850,
                    undefined,
                    windowInfo,
                );
            });
        });
    },

    _repositionDesktopIfVisible: () => {
        overwolf.windows.obtainDeclaredWindow("desktop", (res) => {
            if (res.status !== "success") return;
            const windowInfo = res.window;
            if (!WindowController._isWindowVisible(windowInfo)) return;
            const state = String(windowInfo.stateEx || windowInfo.state || '').toLowerCase();
            if (state === 'maximized') return;

            WindowController._getMonitorsList((monitors) => {
                const displays = monitors.success && monitors.displays?.length ? monitors.displays : [];
                if (displays.length === 0) return;

                overwolf.games.getRunningGameInfo((gameRes) => {
                    const targetDisplay = WindowController._selectSecondScreen(displays, gameRes);
                    const currentDisplay = WindowController._boundsDisplay(windowInfo, displays);
                    // Already on that screen. Re-centering calls changeSize and flashes the window white.
                    if (WindowController._sameDisplay(currentDisplay, targetDisplay)) return;

                    WindowController._applySizeAndCenter(
                        windowInfo.id,
                        targetDisplay,
                        windowInfo.width || 1540,
                        windowInfo.height || 850,
                        undefined,
                        windowInfo,
                    );
                });
            });
        });
    },

    /**
     * Remember which display the game is on. Move the desktop window only when that
     * monitor changes. Resolution and DPI updates keep the same id and must not resize.
     */
    _noteGameMonitor: (gameInfo) => {
        const rawHandle = gameInfo?.monitorHandle ?? gameInfo?.monitor_handle;
        if (rawHandle == null || rawHandle === '') return;

        WindowController._getMonitorsList((res) => {
            const displays = res.success && res.displays?.length ? res.displays : [];
            const display = WindowController._resolveDisplayByHandle(displays, rawHandle);
            const key = WindowController._displayKey(display);
            if (!key) return;

            const previous = WindowController._lastGameMonitorHandle;
            if (previous === key) return;
            WindowController._lastGameMonitorHandle = key;
            if (previous) WindowController._repositionDesktopIfVisible();
        });
    },

    _getMonitorsList: (callback) => {
        overwolf.utils.getMonitorsList((res) => {
            if (!res?.success || !res.displays?.length) {
                console.warn('[Window] getMonitorsList failed:', res?.error || res);
            }
            callback(res);
        });
    },

    centerWindow: (windowId) => {
        WindowController._getMonitorsList((res) => {
            if (res.success && res.displays && res.displays.length > 0) {
                const displays = res.displays;

                overwolf.games.getRunningGameInfo((gameRes) => {
                    const targetDisplay = WindowController._selectSecondScreen(displays, gameRes);

                    overwolf.windows.obtainDeclaredWindow("desktop", (winRes) => {
                        if (!winRes.success) return;
                        const winWidth = winRes.window.width || 1540;
                        const winHeight = winRes.window.height || 850;
                        WindowController._applySizeAndCenter(
                            windowId,
                            targetDisplay,
                            winWidth,
                            winHeight,
                            undefined,
                            winRes.window,
                        );
                    });
                });
            }
        });
    },

    _rememberDesktopBounds: (windowInfo) => {
        if (!windowInfo) return;
        const state = String(windowInfo.stateEx || windowInfo.state || '').toLowerCase();
        // Native OS windows report invalid left/top while minimized.
        if (state === 'minimized') return;

        const left = Number(windowInfo.left);
        const top = Number(windowInfo.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;
        if (Math.abs(left) > 30000 || Math.abs(top) > 30000) return;

        try {
            localStorage.setItem(DESKTOP_BOUNDS_KEY, JSON.stringify({
                left,
                top,
                width: windowInfo.width,
                height: windowInfo.height,
            }));
        } catch (_) {
            // ignore quota / private mode
        }
    },

    _loadDesktopBounds: () => {
        try {
            const raw = localStorage.getItem(DESKTOP_BOUNDS_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    },

    _isBoundsVisibleOnDisplays: (bounds, displays) => {
        if (!bounds || !Array.isArray(displays) || displays.length === 0) return false;

        const left = Number(bounds.left);
        const top = Number(bounds.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return false;
        if (Math.abs(left) > 30000 || Math.abs(top) > 30000) return false;

        const width = Number(bounds.width) || 1540;
        const height = Number(bounds.height) || 850;
        const right = left + width;
        const bottom = top + height;
        const minVisible = 80;

        return displays.some((display) => {
            const displayRight = display.x + display.width;
            const displayBottom = display.y + display.height;
            const overlapW = Math.min(right, displayRight) - Math.max(left, display.x);
            const overlapH = Math.min(bottom, displayBottom) - Math.max(top, display.y);
            return overlapW >= minVisible && overlapH >= minVisible;
        });
    },

    /** @param {'restore' | 'center' | 'none'} placement */
    _placeDesktopWindow: (windowId, placement = 'restore') => {
        if (placement === 'none') return;

        if (placement === 'center') {
            WindowController.centerWindow(windowId);
            return;
        }

        const saved = WindowController._loadDesktopBounds();
        if (!saved) {
            WindowController.centerWindow(windowId);
            return;
        }

        WindowController._getMonitorsList((res) => {
            const displays = res.success && res.displays?.length ? res.displays : [];
            if (!WindowController._isBoundsVisibleOnDisplays(saved, displays)) {
                try {
                    localStorage.removeItem(DESKTOP_BOUNDS_KEY);
                } catch (_) {
                    // ignore
                }
                WindowController.centerWindow(windowId);
                return;
            }

            overwolf.games.getRunningGameInfo((gameRes) => {
                const preferredDisplay = WindowController._selectSecondScreen(displays, gameRes);
                const boundsDisplay = WindowController._boundsDisplay(saved, displays);

                if (
                    displays.length > 1
                    && boundsDisplay
                    && !WindowController._sameDisplay(boundsDisplay, preferredDisplay)
                ) {
                    WindowController.centerWindow(windowId);
                    return;
                }

                const display = boundsDisplay || preferredDisplay;
                const work = WindowController._displayWorkArea(display);
                const preferredW = Number(saved.width) || 1540;
                const preferredH = Number(saved.height) || 850;
                const { width, height } = WindowController._clampToWorkArea(preferredW, preferredH, work);

                let left = Number(saved.left);
                let top = Number(saved.top);
                if (work) {
                    const maxLeft = work.x + Math.max(0, work.width - width);
                    const maxTop = work.y + Math.max(0, work.height - height);
                    left = Math.min(Math.max(left, work.x), maxLeft);
                    top = Math.min(Math.max(top, work.y), maxTop);
                }

                overwolf.windows.obtainDeclaredWindow("desktop", (liveRes) => {
                    const current = liveRes.status === "success" ? liveRes.window : null;
                    WindowController._commitBounds(windowId, current, { width, height, left, top });
                });
            });
        });
    },

    _isWindowVisible: (windowInfo) => {
        const state = String(windowInfo?.stateEx || windowInfo?.state || '').toLowerCase();
        return state === 'normal' || state === 'maximized';
    },

    _readWindowState: (stateResult, windowInfo) => (
        String(stateResult?.window_state_ex || stateResult?.window_state || windowInfo?.stateEx || windowInfo?.state || '')
            .toLowerCase()
    ),

    _isWindowShownState: (state) => state === 'normal' || state === 'maximized',

    _withDeclaredWindowState: (targetWindow, handler) => {
        overwolf.windows.obtainDeclaredWindow(targetWindow, (winRes) => {
            if (winRes.status !== 'success') return;

            const windowId = winRes.window.id;
            overwolf.windows.getWindowState(windowId, (stateRes) => {
                const state = WindowController._readWindowState(stateRes, winRes.window);
                handler(windowId, state, winRes.window);
            });
        });
    },

    _showDesktopWindow: (windowId, { placement = 'restore', grabFocus = true } = {}) => {
        overwolf.windows.restore(windowId, () => {
            WindowController._isWindowOpen = true;
            WindowController._placeDesktopWindow(windowId, placement);
            overwolf.windows.bringToFront(windowId, grabFocus, () => {});
        });
    },

    _hideDesktopWindow: (windowId, windowInfo) => {
        WindowController._rememberDesktopBounds(windowInfo);
        overwolf.windows.minimize(windowId);
    },

    _showDeclaredWindow: (targetWindow, { grabFocus = targetWindow === 'desktop', desktopPlacement = 'restore' } = {}) => {
        if (targetWindow === 'desktop') {
            WindowController._withDeclaredWindowState('desktop', (windowId, state) => {
                if (WindowController._isWindowShownState(state)) {
                    // Already visible — focus only; keep current size/position.
                    WindowController._isWindowOpen = true;
                    overwolf.windows.bringToFront(windowId, grabFocus, () => {});
                    return;
                }
                WindowController._showDesktopWindow(windowId, { placement: desktopPlacement, grabFocus });
            });
            return;
        }

        overwolf.windows.obtainDeclaredWindow(targetWindow, (winRes) => {
            if (winRes.status !== 'success') return;

            const windowId = winRes.window.id;
            overwolf.windows.restore(windowId, () => {
                overwolf.windows.bringToFront(windowId, grabFocus, () => {});
            });
        });
    },

    toggleDeclaredWindow: (targetWindow) => {
        if (targetWindow === 'desktop') {
            WindowController._withDeclaredWindowState('desktop', (windowId, state, windowInfo) => {
                if (WindowController._isWindowShownState(state)) {
                    WindowController._hideDesktopWindow(windowId, windowInfo);
                    return;
                }
                WindowController._showDesktopWindow(windowId, { placement: 'restore', grabFocus: true });
            });
            return;
        }

        WindowController._withDeclaredWindowState(targetWindow, (windowId, state) => {
            if (WindowController._isWindowShownState(state)) {
                overwolf.windows.hide(windowId);
                return;
            }

            overwolf.windows.restore(windowId, () => {
                overwolf.windows.bringToFront(windowId, false, () => {});
            });
        });
    },

    toggleWindow: () => {
        overwolf.games.getRunningGameInfo((res) => {
            const inGame = res && res.isRunning && isApexGame(res.classId);
            WindowController.toggleDeclaredWindow(inGame ? "in_game" : "desktop");
        });
    },

    /** Show the right window without toggling closed (GameLaunch / install / store). */
    ensureVisibleWindow: () => {
        overwolf.games.getRunningGameInfo((res) => {
            const inGame = res && res.isRunning && isApexGame(res.classId);
            if (inGame) {
                WindowController.showSecondScreen();
            } else {
                WindowController.openMainWindow();
            }
        });
    },

    showSecondScreen: () => {
        WindowController._showDeclaredWindow('desktop', { grabFocus: true, desktopPlacement: 'restore' });
    },

    openMainWindow: () => {
        WindowController._withDeclaredWindowState('desktop', (windowId, state) => {
            const hasSavedBounds = Boolean(WindowController._loadDesktopBounds());
            const placement = hasSavedBounds ? 'restore' : 'center';

            if (WindowController._isWindowShownState(state)) {
                // Already visible — focus only; keep current size/position.
                WindowController._isWindowOpen = true;
                overwolf.windows.bringToFront(windowId, true, () => {});
                return;
            }

            WindowController._showDesktopWindow(windowId, { placement, grabFocus: true });
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
    },

    hideDesktopWindow: () => {
        overwolf.windows.obtainDeclaredWindow("desktop", (res) => {
            if (res.status !== "success") return;
            WindowController._rememberDesktopBounds(res.window);
            WindowController._isWindowOpen = false;
            overwolf.windows.close(res.window.id);
        });
    },

    quitApplication: () => {
        if (window.Store?.activeMatch && window.CoreController?.endMatch) {
            void window.CoreController.endMatch();
        }

        TrayController.destroy();
        WindowController.closeWorker();

        overwolf.windows.obtainDeclaredWindow("in_game", (res) => {
            if (res.status === "success") overwolf.windows.close(res.window.id);
        });

        overwolf.windows.obtainDeclaredWindow("desktop", (res) => {
            const closeBackground = () => {
                overwolf.windows.getCurrentWindow((bgRes) => {
                    if (bgRes.success) overwolf.windows.close(bgRes.window.id);
                });
            };

            if (res.status === "success") {
                WindowController._isWindowOpen = false;
                overwolf.windows.close(res.window.id, closeBackground);
                return;
            }

            closeBackground();
        });
    },

    requestDesktopClose: (mode) => {
        if (mode === "quit") WindowController.quitApplication();
        else WindowController.hideDesktopWindow();
    },

    initDesktopBoundsTracking: () => {
        overwolf.windows.onStateChanged.addListener((event) => {
            if (event.window_name !== 'desktop') return;
            const state = String(event.window_state_ex || event.window_state || '').toLowerCase();

            if (state === 'closed' || state === 'hidden') {
                WindowController._isWindowOpen = false;
                return;
            }

            if (state === 'normal' || state === 'maximized') {
                WindowController._isWindowOpen = true;
                overwolf.windows.obtainDeclaredWindow('desktop', (res) => {
                    if (res.status === 'success') {
                        WindowController._rememberDesktopBounds(res.window);
                    }
                });
            }
        });
    },
};

const OFFICIAL_DISCORD_URL = 'https://discord.gg/vwGVAFEYyj';

const TRAY_MENU = {
    menu_items: [
        { label: 'Open ApexTrace', id: 'tray_open' },
        { label: '-' },
        { label: 'Official Discord', id: 'tray_discord' },
        { label: 'Restart ApexTrace', id: 'tray_restart' },
        { label: '-' },
        { label: 'Quit ApexTrace', id: 'tray_quit' },
    ],
};

const TrayController = {
    _initialized: false,
    _listenersBound: false,

    init: () => {
        if (TrayController._initialized || !overwolf.os?.tray?.setMenu) return;

        overwolf.os.tray.setMenu(TRAY_MENU, (res) => {
            if (res?.success === false) {
                console.warn('Tray setMenu failed:', res);
                return;
            }
            TrayController._initialized = true;
        });

        if (!TrayController._listenersBound) {
            overwolf.os.tray.onMenuItemClicked.addListener(TrayController._onMenuItemClicked);
            overwolf.os.tray.onTrayIconClicked.addListener(TrayController._onTrayIconClicked);
            overwolf.os.tray.onTrayIconDoubleClicked.addListener(TrayController._onTrayIconDoubleClicked);
            TrayController._listenersBound = true;
        }
    },

    destroy: () => {
        if (TrayController._listenersBound && overwolf.os?.tray) {
            overwolf.os.tray.onMenuItemClicked.removeListener(TrayController._onMenuItemClicked);
            overwolf.os.tray.onTrayIconClicked.removeListener(TrayController._onTrayIconClicked);
            overwolf.os.tray.onTrayIconDoubleClicked.removeListener(TrayController._onTrayIconDoubleClicked);
            TrayController._listenersBound = false;
        }
        if (TrayController._initialized && overwolf.os?.tray?.destroy) {
            overwolf.os.tray.destroy();
        }
        TrayController._initialized = false;
    },

    _onTrayIconClicked: () => {
        WindowController.showSecondScreen();
    },

    _onTrayIconDoubleClicked: () => {
        WindowController.showSecondScreen();
    },

    _onMenuItemClicked: (event) => {
        switch (event?.item) {
            case 'tray_open':
                WindowController.showSecondScreen();
                break;
            case 'tray_discord':
                // 1-arg only — 2-arg throws on some OW clients (STORE-QA #5)
                overwolf.utils.openUrlInDefaultBrowser(OFFICIAL_DISCORD_URL);
                break;
            case 'tray_restart':
                if (window.Store?.activeMatch && window.CoreController?.endMatch) {
                    void window.CoreController.endMatch();
                }
                overwolf.extensions.relaunch();
                break;
            case 'tray_quit':
                WindowController.quitApplication();
                break;
            default:
                break;
        }
    },
};

const ConfigController = {
    init: async () => {
        if (!window._supabase) return;
        try {
            const { data, error } = await window._supabase
                .from('seasons')
                .select('id, name, start_time, end_time')
                .order('id', { ascending: false });

            if (!error && data && data.length > 0) {
                window.SEASONS = data.map(s => ({
                    id: s.id,
                    name: s.name,
                    startTime: s.start_time ? Number(s.start_time) : 0,
                    endTime: s.end_time != null ? Number(s.end_time) : null,
                }));
            }

            const { data: constants, error: constantsError } = await window._supabase
                .from('game_constants')
                .select('key, value');

            if (constantsError) throw constantsError;
            if (!constants || constants.length === 0) return;

            constants.forEach(({ key, value }) => {
                // `gep_features` (full list) is legacy: read only by <= 0.0.15. This build owns its
                // list (GEP_BASE_FEATURES); remote config can only switch features off.
                if (key === 'gep_features_disabled') {
                    window.GEP_FEATURES_DISABLED = value;
                    GameProcessMonitor.refreshFeatures?.('config');
                }
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
                if (key === 'seasons' && (!window.SEASONS || window.SEASONS.length === 0)) {
                    window.SEASONS = value.map(s => ({
                        id: s.id,
                        name: s.name,
                        startTime: s.startTime ? new Date(s.startTime).getTime() : 0,
                        endTime: s.endTime != null ? new Date(s.endTime).getTime() : null,
                    }));
                }
            });
        } catch (e) {
            console.error("[ConfigController] Error:", e);
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
    /** Last GEP coordinate of the previous session — stale-location guard for the next one. */
    lastSessionEndPos: null,
    system: { candidates: null },
    /** Overlay hook health for in-game window (surfaced on desktop/in-game UI). */
    overlayHealth: { hookError: false, at: 0 }
};

/** Session handoff queue — end/start only. Must not wait on network upload. */
const MatchLifecycle = {
    _queue: Promise.resolve(),

    enqueue(task) {
        const run = this._queue.then(() => task());
        this._queue = run.catch((e) => console.error('[MatchLifecycle]', e));
        return run;
    },
};

/** Upload / finalize queue — independent of the next match capturing. */
const MatchUploadQueue = {
    _queue: Promise.resolve(),
    /** Matches waiting for (or in) upload — GEP may reveal Firing Range only after match_end. */
    _pending: new Set(),
    /** How long after queueing we still accept a late #PL_FIRINGRANGE cancel. */
    FIRING_RANGE_CANCEL_WINDOW_MS: 15000,

    enqueue(task) {
        const run = this._queue.then(() => task());
        this._queue = run.catch((e) => console.error('[MatchUploadQueue]', e));
        return run;
    },

    track(match) {
        if (!match) return;
        match._uploadQueuedAt = Date.now();
        this._pending.add(match);
    },

    untrack(match) {
        if (!match) return;
        this._pending.delete(match);
    },

    /**
     * GEP often keeps lobby mode (#PL_TRIO) during Firing Range and only emits
     * #PL_FIRINGRANGE right after match_end — cancel that pending upload.
     */
    cancelForFiringRange() {
        const now = Date.now();
        let cancelled = 0;

        for (const match of [...this._pending]) {
            const queuedAt = match._uploadQueuedAt || 0;
            if (now - queuedAt > this.FIRING_RANGE_CANCEL_WINDOW_MS) continue;

            match._discardUpload = true;
            match.mode = 'Firing Range';
            cancelled += 1;
            window.Utils.matchLog('Cancelled pending upload (post-end Firing Range)', {
                matchId: match.matchId,
                queuedMsAgo: now - queuedAt,
            });
        }

        return cancelled;
    },

    shouldDiscard(match) {
        if (!match) return true;
        if (match._discardUpload) return true;
        if (window.Utils?.isFiringRangeMode?.(match.mode)) return true;
        if (window.Utils?.isFiringRangeMode?.(window.Store?.game?.mode)) return true;
        return false;
    },

    /**
     * False match_end races: wait briefly; if a same-squad active session appears, drop this POST.
     */
    async waitForSuspiciousEndHold(match) {
        if (!match?._continuationHold) return false;
        const holdUntil = match._uploadHoldUntil
            || (Date.now() + (window.MatchBoundary?.SUSPICIOUS_END_HOLD_MS || 75000));
        match._uploadHoldUntil = holdUntil;

        while (Date.now() < holdUntil) {
            if (this.shouldDiscard(match)) return true;
            if (window.MatchBoundary?.hasContinuationEvidence?.(match)) {
                match._discardUpload = true;
                window.Utils.matchLog('Cancelled pending upload — continuation evidence during hold', {
                    matchId: match.matchId,
                });
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return this.shouldDiscard(match);
    },
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
                        if (am && (!am.map || window.MapService?.isUnknownMap?.(am.map) || am.map === 'Unknown')) {
                            am.map = mapName;
                        }
                    }
                }

                const rawMode = matchInfo.game_mode || matchInfo.mode_name || gameInfo.game_mode || gameInfo.mode_name;
                if (rawMode) {
                    const modeName = window.Utils ? window.Utils.normalizeMode(rawMode) : rawMode;
                    if (window.Store.game.mode !== modeName) window.Store.game.mode = modeName;
                    if (window.Store.activeMatch && window.Store.activeMatch.mode === 'Unknown') window.Store.activeMatch.mode = modeName;
                    if (window.Utils?.isFiringRangeMode?.(modeName)) {
                        window.CoreController?.cancelPendingUploadForFiringRange?.();
                    }
                }

                if (window.Store.activeMatch) {
                    const locData = gameInfo.location || matchInfo.location;
                    if (locData) {
                        try {
                            const loc = JSON.parse(locData);
                            if (loc.x !== undefined && loc.y !== undefined) {
                                // Phase from the same snapshot — PATH uses it to drop pre-drop / stale coords.
                                const phase = gameInfo.phase ? String(gameInfo.phase).toLowerCase() : undefined;
                                window.CoreController.updateMatch('LOCATION_UPDATE', { x: loc.x, y: loc.y, z: loc.z || 0, phase });
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
window.MatchUploadQueue = MatchUploadQueue;

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

/**
 * Profile `level` is 1..500 within `prestige` (ALS shape). Search candidates carry
 * total level (level + prestige*500) for display; without this, re-saving them through
 * updateAddressBook stacked another prestige*500 onto global_profiles.level each time.
 */
const normalizeLevelPair = (level, prestige) => {
    const lv = Number(level) || 0;
    const pr = Number(prestige) || 0;
    if (lv <= 500) return { level: lv, prestige: pr };
    const derivedPrestige = Math.min(Math.floor((lv - 1) / 500), 3);
    return { level: ((lv - 1) % 500) + 1, prestige: Math.max(pr, derivedPrestige) };
};

/** How long a GEP-synced profile RP outranks ALS in loadUserProfile. */
const GEP_RP_PREFERRED_MS = 30 * 60 * 1000;

const totalLevelOf = (p) =>(Number(p?.prestige) || 0) * 500 + (Number(p?.level) || 0);

const canUseCachedStats = (uid, cached) => {
    if (!cached || String(cached.uid) !== String(uid)) return false;
    if (cached.rank_score != null || cached.rankScore != null) return true;
    // A bare { uid, name } (teammate click, pinned uid) has no stats to reuse: fetch ALS.
    return cached.level != null && Number(cached.level) > 0;
};

const CoreController = {
    loadUserProfile: async (uid, cachedProfile = null, options = {}) => {
        if (!uid) return { success: false };
        
        try {
            const useCachedStats = canUseCachedStats(uid, cachedProfile);
            const statsTask = useCachedStats
                ? Promise.resolve(cachedProfile)
                : window.APIService.fetchUserStats(uid, 'uid');

            const remoteHistoryTask = options.preloadedHistory !== undefined
                ? Promise.resolve(options.preloadedHistory)
                : window.CloudRepository.fetchHistoryFile(uid);

            const dbTask = options.preloadedDbInfo !== undefined
                ? Promise.resolve(options.preloadedDbInfo)
                : (window.CloudRepository.fetchUserByUid
                    ? window.CloudRepository.fetchUserByUid(uid)
                    : Promise.resolve(null));

            const [apiStats, remoteHistory, dbInfo] = await Promise.all([
                statsTask,
                remoteHistoryTask,
                dbTask,
            ]);

            let finalData = apiStats;
            let source = useCachedStats ? 'CACHE' : 'API';

            if (dbInfo) {
                if (!finalData) {
                    finalData = dbInfo;
                    source = 'DB_FETCH';
                } else {
                    // ALS nicknames can lag or collide; prefer the local address-book name.
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
                let fullRankName = window.Utils.formatFullRankName(
                    finalData.rankName || finalData.rank_name || "Unranked",
                    finalData.rankDiv ?? finalData.rank_div,
                );
                
                let levelPair = normalizeLevelPair(finalData.level, finalData.prestige);
                // Local player's own GEP player_stats (via /account-stats) is fresher than ALS.
                const gepSynced = !!dbInfo?.gep_synced_at;
                if (gepSynced) {
                    const dbPair = normalizeLevelPair(dbInfo.level, dbInfo.prestige);
                    if (totalLevelOf(dbPair) >= totalLevelOf(levelPair)) levelPair = dbPair;
                }

                const normalizedUser = {
                    uid: finalData.uid,
                    name: finalData.name,
                    level: levelPair.level,
                    prestige: levelPair.prestige,
                    rankName: fullRankName,
                    rankScore: finalData.rankScore || finalData.rank_score || 0,
                    legend: finalData.legend || null,
                    avatar: finalData.avatar || null,
                    updated_at: finalData.updated_at || null,
                    role: finalData.role || null,
                    linked_uid: finalData.linked_uid || finalData.linkedUid || null,
                    currentXp: gepSynced ? (dbInfo.current_xp ?? null) : null,
                    neededXp: gepSynced ? (dbInfo.needed_xp ?? null) : null,
                    gepSyncedAt: dbInfo?.gep_synced_at ?? null,
                };

                // Recent GEP sync (/account-stats) beats ALS RP, which lags behind a match by
                // minutes; past the window ALS may know games played while the app was off.
                const gepSyncedMs = gepSynced ? Date.parse(dbInfo.gep_synced_at) : NaN;
                const dbRp = Number(dbInfo?.rank_score);
                if (apiStats && Number.isFinite(gepSyncedMs) && Date.now() - gepSyncedMs < GEP_RP_PREFERRED_MS
                    && Number.isFinite(dbRp) && dbRp > 0) {
                    normalizedUser.rankScore = dbRp;
                }

                // Viewing the local player: in-session GEP values beat both DB and ALS.
                const localUid = window.Store.system?.localUser?.uid;
                const career = window.Store.playerStats?.player_stats_career;
                if (career && localUid && String(localUid) === String(normalizedUser.uid)) {
                    const total = Number(career.level);
                    if (Number.isFinite(total) && total > 0) {
                        const pr = Math.min(Math.floor((total - 1) / 500), 3);
                        normalizedUser.prestige = pr;
                        normalizedUser.level = total - pr * 500;
                    }
                    normalizedUser.currentXp = career.current_xp ?? normalizedUser.currentXp;
                    normalizedUser.neededXp = career.needed_xp ?? normalizedUser.neededXp;
                    const rp = Number(window.Store.playerStats?.player_stats_br_ranked_latest?.rank_score);
                    if (Number.isFinite(rp)) normalizedUser.rankScore = rp;
                }

                if (window.CloudRepository) {
                    window.CloudRepository.updateAddressBook(normalizedUser.name, normalizedUser.uid, normalizedUser);
                    if (!useCachedStats && apiStats && window.CloudRepository.upsertDailyRankSnapshot) {
                        window.CloudRepository
                            .upsertDailyRankSnapshot(normalizedUser.uid, normalizedUser, 'als')
                            .catch(() => {});
                    }
                }
                
                const remote = Array.isArray(remoteHistory) ? remoteHistory : [];
                const mergeWithLocal = CoreController._shouldUpdateStoreHistory(uid);
                window.Store.user = normalizedUser;
                window.Store.history = mergeWithLocal
                    ? CoreController._mergeHistoryLists(window.Store.history, remote)
                    : remote;
                window.Store.system.candidates = null;

                if (window.Store.activeMatch) {
                    const active = window.Store.activeMatch;
                    if (!active.platformId) active.platformId = normalizedUser.uid;
                    // Name/UID only — never invent legend from profile (Unknown > wrong pick).
                    if (active.playerName === 'Unknown') active.playerName = normalizedUser.name;
                }
            
                return { success: true, data: { ...window.Store.user }, history: window.Store.history };
            } else {
                return { success: false, message: "Failed to load user profile" };
            }
        } catch (e) { 
            console.error("Profile Load Error:", e);
            return { success: false }; 
        }
    },

    searchUser: async (query) => {
        if (!query || query.trim().length < 1) return { success: false, message: "Query too short" };
        
        try {
            const candidates = await window.CloudRepository.findCandidatesByName(query);
            const totalFound = candidates ? candidates.length : 0;

            if (totalFound > 1) {
                const limitedCandidates = candidates.slice(0, 10); 
                // Address-book rows are snake_case; do not read camelCase aliases here.
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
                    hw: (c.hw !== undefined && c.hw !== null) ? String(c.hw) : null,
                    matchType: c.matchType === 'alias' ? 'alias' : 'name'
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

        // Always record local identity (match recording / getLocalUid).
        if (!window.Store.system) window.Store.system = {};
        window.Store.system.localUser = { uid: identity.uid, name: identity.name };
        // player_stats can arrive in the lobby before identity; send what was queued.
        void window.AccountStatsSync?.flush?.();

        // Only overwrite Store.user when viewing local player or no profile is loaded.
        // Unconditional writes shared the same object with React state and snapped
        // searched profiles back to the local player during matches.
        const viewingUid = window.Store.user?.uid;
        const viewingName = window.Store.user?.name;
        const isViewingLocalOrEmpty =
            !viewingUid ||
            viewingUid === 'null' ||
            String(viewingUid) === String(identity.uid) ||
            viewingName === 'Search for a player...';

        if (isViewingLocalOrEmpty) {
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
            // Do not copy Store.user.legend — GEP legendSelect is the only trusted source.
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

    /**
     * POST /account-stats pinned a GEP RP delta on a stored match
     * (replaces the never-called ALS-based correctPreviousMatchRP).
     */
    onRemoteRpApplied: (applied) => {
        if (!applied?.matchId) return;
        const rankScore = Number(applied.rankScore);
        const rpChange = Number(applied.rpChange);
        if (!Number.isFinite(rankScore) || !Number.isFinite(rpChange)) return;
        // Ledger: the delta can land before the match reaches Store.history (still in
        // the upload queue, or POST /history answered first); _prependHistory applies it.
        const ledger = window.Store.rpByMatch || (window.Store.rpByMatch = {});
        ledger[String(applied.matchId)] = { rankScore, rpChange, at: Date.now() };
        CoreController._pruneRpLedger();
        if (!Array.isArray(window.Store.history)) return;
        const idx = window.Store.history.findIndex((m) => String(m.matchId) === String(applied.matchId));
        if (idx === -1) return;
        window.Store.history[idx] = { ...window.Store.history[idx], rankScore, rpChange, rpProcessed: true };
    },

    _pruneRpLedger: () => {
        const ledger = window.Store.rpByMatch;
        if (!ledger) return;
        const cutoff = Date.now() - 2 * 60 * 60 * 1000;
        for (const id of Object.keys(ledger)) {
            if (!(ledger[id]?.at >= cutoff)) delete ledger[id];
        }
    },

    _withLedgerRp: (match) => {
        const rp = match?.matchId ? window.Store.rpByMatch?.[String(match.matchId)] : null;
        if (!rp || match.rpProcessed) return match;
        return { ...match, rankScore: rp.rankScore, rpChange: rp.rpChange, rpProcessed: true };
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
        window.Store.history = [CoreController._withLedgerRp(match), ...currentHistory];
        CoreController._notifyMatchSaved(savedUid, match);
    },

    _applySaveResult: (result, match) => {
        if (!window.Store.activeMatch) window.Store.preMatchRoster = [];
        if (result.saved && result.uid) CoreController._prependHistory(match, result.uid);
        else window.Utils.matchLog(`Not saved: ${result.reason || 'UNKNOWN'}`, {
            matchId: match?.matchId,
            playerName: match?.playerName,
            platformId: match?.platformId,
            damage: match?.damage,
            kills: match?.kills,
            durationMs: match?.endTime && match?.startTime ? match.endTime - match.startTime : undefined
        });
    },

    _isJunkMatch: (match) => {
        if (window.Utils?.shouldDiscardHollowStatGhost?.(match)) return true;
        // Tabs/combat mismatch is kept as an incomplete record (null stats later).
        if (window.Utils?.isIncompleteTabsCombatMismatch?.(match)) return false;
        // Keepable hollow half of a split — lift kills from combat log before other junk gates.
        if (window.Utils?.isHollowStatGhost?.(match)) {
            window.Utils.backfillTabsFromCombatLog?.(match);
        }
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

    cancelPendingUploadForFiringRange: () => MatchUploadQueue.cancelForFiringRange(),

    _queueMatchUpload: (match) => {
        window.MatchBoundary?.markSuspiciousEndIfNeeded?.(match);
        MatchUploadQueue.track(match);

        return MatchUploadQueue.enqueue(async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 1500));

                if (await MatchUploadQueue.waitForSuspiciousEndHold(match)) {
                    window.Utils.matchLog('Discarded pending upload (hold/cancel)', {
                        matchId: match.matchId,
                        mode: match.mode,
                        storeMode: window.Store?.game?.mode,
                    });
                    return;
                }

                if (MatchUploadQueue.shouldDiscard(match)) {
                    window.Utils.matchLog('Discarded pending upload (Firing Range)', {
                        matchId: match.matchId,
                        mode: match.mode,
                        storeMode: window.Store?.game?.mode,
                    });
                    return;
                }

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
                            window.Utils.matchLog(`Deferred save until local UID is resolved: ${match.playerName}`);
                        } else {
                            window.Utils.matchLog('Dropped match because no local UID or player name was available', {
                                matchId: match.matchId,
                                damage: match.damage,
                                kills: match.kills
                            });
                        }
                        return;
                    }
                }

                const isUnknownMap = (m) => window.MapService?.isUnknownMap?.(m) || m === 'Unknown';
                if ((!match.map || isUnknownMap(match.map)) && window.Store.game.map && !isUnknownMap(window.Store.game.map)) {
                    match.map = window.Store.game.map;
                }
                if (match.mode === 'Unknown' && window.Store.game.mode !== 'Unknown') match.mode = window.Store.game.mode;

                if (MatchUploadQueue.shouldDiscard(match)) {
                    window.Utils.matchLog('Discarded pending upload (Firing Range)', {
                        matchId: match.matchId,
                        mode: match.mode,
                        storeMode: window.Store?.game?.mode,
                    });
                    return;
                }

                window.EventRouter?.ensureDeathCombatLogForPlayer?.(match);

                const result = await window.MatchService.finalizeDetached(match);
                CoreController._applySaveResult(result, match);
            } finally {
                MatchUploadQueue.untrack(match);
            }
        });
    },

    /** Finalize a captured session even if it is no longer Store.activeMatch */
    finalizeMatchSession: async (match) => {
        if (!match || match._ending) return;
        if (window.Store.activeMatch === match) {
            return CoreController.endMatch();
        }

        match._ending = true;
        CoreController._rememberSessionEndPos(match);
        if (CoreController._isJunkMatch(match)) {
            window.Utils.matchLog('Discarded junk session', {
                matchId: match.matchId,
                ...(window.Utils?.getMatchEvidenceSummary?.(match) || {}),
            });
            if (window.MatchService?.data === match) {
                window.MatchService.isStarted = false;
                window.MatchService.data = null;
            }
            return;
        }

        CoreController._finalizeRingAndStats(match);
        window.MatchBoundary?.rememberClosedSession?.(match);
        return CoreController._queueMatchUpload(match);
    },

    /** Verification summary for ring/player_stats capture (plans.txt GEP checks). */
    _finalizeRingAndStats: (match) => {
        try {
            const rounds = window.MatchService?.constructor?.finalizeRingRounds?.(match)
                || (Array.isArray(match.ringRounds) ? match.ringRounds : []);
            const stats = match._ringStats || { next: 0, active: 0, dupes: 0, whileDead: 0 };
            const lastPt = Array.isArray(match.path) && match.path.length > 0 ? match.path[match.path.length - 1] : null;
            const lastRound = rounds[rounds.length - 1];
            const lastActive = lastRound?.activeSamples?.[lastRound.activeSamples.length - 1] || null;
            const offS = (t) => (t ? Math.round((t - match.startTime) / 1000) : null);
            window.Utils?.ringLog?.('Match ring summary', {
                matchId: match.matchId,
                map: match.map,
                placement: match.placement,
                rounds: rounds.length,
                activeSamples: rounds.reduce((n, rd) => n + (rd.activeSamples?.length || 0), 0),
                received: stats,
                perRound: rounds.map((rd) => ({
                    round: rd.round,
                    revealedS: offS(rd.revealedAt),
                    shrinkStartS: offS(rd.startTime),
                    shrinkEndS: offS(rd.endTime),
                    samples: rd.activeSamples?.length || 0,
                    deadSamples: (rd.activeSamples || []).filter((s) => s.d).length,
                    r: rd.nextRingRadius,
                    center: rd.nextRingCenterX != null ? [rd.nextRingCenterX, rd.nextRingCenterY] : null,
                    centerSource: rd.centerSource || (rd.nextRingCenterX != null ? 'gep' : null),
                })),
                // Unit calibration: final ring center vs last path point (meters).
                lastPath: lastPt ? { x: lastPt.x, y: lastPt.y } : null,
                lastActive: lastActive ? { x: lastActive.x, y: lastActive.y, r: lastActive.r } : null,
            });

            const ps = window.Store?.playerStats;
            if (ps && match.legend && match.legend !== 'Unknown') ps.lastLegend = match.legend;
            const career = ps?.player_stats_career;
            if (career) {
                match.playerStats = {
                    ...(match.playerStats || {}),
                    level: career.level ?? null,
                    currentXp: career.current_xp ?? null,
                    neededXp: career.needed_xp ?? null,
                    totalXp: career.total_xp ?? null,
                    career,
                    brRankedLatest: ps.player_stats_br_ranked_latest || null,
                    brUnrankedLatest: ps.player_stats_br_unranked_latest || null,
                    capturedAt: ps.updatedAt,
                };
                window.Utils?.playerStatsLog?.('Match end snapshot', {
                    matchId: match.matchId,
                    level: career.level,
                    xp: `${career.current_xp}/${career.needed_xp}`,
                    xpGained: match.playerStatsStart?.totalXp != null && career.total_xp != null
                        ? career.total_xp - match.playerStatsStart.totalXp
                        : null,
                });
            }
        } catch (e) {
            console.warn('[Ring] finalize failed', e);
        }
    },

    startMatch: async (triggerData = null) => {
        // Detach previous session for upload without blocking the next capture.
        if (window.Store.activeMatch) await CoreController.endMatch();

        const anonymousUser = { uid: null, name: "Unknown", rankScore: 0, rankName: 'Unknown', level: 0 };

        const service = window.MatchService;
        if (!service) return;

        const newSession = service.createSession(anonymousUser);
        
        if (window.Store.game.map !== "Unknown") newSession.map = window.Store.game.map;
        if (window.Store.game.mode !== "Unknown") newSession.mode = window.Store.game.mode;

        if (window.MatchBoundary?.consumePendingInferredStart?.()) {
            window.MatchBoundary.markInferredBoundary(newSession, ['boundary_inferred']);
        }
        if (window.MatchBoundary?.consumePendingSquadLegendSelect?.()) {
            window.MatchBoundary.markSquadLegendSelect(newSession);
        }

        window.Store.activeMatch = newSession;

        try {
            if (triggerData) {
                window.MatchService.updateSession(newSession, 'ROSTER_INFO', triggerData);
            }

            // Seed from live GEP select slots first — preMatchRoster can be cleared by a
            // concurrent upload finish while requeue select already landed in _selectSlots.
            const selectSlots = window.MatchBoundary?._selectSlots;
            if (selectSlots && typeof selectSlots === 'object') {
                Object.values(selectSlots).forEach((info) => {
                    if (info) window.MatchService.updateSession(newSession, 'ROSTER_INFO', info);
                });
            }

            if (window.Store.preMatchRoster.length > 0) {
                window.Store.preMatchRoster.forEach(info => {
                    if (info) window.MatchService.updateSession(newSession, 'ROSTER_INFO', info);
                });
                window.Store.preMatchRoster = [];
            }
        } catch (e) {
            console.error("Match Init Error (Handled safely):", e);
        }

        // Roster scan must start even if match init failed.
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
                // Raw last reading (even while dead) — next session uses it to reject the
                // stale GEP coordinate carried over from this match (QA §5.2 이슈 B).
                match._lastSeenLoc = { x: data.x, y: data.y };
                // startPos / endPos are set by PATH only from accepted points.
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

    /** Remember where GEP last placed us so the next session can reject that stale coordinate. */
    _rememberSessionEndPos: (match) => {
        const last = match?._lastSeenLoc || match?.endPos;
        if (last && typeof last.x === 'number' && typeof last.y === 'number') {
            window.Store.lastSessionEndPos = { x: Math.round(last.x), y: Math.round(last.y), at: Date.now() };
        }
    },

    endMatch: async () => {
        const match = window.Store.activeMatch;
        if (!match || match._ending) return;
        match._ending = true;
        window.Store.activeMatch = null;
        window.Utils.sendWorkerMessage('CMD_STOP_SCAN');
        window.SyncManager.flushPendingRoster();
        GameStatePoller.stop();
        CoreController._rememberSessionEndPos(match);

        if (CoreController._isJunkMatch(match)) {
            window.Utils.matchLog('Discarded junk active session', {
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

        CoreController._finalizeRingAndStats(match);
        window.MatchBoundary?.rememberClosedSession?.(match);
        return CoreController._queueMatchUpload(match);
    },
    
    addEvent: (evt) => {
        if (window.Store.activeMatch) window.MatchService.addEvent(window.Store.activeMatch, evt);
    }
};

window.CoreController = CoreController;

window.SyncManager = {
    _sentRoster: new Map(),
    _pendingRoster: new Map(),
    _rosterFlushTimer: null,
    ROSTER_DEBOUNCE_MS: 4000,

    _rosterFingerprint: (player) => [
        String(player?.name ?? ''),
        player?.hw == null ? '' : String(player.hw),
        player?.linked_uid == null ? '' : String(player.linked_uid),
        player?.platform == null ? '' : String(player.platform),
    ].join('\0'),

    _queueRosterUpdates: (list) => {
        if (!window.CloudRepository || !Array.isArray(list) || list.length === 0) return;
        let queued = 0;
        for (const player of list) {
            if (!player?.uid) continue;
            const uid = String(player.uid);
            const fingerprint = SyncManager._rosterFingerprint(player);
            if (SyncManager._sentRoster.get(uid) === fingerprint) continue;
            SyncManager._pendingRoster.set(uid, player);
            queued += 1;
        }
        if (queued === 0 || SyncManager._rosterFlushTimer) return;
        SyncManager._rosterFlushTimer = setTimeout(() => {
            SyncManager._rosterFlushTimer = null;
            SyncManager.flushPendingRoster();
        }, SyncManager.ROSTER_DEBOUNCE_MS);
    },

    flushPendingRoster: () => {
        if (SyncManager._rosterFlushTimer) {
            clearTimeout(SyncManager._rosterFlushTimer);
            SyncManager._rosterFlushTimer = null;
        }
        if (!window.CloudRepository || SyncManager._pendingRoster.size === 0) return;
        const batch = [...SyncManager._pendingRoster.values()];
        SyncManager._pendingRoster.clear();
        for (const player of batch) {
            SyncManager._sentRoster.set(String(player.uid), SyncManager._rosterFingerprint(player));
        }
        window.CloudRepository.updateAddressBookBulk(batch);
    },

    receiveWorkerResult: (payload) => {
        if (payload.uid && payload.source === 'roster_local') {
            CoreController.handleWorkerIdentity(payload);
        }

        if (payload.teammates && window.Store.activeMatch) {
            // acceptSquadRosterEntry rejects spectated names after freeze / when squad is full.
            payload.teammates.forEach(t => {
                if (t.name) t.name = window.Utils ? window.Utils.cleanName(t.name) : t.name;
                window.MatchService.updateSession(window.Store.activeMatch, 'TEAMMATE', t);
            });
        }

        if (payload.addressBook && Array.isArray(payload.addressBook) && payload.addressBook.length > 0) {
            SyncManager._queueRosterUpdates(payload.addressBook);
        }
    }
};

// Every GEP feature this build parses. Owned by code so subscriptions ship with their
// handlers; remote config (`gep_features_disabled`) can only remove entries (kill switch).
// Apex features: https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/apex-legends
const GEP_BASE_FEATURES = [
    'gep_internal', 'game_info', 'match_info', 'match_summary', 'kill', 'death', 'revive',
    'me', 'roster', 'rank', 'team', 'location', 'inventory', 'kill_feed', 'match_state', 'damage',
    'ring', 'player_stats',
];

const compareVersions = (a, b) => {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d < 0 ? -1 : 1;
    }
    return 0;
};

/**
 * `gep_features_disabled` entries: "ring" (all versions) or
 * { "feature": "ring", "minVersion": "0.0.16", "maxVersion": "0.0.17" } (inclusive, either optional).
 * Unknown app version → ranged entries still apply (a kill switch should err on the side of off).
 */
const resolveDisabledGepFeatures = (disabled, appVersion) => {
    if (!Array.isArray(disabled)) return [];
    return disabled.map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        if (!entry || typeof entry !== 'object' || typeof entry.feature !== 'string') return null;
        if (appVersion) {
            if (entry.minVersion && compareVersions(appVersion, entry.minVersion) < 0) return null;
            if (entry.maxVersion && compareVersions(appVersion, entry.maxVersion) > 0) return null;
        }
        return entry.feature.trim();
    }).filter(Boolean);
};

const resolveGepFeatures = () => {
    const blocked = new Set(resolveDisabledGepFeatures(window.GEP_FEATURES_DISABLED, window.APP_VERSION));
    return GEP_BASE_FEATURES.filter((f) => !blocked.has(f));
};

// PROCESS MONITOR & BOOTSTRAP
const GameProcessMonitor = {
    _featuresRegistered: false,
    _retryTimer: null,
    /** Last list GEP accepted; compared on config refresh to decide whether to re-subscribe. */
    _subscribedFeatures: null,

    /** Re-subscribe when the resolved list changed after a successful registration (late config). */
    refreshFeatures: (reason) => {
        if (!GameProcessMonitor._featuresRegistered) return;
        const next = resolveGepFeatures();
        const prev = GameProcessMonitor._subscribedFeatures || [];
        if (next.length === prev.length && next.every((f) => prev.includes(f))) return;
        console.warn(`[GEP] feature list changed (${reason}) — re-subscribing ${JSON.stringify({ prev, next })}`);
        GameProcessMonitor._featuresRegistered = false;
        GameProcessMonitor.registerFeatures();
    },

    init: () => {
        overwolf.games.onGameInfoUpdated.addListener((res) => {
            GameProcessMonitor.updateOverlayHealth(res);
            if (res && res.gameInfo) GameProcessMonitor.checkGameStatus(res);
        });

        overwolf.games.getRunningGameInfo((res) => {
            // Startup poll is a real running-state read, not a focus/resolution echo.
            if (res) GameProcessMonitor.checkGameStatus({ gameInfo: res, runningChanged: true });
        });

        GameProcessMonitor.registerFeatures();
    },

    /**
     * Track Overwolf overlay input-hook failures (FPS exclusive mode).
     * GEP/desktop still work; in-game window may not receive input until restart.
     */
    updateOverlayHealth: (event) => {
        const gameInfo = event?.gameInfo;
        const isApex = gameInfo && (
            isApexGame(gameInfo.classId)
            || (gameInfo.title && String(gameInfo.title).includes('Apex Legends'))
        );

        if (!isApex || !gameInfo?.isRunning) {
            if (window.Store.overlayHealth?.hookError) {
                window.Store.overlayHealth = { hookError: false, at: Date.now() };
            }
            return;
        }

        const reasons = Array.isArray(event?.reason)
            ? event.reason
            : (typeof event?.reason === 'string' && event.reason ? [event.reason] : []);

        const detected = Boolean(event?.overlayInputHookError)
            || reasons.includes('gameOverlayInputHookFailure')
            || Boolean(gameInfo.overlayInfo?.inputFailure);

        // Latch true while Apex is running — subsequent focus events often omit the flag.
        if (detected && !window.Store.overlayHealth?.hookError) {
            console.warn('[Overlay] hookError detected', reasons, gameInfo.overlayInfo);
            window.Store.overlayHealth = { hookError: true, at: Date.now() };
        }
    },

    checkGameStatus: (event) => {
        const gameInfo = event?.gameInfo || event;
        if (!gameInfo) return;
        // Focus and resolution updates often omit isRunning or rephrase monitorHandle.
        // Acting on those used to restore/resize the desktop window and flash it white.
        const runningChanged = event?.runningChanged === true;

        const isApex = (gameInfo.classId === TARGET_GAME_ID) || (gameInfo.title && gameInfo.title.includes("Apex Legends"));
        const isRunning = gameInfo.isRunning === true;
        const isExplicitlyStopped = gameInfo.isRunning === false;
        const prevPhase = window.Store.game.phase;
        const looksOnline = prevPhase && prevPhase !== 'OFFLINE';
        const statusFlip = runningChanged && isApex && ((isRunning && !looksOnline) || (isExplicitlyStopped && looksOnline));

        if (statusFlip && window.Utils?.gepLog) {
            window.Utils.gepLog('gameInfoUpdated', {
                isApex,
                isRunning: gameInfo.isRunning ?? null,
                runningChanged,
                classId: gameInfo.classId ?? null,
                processId: gameInfo.processId ?? gameInfo.process_id ?? null,
                prevPhase,
                title: gameInfo.title || null,
            });
        }

        if (isApex && isRunning) {
            if (gameInfo.overlayInfo?.inputFailure && !window.Store.overlayHealth?.hookError) {
                console.warn('[Overlay] inputFailure on running game');
                window.Store.overlayHealth = { hookError: true, at: Date.now() };
            }
            const wasOffline = window.Store.game.phase === 'OFFLINE';
            if (wasOffline && runningChanged) {
                window.Store.game.phase = 'LOBBY';
                window.Utils?.gepLog?.('game detect → LOBBY (was OFFLINE)', {
                    processId: gameInfo.processId ?? gameInfo.process_id ?? null,
                });
                WindowController.showSecondScreen();
            }
            if (!GameProcessMonitor._featuresRegistered) GameProcessMonitor.registerFeatures();

            WindowController._noteGameMonitor(gameInfo);
        } else if (isApex && isExplicitlyStopped && runningChanged) {
            if (window.Store.overlayHealth?.hookError) {
                window.Store.overlayHealth = { hookError: false, at: Date.now() };
            }
            if (window.Store.game.phase !== 'OFFLINE') {
                window.Utils?.gepLog?.('game detect → OFFLINE (isRunning false)', {
                    prevPhase,
                    processId: gameInfo.processId ?? gameInfo.process_id ?? null,
                    hadActiveMatch: !!window.Store.activeMatch,
                    matchId: window.Store.activeMatch?.matchId ?? null,
                    featuresRegistered: !!GameProcessMonitor._featuresRegistered,
                });
                window.Store.game.phase = 'OFFLINE';
                WindowController._lastGameMonitorHandle = null;
                if (window.Store.activeMatch) window.CoreController.endMatch();
                GameProcessMonitor._featuresRegistered = false;

                overwolf.windows.obtainDeclaredWindow("in_game", (res) => {
                    if (res.status === "success") overwolf.windows.close(res.window.id);
                });
                
                // Desktop restore via shared helper so _isWindowOpen stays in sync
                WindowController._showDeclaredWindow('desktop', {
                    grabFocus: true,
                    desktopPlacement: 'restore',
                });
            }
        }
    },

    registerFeatures: () => {
        if (GameProcessMonitor._featuresRegistered || GameProcessMonitor._retryTimer) return; 

        const REQUIRED_FEATURES = resolveGepFeatures();
        const RETRY_DELAY = 3000;
        const isGepSuccess = (result) =>
            !!result && (result.success === true || result.status === 'success');

        window.Utils?.gepLog?.('setRequiredFeatures attempt', { requested: REQUIRED_FEATURES });

        overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, (res) => {
            if (isGepSuccess(res)) {
                GameProcessMonitor._featuresRegistered = true;
                GameProcessMonitor._subscribedFeatures = REQUIRED_FEATURES;
                const supported = Array.isArray(res?.supportedFeatures)
                    ? res.supportedFeatures
                    : [];
                const missing = REQUIRED_FEATURES.filter((f) => !supported.includes(f));
                const extra = supported.filter((f) => !REQUIRED_FEATURES.includes(f));
                const disabled = GEP_BASE_FEATURES.filter((f) => !REQUIRED_FEATURES.includes(f));
                // Always-on (WARN survives without the debug flag): a silently dropped feature
                // looks like "GEP sent nothing" (ring 2026-11 incident).
                if (missing.length > 0 || disabled.length > 0) {
                    console.warn(`[GEP] subscription incomplete ${JSON.stringify({ missing, disabledByConfig: disabled })}`);
                }
                window.Utils?.gepLog?.('features subscribed', {
                    requested: REQUIRED_FEATURES,
                    supported,
                    missing,
                    extra,
                    requestedCount: REQUIRED_FEATURES.length,
                    supportedCount: supported.length,
                });
                if (GameProcessMonitor._retryTimer) {
                    clearTimeout(GameProcessMonitor._retryTimer);
                    GameProcessMonitor._retryTimer = null;
                }
                overwolf.games.events.getInfo((infoRes) => {
                    if (infoRes?.res && isGepSuccess(infoRes)) {
                        const split = window.Utils?.splitGepInfoForLog?.(infoRes.res);
                        if (split?.withoutLocation) {
                            window.Utils?.gepLog?.('getInfo after features', split.withoutLocation);
                        } else if (!split?.locationOnly) {
                            window.Utils?.gepLog?.('getInfo after features', infoRes.res);
                        }
                        if (split?.locationOnly) {
                            window.Utils?.locationLog?.('getInfo after features', split.locationOnly);
                        }
                        if (window.EventRouter && window.EventRouter.onInfoUpdates) {
                            window.EventRouter.onInfoUpdates({ info: infoRes.res });
                        }
                    } else {
                        window.Utils?.gepLog?.('getInfo after features failed', infoRes);
                    }
                });
            } else {
                window.Utils?.gepLog?.('setRequiredFeatures failed — retry', {
                    requested: REQUIRED_FEATURES,
                    error: res?.error ?? null,
                    result: res,
                });
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
    getOverlayHealth: () => window.Store.overlayHealth || { hookError: false, at: 0 },
    getLocalUid: () => window.Store.system?.localUser?.uid ?? null,
    getIdentityState: () => ({ state: "SEARCH_MODE", candidates: window.Store.system.candidates }),
    searchUser: CoreController.searchUser,
    getUserDetail: CoreController.loadUserProfile,
    fetchUserHistory: (uid) => window.CloudRepository.fetchHistoryFile(uid, { view: 'summary' }),
    /** global_profiles row (snake_case) — no ALS call; used to paint a profile before ALS returns. */
    fetchStoredProfile: (uid) => window.CloudRepository.fetchUserByUid
        ? window.CloudRepository.fetchUserByUid(uid).catch(() => null)
        : Promise.resolve(null),
    fetchMatchDetail: (uid, matchId) => window.CloudRepository.fetchMatchDetail(uid, matchId),
    fetchPlayerStats: (uid, seasonId, mode) => window.APIService.getPlayerStats(uid, seasonId, mode),
    /** GEP account snapshot: live Store for the local player, DB (/account-stats) otherwise. */
    fetchAccountStats: async (uid) => {
        const localUid = window.Store.system?.localUser?.uid;
        const ps = window.Store.playerStats;
        if (uid && localUid && String(uid) === String(localUid) && ps?.player_stats_career) {
            return {
                uid: String(uid),
                gep_season: ps.player_stats_br_ranked_latest?.season ?? null,
                career: ps.player_stats_career ?? null,
                br_ranked_latest: ps.player_stats_br_ranked_latest ?? null,
                br_unranked_latest: ps.player_stats_br_unranked_latest ?? null,
                br_ranked_history: ps.player_stats_br_ranked_history ?? null,
                br_unranked_history: ps.player_stats_br_unranked_history ?? null,
                captured_at: ps.updatedAt ? new Date(ps.updatedAt).toISOString() : null,
                source: 'live',
            };
        }
        return window.CloudRepository.fetchAccountStats(uid);
    },
    processWorkerResult: window.SyncManager.receiveWorkerResult
};

const initApp = () => {
    try {
        loadPendingMatches();
        if (window.Store.pendingMatches.length > 0 && window.Store.system?.localUser) {
            CoreController.handleWorkerIdentity(window.Store.system.localUser);
        }
        try {
            // Used by version-scoped `gep_features_disabled` entries.
            overwolf.extensions.current.getManifest((manifest) => {
                window.APP_VERSION = manifest?.meta?.version || null;
            });
        } catch (e) { /* non-fatal: ranged kill-switch entries then apply to all versions */ }
        TrayController.init();
        WindowController.startWorker();
        WindowController.initDesktopBoundsTracking();
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

/** Parse onAppLaunchTriggered source from event.origin (?source=) or origin/source fields. */
const getAppLaunchSource = (event) => {
    if (!event) return '';
    if (event.source) return String(event.source).toLowerCase();

    const origin = String(event.origin || '');
    if (!origin) return '';

    try {
        const query = origin.includes('?') ? origin.slice(origin.indexOf('?') + 1) : '';
        if (query) {
            const fromQuery = new URLSearchParams(query).get('source');
            if (fromQuery) return fromQuery.toLowerCase();
        }
    } catch (_) {
        // ignore malformed origin
    }

    // Some clients pass origin as the source name itself (e.g. "urlscheme", "dock").
    if (/^[a-z0-9-]+$/i.test(origin)) return origin.toLowerCase();
    return '';
};

const APP_LAUNCH_TOGGLE_SOURCES = new Set(['dock', 'tray']);
const APP_LAUNCH_IGNORE_SOURCES = new Set(['hotkey']);

overwolf.extensions.onAppLaunchTriggered.addListener((event) => {
    const source = getAppLaunchSource(event);

    // Hotkeys are handled by overwolf.settings.hotkeys.onPressed — avoid double toggle.
    if (APP_LAUNCH_IGNORE_SOURCES.has(source)) return;

    // Dock / tray: user expects show/hide toggle while already running.
    if (APP_LAUNCH_TOGGLE_SOURCES.has(source)) {
        WindowController.toggleWindow();
        return;
    }

    // GameLaunch, after-install, startup, store, urlscheme, etc. — open/focus only.
    // Never toggle-closed: init/openMainWindow can race with gamelaunchevent.
    WindowController.ensureVisibleWindow();
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
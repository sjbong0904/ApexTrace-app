/*
 * Minimal Overwolf API stand-in for load benchmarks (injected into every frame before app code).
 * Listed members behave like a fresh desktop session with no game running; any other member is an
 * auto-stub: callable (invokes its callback with { success: false }) and exposes addListener/removeListener.
 * The harness page loads background.html in a hidden iframe; getMainWindow() returns that window,
 * as Overwolf does for the declared background window.
 */
(() => {
    if (window.overwolf) return;
    const later = (cb, value) => { if (typeof cb === 'function') setTimeout(() => cb(value), 0); };
    // The callback is the LAST function argument — auto-stub values (e.g. an enum) are callable proxies too.
    const lastFn = (args) => [...args].reverse().find((a) => typeof a === 'function');
    const withCb = (value) => (...args) => later(lastFn(args), value);

    const auto = (path) => new Proxy(function () {}, {
        get(_t, prop) {
            if (prop === 'addListener' || prop === 'removeListener') return () => {};
            if (prop === Symbol.toPrimitive || prop === 'then') return undefined;
            return auto(`${path}.${String(prop)}`);
        },
        apply(_t, _this, args) { later(lastFn(args), { success: false }); },
    });
    const merge = (path, explicit) => new Proxy(explicit, {
        get(target, prop) {
            if (prop in target) return target[prop];
            return auto(`${path}.${String(prop)}`);
        },
    });
    const event = { addListener() {}, removeListener() {} };
    const self = (name) => ({ success: true, window: { id: name, name, stateEx: 'normal', state: 'Normal', isVisible: true, width: 1600, height: 900 } });
    const frameName = () => (location.pathname.includes('background') ? 'background' : 'desktop');

    window.overwolf = merge('overwolf', {
        windows: merge('windows', {
            getMainWindow: () => {
                try { return window.top.__bgWindow || window; } catch { return window; }
            },
            getCurrentWindow: withCb(self(frameName())),
            obtainDeclaredWindow: (name, ...rest) => later(lastFn(rest), self(name)),
            getWindowState: withCb({ success: true, window_state: 'normal', window_state_ex: 'normal' }),
            onStateChanged: event,
            onMessageReceived: event,
            onAltF4Pressed: event,
        }),
        games: merge('games', {
            getRunningGameInfo: withCb(null),
            onGameInfoUpdated: event,
            onGameLaunched: event,
            events: merge('games.events', {
                setRequiredFeatures: withCb({ success: false, error: 'no game' }),
                getInfo: withCb({ success: false }),
                onNewEvents: event,
                onInfoUpdates: event,
                onInfoUpdates2: event,
                onError: event,
            }),
        }),
        settings: merge('settings', {
            hotkeys: merge('settings.hotkeys', { get: withCb({ success: true, games: {}, globals: [] }), onPressed: event, onChanged: event }),
        }),
        extensions: merge('extensions', {
            current: merge('extensions.current', { getManifest: withCb({ meta: { version: 'bench' } }) }),
            onAppLaunchTriggered: event,
        }),
        io: merge('io', {
            paths: { localAppData: 'C:/bench', documents: 'C:/bench' },
            enums: { eEncoding: { UTF8: 'UTF8' } },
        }),
        os: merge('os', { tray: merge('os.tray', { onMenuItemClicked: event, onTrayIconClicked: event, onTrayIconDoubleClicked: event }) }),
    });
})();

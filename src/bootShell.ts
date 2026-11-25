/**
 * Wires the static boot shell in index.html (shown before React renders):
 * - title bar: drag / minimize / close, so a slow or failed start never leaves an unmovable window
 * - startup failure (e.g. first launch offline, no cached language pack): connection message + retry
 *
 * No i18n here on purpose — the language pack is exactly what may have failed to load.
 */
import { getClosePreference, requestDesktopClose } from './utils/closePreference';

const byId = (id: string) => document.getElementById(id);

const withCurrentWindow = (fn: (win: overwolf.windows.WindowInfo) => void) => {
    if (typeof overwolf === 'undefined') return;
    overwolf.windows.getCurrentWindow((res) => {
        if (res.success && res.window) fn(res.window);
    });
};

/** Same close behaviour as the app's window controls: desktop follows the hide/quit preference. */
const closeCurrentWindow = () => {
    withCurrentWindow((win) => {
        if (win.name === 'desktop') requestDesktopClose(getClosePreference().action);
        else overwolf.windows.hide(win.id);
    });
};

export const initBootShell = () => {
    const bar = byId('boot-bar');
    if (!bar) return;
    bar.addEventListener('mousedown', (event) => {
        if ((event.target as HTMLElement).closest('button')) return;
        withCurrentWindow((win) => overwolf.windows.dragMove(win.id));
    });
    byId('boot-min')?.addEventListener('click', () => withCurrentWindow((win) => overwolf.windows.minimize(win.id)));
    byId('boot-close')?.addEventListener('click', closeCurrentWindow);
    if (typeof overwolf === 'undefined') {
        // Web build: no window chrome to drive.
        byId('boot-min')?.remove();
        byId('boot-close')?.remove();
    }
};

/** Startup failed before React could render: tell the user to check the connection and offer a retry. */
export const showBootError = () => {
    const message = byId('boot-message');
    if (!message) return;
    byId('boot-spinner')?.remove();
    message.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = "Can't connect to ApexTrace";
    title.style.cssText = 'font-size:15px;font-weight:700;color:#e6e9ec;margin-bottom:6px';
    const detail = document.createElement('div');
    detail.textContent = 'Please check your internet connection and try again. ApexTrace needs to be online to load your match history.';
    message.append(title, detail);

    const retry = byId('boot-retry');
    if (retry) {
        retry.style.display = 'inline-block';
        retry.addEventListener('click', () => window.location.reload());
    }
    // Back online → retry on its own.
    window.addEventListener('online', () => window.location.reload(), { once: true });
};

export type CloseAction = 'hide' | 'quit';

const DONT_ASK_KEY = 'apextrace_close_dont_ask';
const ACTION_KEY = 'apextrace_close_action';

export const getClosePreference = (): { dontAsk: boolean; action: CloseAction } => {
    const dontAsk = localStorage.getItem(DONT_ASK_KEY) === '1';
    const action = localStorage.getItem(ACTION_KEY) === 'quit' ? 'quit' : 'hide';
    return { dontAsk, action };
};

export const saveClosePreference = (action: CloseAction, dontAsk: boolean) => {
    localStorage.setItem(ACTION_KEY, action);
    localStorage.setItem(DONT_ASK_KEY, dontAsk ? '1' : '0');
};

export type BackgroundWindow = typeof window & {
    WindowController?: {
        requestDesktopClose?: (mode: CloseAction) => void;
    };
};

export const requestDesktopClose = (action: CloseAction) => {
    if (typeof overwolf === 'undefined') return;
    const bg = overwolf.windows.getMainWindow() as BackgroundWindow;
    bg?.WindowController?.requestDesktopClose?.(action);
};

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import AppDialog from '../components/AppDialog';

/**
 * Open a link in the default browser. OW QA: in the in-game window links must open in Overwolf's
 * browser or after the user agrees, so there we ask first; the desktop window opens straight away.
 * Same rule as Settings' `openExternal`. Render `dialog` somewhere in the caller.
 */
export const useOpenExternal = () => {
    const { t } = useTranslation();
    const [inGameWindow, setInGameWindow] = useState(false);
    const [pendingUrl, setPendingUrl] = useState<string | null>(null);

    useEffect(() => {
        if (typeof overwolf === 'undefined' || !overwolf.windows?.getCurrentWindow) return;
        overwolf.windows.getCurrentWindow((res) => {
            if (res.success && res.window) setInGameWindow(res.window.name === 'in_game');
        });
    }, []);

    const openNow = (url: string) => {
        // OW runtime: 1-arg only (STORE-QA #5 — 2-arg throws in desktop.html.2.log)
        if (typeof overwolf !== 'undefined' && typeof overwolf.utils?.openUrlInDefaultBrowser === 'function') {
            overwolf.utils.openUrlInDefaultBrowser(url);
            return;
        }
        window.open(url, '_blank', 'noopener');
    };

    const openExternal = (url: string) => {
        if (inGameWindow) setPendingUrl(url);
        else openNow(url);
    };

    // Portaled: callers can sit inside clipped / transformed containers (the match accordion).
    const dialog: ReactNode = pendingUrl == null ? null : createPortal(
        <AppDialog
            open={pendingUrl != null}
            mode="confirm"
            title={t('settings.externalLink.title', { defaultValue: 'Open in your browser?' })}
            message={t('settings.externalLink.message', { defaultValue: 'This opens your web browser outside the game.' })}
            detail={pendingUrl ?? undefined}
            onCancel={() => setPendingUrl(null)}
            onConfirm={() => {
                const url = pendingUrl;
                setPendingUrl(null);
                if (url) openNow(url);
            }}
        />,
        document.body,
    );

    return { openExternal, dialog };
};

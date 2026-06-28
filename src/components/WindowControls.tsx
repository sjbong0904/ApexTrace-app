import React, { useState, useEffect } from 'react';
import { FaWindowMinimize, FaWindowMaximize, FaWindowRestore, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { c } from '../theme';
import CloseConfirmDialog from './CloseConfirmDialog';
import {
    getClosePreference,
    requestDesktopClose,
    saveClosePreference,
    type CloseAction,
} from '../utils/closePreference';

const getCurrentWindow = (): Promise<any> =>
    new Promise((resolve) => overwolf.windows.getCurrentWindow((r) => resolve(r.window)));

const WindowControls = () => {
    const { t } = useTranslation();
    const [isMaximized, setIsMaximized] = useState(false);
    const [showCloseDialog, setShowCloseDialog] = useState(false);

    useEffect(() => {
        overwolf.windows.getCurrentWindow((result) => {
            if (result.success) {
                setIsMaximized(
                    result.window.stateEx === 'maximized' ||
                    result.window.state === 'Maximized'
                );
            }
        });

        const onWindowStateChanged = (state: any) => {
            if (state.window_state_ex === 'maximized') setIsMaximized(true);
            else if (state.window_state_ex === 'normal') setIsMaximized(false);
        };

        overwolf.windows.onStateChanged.addListener(onWindowStateChanged);
        return () => overwolf.windows.onStateChanged.removeListener(onWindowStateChanged);
    }, []);

    const handleMinimize = async () => {
        const win = await getCurrentWindow();
        overwolf.windows.minimize(win.id);
    };

    const handleToggleMaximize = async () => {
        const win = await getCurrentWindow();
        isMaximized ? overwolf.windows.restore(win.id) : overwolf.windows.maximize(win.id);
    };

    const performClose = (action: CloseAction) => {
        requestDesktopClose(action);
    };

    const handleClose = () => {
        const { dontAsk, action } = getClosePreference();
        if (dontAsk) {
            performClose(action);
            return;
        }
        setShowCloseDialog(true);
    };

    const handleCloseConfirm = (action: CloseAction, dontAskAgain: boolean) => {
        if (dontAskAgain) saveClosePreference(action, true);
        setShowCloseDialog(false);
        performClose(action);
    };

    const btnStyle: React.CSSProperties = {
        background: 'transparent', border: 'none', color: c.textMuted,
        width: '45px', height: '100%', cursor: 'pointer', fontSize: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s', outline: 'none',
    };

    return (
        <>
            <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag', zIndex: 9999 } as any}>
                <button
                    onClick={handleMinimize}
                    style={btnStyle}
                    title={t('controls.minimize')}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                >
                    <FaWindowMinimize size={10} style={{ marginBottom: '5px' }} />
                </button>

                <button
                    onClick={handleToggleMaximize}
                    style={btnStyle}
                    title={isMaximized ? t('controls.restore') : t('controls.maximize')}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                >
                    {isMaximized ? <FaWindowRestore size={11} /> : <FaWindowMaximize size={11} />}
                </button>

                <button
                    onClick={handleClose}
                    style={btnStyle}
                    title={t('controls.close')}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                >
                    <FaTimes size={15} />
                </button>
            </div>

            {showCloseDialog && (
                <CloseConfirmDialog
                    onConfirm={handleCloseConfirm}
                    onCancel={() => setShowCloseDialog(false)}
                />
            )}
        </>
    );
};

export default WindowControls;

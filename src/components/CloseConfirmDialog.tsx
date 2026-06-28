import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CloseAction } from '../utils/closePreference';

interface CloseConfirmDialogProps {
    onConfirm: (action: CloseAction, dontAskAgain: boolean) => void;
    onCancel: () => void;
}

const CloseConfirmDialog: React.FC<CloseConfirmDialogProps> = ({ onConfirm, onCancel }) => {
    const { t } = useTranslation();
    const [action, setAction] = useState<CloseAction>('hide');
    const [dontAskAgain, setDontAskAgain] = useState(false);

    const optionStyle = (selected: boolean): React.CSSProperties => ({
        display: 'flex',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '8px',
        border: `1px solid ${selected ? 'var(--color-warning)' : 'var(--color-border)'}`,
        background: selected ? 'color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-card))' : 'var(--color-bg-card)',
        cursor: 'pointer',
        textAlign: 'left',
    });

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                backgroundColor: 'rgba(0, 0, 0, 0.78)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
            }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="close-dialog-title"
                style={{
                    width: 'min(440px, calc(100vw - 32px))',
                    background: 'var(--color-bg-sub-header)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border-light)',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div style={{ padding: '20px 22px 0' }}>
                    <h3 id="close-dialog-title" style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 800 }}>
                        {t('controls.closeDialog.title', { defaultValue: 'Close ApexTrace?' })}
                    </h3>
                    <p style={{ margin: '10px 0 0', color: 'var(--color-text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
                        {t('controls.closeDialog.description', { defaultValue: 'Choose whether to hide the window or quit the app completely.' })}
                    </p>
                </div>

                <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={optionStyle(action === 'hide')}>
                        <input
                            type="radio"
                            name="close-action"
                            checked={action === 'hide'}
                            onChange={() => setAction('hide')}
                            style={{ marginTop: '3px', accentColor: 'var(--color-warning)' }}
                        />
                        <span>
                            <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 700 }}>
                                {t('controls.closeDialog.hideOption', { defaultValue: 'Hide window (keep background running)' })}
                            </div>
                            <div style={{ color: 'var(--color-text-faint)', fontSize: '11px', marginTop: '4px', lineHeight: 1.45 }}>
                                {t('controls.closeDialog.hideHint', { defaultValue: 'Match tracking continues. Right-click the ApexTrace icon in the notification area (hidden icons) to reopen.' })}
                            </div>
                        </span>
                    </label>

                    <label style={optionStyle(action === 'quit')}>
                        <input
                            type="radio"
                            name="close-action"
                            checked={action === 'quit'}
                            onChange={() => setAction('quit')}
                            style={{ marginTop: '3px', accentColor: 'var(--color-warning)' }}
                        />
                        <span>
                            <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 700 }}>
                                {t('controls.closeDialog.quitOption', { defaultValue: 'Quit completely' })}
                            </div>
                            <div style={{ color: 'var(--color-text-faint)', fontSize: '11px', marginTop: '4px', lineHeight: 1.45 }}>
                                {t('controls.closeDialog.quitHint', { defaultValue: 'Stops the background process and match tracking.' })}
                            </div>
                        </span>
                    </label>

                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '4px',
                            color: 'var(--color-text-dim)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={dontAskAgain}
                            onChange={(e) => setDontAskAgain(e.target.checked)}
                            style={{ accentColor: 'var(--color-warning)' }}
                        />
                        {t('controls.closeDialog.dontAskAgain', { defaultValue: "Don't ask again" })}
                    </label>
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                        padding: '0 22px 20px',
                    }}
                >
                    <button type="button" className="apex-btn" onClick={onCancel}>
                        {t('controls.closeDialog.cancel', { defaultValue: 'Cancel' })}
                    </button>
                    <button
                        type="button"
                        className="apex-btn apex-btn-primary"
                        onClick={() => onConfirm(action, dontAskAgain)}
                    >
                        {t('controls.closeDialog.confirm', { defaultValue: 'Confirm' })}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseConfirmDialog;

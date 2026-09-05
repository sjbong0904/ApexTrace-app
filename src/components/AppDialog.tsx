import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const ADS_COVER_EVENT = 'apex-ads-cover';

export type AppDialogMode = 'alert' | 'confirm';

export interface AppDialogProps {
    open: boolean;
    mode?: AppDialogMode;
    title?: string;
    message: string;
    detail?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
}

/** Desktop/in-game safe replacement for alert / confirm (OW: no native browser dialogs). */
const AppDialog: React.FC<AppDialogProps> = ({
    open,
    mode = 'alert',
    title,
    message,
    detail,
    confirmLabel,
    cancelLabel,
    danger = false,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!open) return;
        window.dispatchEvent(new CustomEvent(ADS_COVER_EVENT, { detail: true }));
        return () => {
            window.dispatchEvent(new CustomEvent(ADS_COVER_EVENT, { detail: false }));
        };
    }, [open]);

    if (!open) return null;

    const handleCancel = onCancel ?? onConfirm;
    const okText =
        confirmLabel ||
        (mode === 'confirm'
            ? t('controls.closeDialog.confirm', { defaultValue: 'Confirm' })
            : t('controls.close', { defaultValue: 'Close' }));
    const cancelText = cancelLabel || t('controls.closeDialog.cancel', { defaultValue: 'Cancel' });

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
                if (e.target === e.currentTarget) handleCancel();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-dialog-title"
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
                    {title && (
                        <h3
                            id="app-dialog-title"
                            style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 800 }}
                        >
                            {title}
                        </h3>
                    )}
                    <p
                        style={{
                            margin: title ? '10px 0 0' : 0,
                            color: 'var(--color-text-muted)',
                            fontSize: '13px',
                            lineHeight: 1.5,
                        }}
                    >
                        {message}
                    </p>
                    {detail && (
                        <pre
                            style={{
                                margin: '12px 0 0',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background: 'var(--color-bg-card)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-dim)',
                                fontSize: '11px',
                                lineHeight: 1.45,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                fontFamily: 'ui-monospace, Consolas, monospace',
                            }}
                        >
                            {detail}
                        </pre>
                    )}
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                        padding: '18px 22px 20px',
                    }}
                >
                    {mode === 'confirm' && (
                        <button type="button" className="apex-btn" onClick={handleCancel}>
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        className={danger ? 'apex-btn' : 'apex-btn apex-btn-primary'}
                        style={
                            danger
                                ? {
                                      background: 'var(--color-danger)',
                                      color: '#fff',
                                      border: 'none',
                                  }
                                : undefined
                        }
                        onClick={onConfirm}
                    >
                        {okText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppDialog;

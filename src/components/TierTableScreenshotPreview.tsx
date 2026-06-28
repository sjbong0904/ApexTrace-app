import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import TierTableCaptureView from './TierTableCaptureView';
import type { TierTableItem, TierTableMode, TierTableState } from '../utils/tierTableData';
import {
    canvasToPngBlob,
    captureTierTableToCanvas,
    promptSaveTierTableScreenshot,
    TierScreenshotCancelledError,
    waitForCaptureImages,
} from '../utils/tierTableScreenshot';

type PreviewStatus = 'preparing' | 'ready' | 'saving' | 'done' | 'error';

type TierTableScreenshotPreviewProps = {
    open: boolean;
    mode: TierTableMode;
    tableState: TierTableState;
    itemMap: Map<string, TierTableItem>;
    captureWidth?: number;
    onClose: () => void;
    onCaptureComplete?: () => void;
};

const HEADER_ICON_BUTTON: React.CSSProperties = {
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 8,
    border: '1px solid var(--color-border-light)',
    background: 'transparent',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    margin: 0,
    fontSize: 14,
    lineHeight: 1,
    boxSizing: 'border-box',
    flexShrink: 0,
    fontFamily: 'inherit',
};

const HEADER_CONTROL_HEIGHT = 32;

const TierTableScreenshotPreview: React.FC<TierTableScreenshotPreviewProps> = ({
    open,
    mode,
    tableState,
    itemMap,
    captureWidth,
    onClose,
    onCaptureComplete,
}) => {
    const { t } = useTranslation();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<PreviewStatus>('preparing');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [savedPath, setSavedPath] = useState<string | null>(null);
    const [screenshotTitle, setScreenshotTitle] = useState('');

    const capturePreview = useCallback(async (): Promise<Blob | null> => {
        const root = wrapperRef.current?.querySelector('[data-tier-capture-root]');
        if (!(root instanceof HTMLElement)) return null;

        await waitForCaptureImages(root);
        const canvas = await captureTierTableToCanvas(root, { captureWidth });
        return canvasToPngBlob(canvas);
    }, [captureWidth]);

    useEffect(() => {
        if (!open) {
            setStatus('preparing');
            setErrorMessage(null);
            setSavedPath(null);
            setScreenshotTitle('');
            return;
        }

        let cancelled = false;

        const preparePreview = async () => {
            setStatus('preparing');
            setErrorMessage(null);
            setSavedPath(null);
            setScreenshotTitle('');

            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

            if (cancelled) return;

            setStatus('ready');
            onCaptureComplete?.();
        };

        void preparePreview();

        return () => {
            cancelled = true;
        };
    }, [open, onCaptureComplete]);

    const handleSave = useCallback(async () => {
        if (status === 'saving' || status === 'preparing') return;

        setErrorMessage(null);
        setSavedPath(null);

        try {
            setStatus('saving');
            const blob = await capturePreview();
            if (!blob) {
                throw new Error('No screenshot data');
            }

            const result = await promptSaveTierTableScreenshot(blob, mode, screenshotTitle);
            setSavedPath(result.path);
            setStatus('done');
        } catch (err) {
            if (err instanceof TierScreenshotCancelledError) {
                setStatus('ready');
                return;
            }
            console.error('[TierTable] Screenshot save failed:', err);
            setStatus('error');
            setErrorMessage(t('tierTable.screenshotFailed', { defaultValue: 'Failed to save screenshot' }));
        }
    }, [capturePreview, mode, screenshotTitle, status, t]);

    if (!open) return null;

    const isBusy = status === 'preparing' || status === 'saving';
    const canSave = status === 'ready' || status === 'done' || status === 'error';

    const statusLabel =
        status === 'preparing'
            ? t('tierTable.screenshotCapturing', { defaultValue: 'Capturing screenshot…' })
            : status === 'saving'
              ? t('tierTable.screenshotSaving', { defaultValue: 'Saving…' })
              : status === 'done' && savedPath
                ? t('tierTable.screenshotSaved', { path: savedPath, defaultValue: `Screenshot saved: ${savedPath}` })
                : status === 'done'
                  ? t('tierTable.screenshotSavedShort', { defaultValue: 'Saved!' })
                  : status === 'ready'
                    ? t('tierTable.screenshotReady', { defaultValue: 'Enter an optional title, then click Save' })
                    : errorMessage ?? t('tierTable.screenshotFailed', { defaultValue: 'Failed to save screenshot' });

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t('tierTable.screenshotPreview', { defaultValue: 'Screenshot preview' })}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'rgba(0, 0, 0, 0.72)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                boxSizing: 'border-box',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget && !isBusy) {
                    onClose();
                }
            }}
        >
            <div
                style={{
                    width: 'min(960px, calc(100vw - 48px))',
                    height: '92vh',
                    maxHeight: '92vh',
                    background: 'var(--color-bg-panel)',
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
                }}
            >
                <div
                    style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexShrink: 0,
                    }}
                >
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                            {t('tierTable.screenshotPreview', { defaultValue: 'Screenshot preview' })}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {statusLabel}
                        </div>
                    </div>
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flex: '0 1 280px',
                            minWidth: 180,
                            margin: 0,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--color-text-muted)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                            }}
                        >
                            {t('tierTable.screenshotTitle', { defaultValue: 'Title' })}
                        </span>
                        <input
                            type="text"
                            value={screenshotTitle}
                            onChange={(e) => setScreenshotTitle(e.target.value)}
                            disabled={isBusy}
                            maxLength={120}
                            placeholder={t('tierTable.screenshotTitlePlaceholder', { defaultValue: 'Optional' })}
                            aria-label={t('tierTable.screenshotTitle', { defaultValue: 'Title' })}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                height: HEADER_CONTROL_HEIGHT,
                                boxSizing: 'border-box',
                                padding: '0 10px',
                                borderRadius: 8,
                                border: '1px solid var(--color-border-light)',
                                background: 'var(--color-bg-input)',
                                color: 'var(--color-text-secondary)',
                                fontSize: 12,
                                fontFamily: 'inherit',
                                outline: 'none',
                                margin: 0,
                            }}
                        />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={!canSave || isBusy}
                            aria-label={t('tierTable.screenshotSave', { defaultValue: 'Save' })}
                            title={t('tierTable.screenshotSave', { defaultValue: 'Save' })}
                            style={{
                                ...HEADER_ICON_BUTTON,
                                cursor: !canSave || isBusy ? 'not-allowed' : 'pointer',
                                opacity: !canSave || isBusy ? 0.45 : 1,
                                color: 'var(--color-accent-hover)',
                                borderColor: 'var(--color-border-light)',
                            }}
                        >
                            <FaSave size={14} color="currentColor" />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={t('controls.close', { defaultValue: 'Close' })}
                            title={t('controls.close', { defaultValue: 'Close' })}
                            style={HEADER_ICON_BUTTON}
                        >
                            <FaTimes size={14} color="currentColor" />
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: 16,
                        minHeight: 0,
                    }}
                >
                    <div
                        ref={wrapperRef}
                        data-tier-screenshot-wrapper
                        style={{
                            position: 'relative',
                            width: '100%',
                            margin: '0 auto',
                            boxSizing: 'border-box',
                        }}
                    >
                        <TierTableCaptureView
                            mode={mode}
                            tableState={tableState}
                            itemMap={itemMap}
                            title={screenshotTitle}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TierTableScreenshotPreview;

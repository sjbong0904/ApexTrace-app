import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCopy, FaDownload, FaSync, FaCheck } from 'react-icons/fa';
import type { Match } from '../types';
import { useMatchShare } from '../hooks/useMatchShare';

interface MatchShareActionsProps {
    match: Match;
    modeLabel: string;
    modeColor: string;
}

/** Largest glyph that fits the 34×28 button (was 13px and hard to see). */
const ICON_SIZE = 22;

/**
 * Share-as-image icons for an expanded match. Lives at the end of the detail tab bar,
 * so the expanded card spends no extra row on it.
 */
const MatchShareActions = ({ match, modeLabel, modeColor }: MatchShareActionsProps) => {
    const { t } = useTranslation();
    const { busy, status, run, portal } = useMatchShare(match, modeLabel, modeColor);

    const button = (primary: boolean): CSSProperties => ({
        width: 34,
        height: 28,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: primary ? '1px solid var(--color-accent)' : '1px solid var(--color-border-light)',
        background: primary ? 'var(--color-accent)' : 'transparent',
        color: 'var(--color-text-primary)',
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy && busy !== (primary ? 'copy' : 'save') ? 0.5 : 1,
        flexShrink: 0,
    });

    const copyLabel = t('share.copyHint', { defaultValue: 'Copy a summary image to paste into Discord or chat' });
    const saveLabel = t('share.save', { defaultValue: 'Save image' });

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', flexShrink: 0, borderLeft: '1px solid var(--color-border)' }}
        >
            <button type="button" onClick={() => void run('copy')} disabled={!!busy} style={button(true)} title={copyLabel} aria-label={copyLabel}>
                {busy === 'copy' ? <FaSync className="spin-animation" size={ICON_SIZE} /> : status?.kind === 'ok' ? <FaCheck size={ICON_SIZE} /> : <FaCopy size={ICON_SIZE} />}
            </button>
            <button type="button" onClick={() => void run('save')} disabled={!!busy} style={button(false)} title={saveLabel} aria-label={saveLabel}>
                {busy === 'save' ? <FaSync className="spin-animation" size={ICON_SIZE} /> : <FaDownload size={ICON_SIZE} />}
            </button>
            {status && (
                <span
                    role="status"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: 6,
                        zIndex: 30,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'var(--color-bg-deep)',
                        border: '1px solid var(--color-border-light)',
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        textTransform: 'none',
                        color: status.kind === 'ok' ? 'var(--color-success)' : 'var(--color-danger)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                >
                    {status.text}
                </span>
            )}
            {portal}
        </div>
    );
};

export default MatchShareActions;

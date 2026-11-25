import { type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCopy, FaDownload, FaSync, FaCheck } from 'react-icons/fa';
import { FaXTwitter, FaFacebookF } from 'react-icons/fa6';
import type { Match } from '../types';
import { useMatchShare, type ShareAction } from '../hooks/useMatchShare';
import { useOpenExternal } from '../hooks/useOpenExternal';

interface MatchShareActionsProps {
    match: Match;
    modeLabel: string;
    modeColor: string;
}

/** Largest glyph that fits the 34×28 button (was 13px and hard to see). */
const ICON_SIZE = 22;
/** Brand glyphs are visually heavier; a touch smaller reads the same size as copy/save. */
const BRAND_ICON_SIZE = 19;

/**
 * Share bar under the expanded match's tabs: copy / save the summary image, or copy it and open
 * X / Facebook to paste it into a post (neither site accepts an attached image through a link).
 */
const MatchShareActions = ({ match, modeLabel, modeColor }: MatchShareActionsProps) => {
    const { t } = useTranslation();
    const { openExternal, dialog } = useOpenExternal();
    const { busy, status, run, portal } = useMatchShare(match, modeLabel, modeColor, openExternal);

    const buttonStyle = (action: ShareAction, primary: boolean): CSSProperties => ({
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
        opacity: busy && busy !== action ? 0.5 : 1,
        flexShrink: 0,
    });

    const button = (action: ShareAction, label: string, icon: ReactNode, primary = false) => (
        <button
            type="button"
            onClick={() => void run(action)}
            disabled={!!busy}
            style={buttonStyle(action, primary)}
            title={label}
            aria-label={label}
        >
            {busy === action ? <FaSync className="spin-animation" size={action === 'x' || action === 'facebook' ? BRAND_ICON_SIZE : ICON_SIZE} /> : icon}
        </button>
    );

    const divider = <span aria-hidden style={{ width: 1, height: 18, background: 'var(--color-border)', margin: '0 4px' }} />;

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'relative',
                height: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 4,
                padding: '0 8px',
                borderTop: '1px solid var(--color-border)',
            }}
        >
            {button('copy', t('share.copyHint', { defaultValue: 'Copy a summary image to paste into Discord or chat' }),
                status?.kind === 'ok' && busy == null ? <FaCheck size={ICON_SIZE} /> : <FaCopy size={ICON_SIZE} />, true)}
            {button('save', t('share.save', { defaultValue: 'Save image' }), <FaDownload size={ICON_SIZE} />)}
            {divider}
            {button('x', t('share.shareX', { defaultValue: 'Copy the image and open X' }), <FaXTwitter size={BRAND_ICON_SIZE} />)}
            {button('facebook', t('share.shareFacebook', { defaultValue: 'Copy the image and open Facebook' }), <FaFacebookF size={BRAND_ICON_SIZE} />)}
            {status && (
                <span
                    role="status"
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 4px)',
                        right: 8,
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
            {dialog}
        </div>
    );
};

export default MatchShareActions;

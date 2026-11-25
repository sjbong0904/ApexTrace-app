import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import { normalizeMapDisplayName } from '../utils/helpers';
import { buildMatchShareFilename, captureShareCard, copyPngToClipboard, saveMatchSharePng } from '../utils/matchShare';
import { TierScreenshotCancelledError } from '../utils/tierTableScreenshot';
import MatchShareCard from '../components/MatchShareCard';

export type ShareAction = 'copy' | 'save';
export type ShareStatus = { kind: 'ok' | 'error'; text: string } | null;

/**
 * Share-as-image for one match: renders the share card off-screen while busy, captures it,
 * then copies (falls back to save) or saves. Render `portal` somewhere in the caller.
 */
export const useMatchShare = (match: Match, modeLabel: string, modeColor: string) => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState<ShareAction | null>(null);
    const [status, setStatus] = useState<ShareStatus>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!status) return;
        const id = window.setTimeout(() => setStatus(null), 2500);
        return () => window.clearTimeout(id);
    }, [status]);

    const run = async (action: ShareAction) => {
        if (busy) return;
        setBusy(action);
        try {
            // The card mounts with `busy`; wait a frame so it is laid out before capture.
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const el = cardRef.current;
            if (!el) throw new Error('share card not mounted');
            const blob = await captureShareCard(el);
            if (action === 'copy' && await copyPngToClipboard(blob)) {
                setStatus({ kind: 'ok', text: t('share.copied', { defaultValue: 'Image copied — paste it anywhere' }) });
                return;
            }
            // Save (or copy unsupported → save instead).
            await saveMatchSharePng(blob, buildMatchShareFilename(normalizeMapDisplayName(match.map)));
            setStatus({ kind: 'ok', text: t('share.saved', { defaultValue: 'Image saved' }) });
        } catch (err) {
            if (err instanceof TierScreenshotCancelledError) return;
            console.error('[share] capture failed', err);
            setStatus({ kind: 'error', text: t('share.failed', { defaultValue: 'Could not create the image' }) });
        } finally {
            setBusy(null);
        }
    };

    const portal: ReactNode = busy
        ? createPortal(
            // Off-screen (not display:none) so html2canvas can measure and paint it.
            <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
                <MatchShareCard ref={cardRef} match={match} modeLabel={modeLabel} modeColor={modeColor} />
            </div>,
            document.body,
        )
        : null;

    return { busy, status, run, portal };
};

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import { getMapConfig, normalizeMapDisplayName } from '../utils/helpers';
import {
    buildMatchShareFilename,
    buildShareTargetUrl,
    captureShareCard,
    copyPngToClipboard,
    saveMatchSharePng,
    resolveShareImageUrl,
    svgPathsToDataUrl,
    tintImageToDataUrl,
    type ShareSocialTarget,
} from '../utils/matchShare';
import { TierScreenshotCancelledError } from '../utils/tierTableScreenshot';
import MatchShareCard, { type MatchShareAssets } from '../components/MatchShareCard';
import { classifyPlaystyle, computePlaystyleBase, extractPlaystyleSignals } from '../utils/playstyle';
import { getBestWeapon } from '../utils/weaponMatchStats';
import { getWeaponSilhouetteUrl } from '../utils/weaponTheme';

/** Everything the card needs that html2canvas can't load/paint itself (images, icon, white silhouette). */
export const prepareShareAssets = async (match: Match): Promise<MatchShareAssets> => {
    const playstyle = classifyPlaystyle(computePlaystyleBase(match), extractPlaystyleSignals(match));
    const bestWeapon = getBestWeapon(match);
    const mapImg = getMapConfig(match.map, match.startTime ?? match.endTime ?? null)?.img;
    const [icons, weaponSilhouette, mapImage, legendImage] = await Promise.all([
        import('../assets/playstyleIcons').then((m) => m.PLAYSTYLE_ICON_PATHS).catch(() => null),
        bestWeapon ? tintImageToDataUrl(getWeaponSilhouetteUrl(bestWeapon.id)) : Promise.resolve(null),
        mapImg ? resolveShareImageUrl(`/images/${mapImg}`) : Promise.resolve(null),
        resolveShareImageUrl(`/images/${(match.legend || 'unknown').toLowerCase()}.png`),
    ]);
    const iconPaths = icons?.[playstyle];
    return {
        playstyle,
        playstyleIcon: iconPaths?.length ? svgPathsToDataUrl(iconPaths) : null,
        bestWeapon,
        weaponSilhouette,
        mapImage,
        legendImage,
    };
};

export type ShareAction = 'copy' | 'save' | ShareSocialTarget;
export type ShareStatus = { kind: 'ok' | 'error'; text: string } | null;

const isSocial = (action: ShareAction): action is ShareSocialTarget => action === 'x' || action === 'facebook';

/**
 * Share-as-image for one match: renders the share card off-screen while busy, captures it,
 * then copies (falls back to save) or saves. Social targets copy (or save) the image, then call
 * `openUrl` with the site to paste it into. Render `portal` somewhere in the caller.
 */
export const useMatchShare = (match: Match, modeLabel: string, modeColor: string, openUrl?: (url: string) => void) => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState<ShareAction | null>(null);
    const [status, setStatus] = useState<ShareStatus>(null);
    const [assets, setAssets] = useState<MatchShareAssets | null>(null);
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
            setAssets(await prepareShareAssets(match));
            // The card mounts with `busy`; wait a frame so it is laid out before capture.
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const el = cardRef.current;
            if (!el) throw new Error('share card not mounted');
            const blob = await captureShareCard(el);
            const social = isSocial(action);
            if ((action === 'copy' || social) && await copyPngToClipboard(blob)) {
                setStatus({ kind: 'ok', text: t('share.copied', { defaultValue: 'Image copied — paste it anywhere' }) });
            } else {
                // Save (or copy unsupported → save instead).
                await saveMatchSharePng(blob, buildMatchShareFilename(normalizeMapDisplayName(match.map)));
                setStatus({
                    kind: 'ok',
                    text: social
                        ? t('share.savedAttach', { defaultValue: 'Image saved — attach it to your post' })
                        : t('share.saved', { defaultValue: 'Image saved' }),
                });
            }
            if (social) openUrl?.(buildShareTargetUrl(action));
        } catch (err) {
            if (err instanceof TierScreenshotCancelledError) return;
            console.error('[share] capture failed', err);
            setStatus({ kind: 'error', text: t('share.failed', { defaultValue: 'Could not create the image' }) });
        } finally {
            setBusy(null);
            setAssets(null);
        }
    };

    const portal: ReactNode = busy
        ? createPortal(
            // Off-screen (not display:none) so html2canvas can measure and paint it.
            <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
                <MatchShareCard ref={cardRef} match={match} modeLabel={modeLabel} modeColor={modeColor} assets={assets} />
            </div>,
            document.body,
        )
        : null;

    return { busy, status, run, portal };
};

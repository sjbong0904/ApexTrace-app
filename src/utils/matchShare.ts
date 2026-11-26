import html2canvas from 'html2canvas';

import { cachedObjectUrl, LOCAL_IMAGE_ROOT, remoteImageUrl } from './imageSource';
import {
    canvasToPngBlob,
    formatTierScreenshotTimestamp,
    promptSavePngScreenshot,
    waitForCaptureImages,
} from './tierTableScreenshot';

/** Matches the share card's fixed panel color. */
const SHARE_CARD_BG = '#101218';

/** Render a share card element (already in the DOM) to a PNG. The card carries its own brand mark. */
export const captureShareCard = async (element: HTMLElement): Promise<Blob> => {
    await waitForCaptureImages(element);
    const canvas = await html2canvas(element, {
        backgroundColor: SHARE_CARD_BG,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
    });
    return canvasToPngBlob(canvas);
};

/**
 * `/images/...` files are not packaged: an `<img>` first shows a 1×1 placeholder and swaps in the
 * cached file later, which a capture can miss. Resolve the real (blob) URL up front instead.
 */
export const resolveShareImageUrl = async (path: string): Promise<string> =>
    path.startsWith(`${LOCAL_IMAGE_ROOT}/`) ? cachedObjectUrl(remoteImageUrl(path)) : path;

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img.naturalWidth > 1 ? img : null);
        img.onerror = () => resolve(null);
        img.src = src;
    });

/**
 * Recolor an image's opaque pixels to one color (with a soft drop shadow) and return a PNG data URL,
 * or null on failure. html2canvas can't paint CSS `filter` / `mask-image`, so the share card bakes
 * the white weapon silhouette ahead of capture instead.
 */
export const tintImageToDataUrl = async (path: string, color = '#ffffff'): Promise<string | null> => {
    const img = await loadImage(await resolveShareImageUrl(path));
    if (!img) return null;
    try {
        const pad = 4;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const tint = document.createElement('canvas');
        tint.width = w;
        tint.height = h;
        const tctx = tint.getContext('2d');
        if (!tctx) return null;
        tctx.drawImage(img, 0, 0);
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = color;
        tctx.fillRect(0, 0, w, h);

        const out = document.createElement('canvas');
        out.width = w + pad * 2;
        out.height = h + pad * 2;
        const ctx = out.getContext('2d');
        if (!ctx) return null;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;
        ctx.drawImage(tint, pad, pad);
        return out.toDataURL('image/png');
    } catch {
        return null;
    }
};

/** Inline SVG icon (white paths) as a data URL, so html2canvas paints it like any `<img>`. */
export const svgPathsToDataUrl = (paths: readonly string[], viewBox = '0 0 512 512', fill = '#ffffff'): string =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths.map((d) => `<path fill="${fill}" d="${d}"/>`).join('')}</svg>`,
    )}`;

/**
 * Copy a PNG to the clipboard (Discord / KakaoTalk paste). Returns false when the
 * runtime has no image clipboard support, so the caller can fall back to saving.
 */
export const copyPngToClipboard = async (blob: Blob): Promise<boolean> => {
    try {
        if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return true;
    } catch {
        return false;
    }
};

export const buildMatchShareFilename = (map: string, date = new Date()): string => {
    const safeMap = map.replace(/[\\/:*?"<>|']/g, '').replace(/\s+/g, '');
    return `ApexTrace-Match-${safeMap || 'Match'}-${formatTierScreenshotTimestamp(date)}.png`;
};

export const saveMatchSharePng = (blob: Blob, filename: string) => promptSavePngScreenshot(blob, filename);

/** Social targets for the share bar. Each copies the card image, then opens the site to paste it. */
export type ShareSocialTarget = 'x' | 'facebook';

/** Language-neutral post text (hashtags only), so no translation is needed. */
export const SHARE_POST_TEXT = '#ApexLegends #ApexTrace';

/**
 * Page to open after the image is on the clipboard. X's intent prefills text (it cannot attach
 * an image); Facebook's sharer needs a public URL we do not have yet, so it opens the feed composer.
 */
export const buildShareTargetUrl = (target: ShareSocialTarget, text = SHARE_POST_TEXT): string => {
    if (target === 'x') return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    return 'https://www.facebook.com/';
};

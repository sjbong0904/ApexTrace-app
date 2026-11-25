import html2canvas from 'html2canvas';

import {
    canvasToPngBlob,
    drawTierTableWatermark,
    formatTierScreenshotTimestamp,
    promptSavePngScreenshot,
    waitForCaptureImages,
} from './tierTableScreenshot';

/** Render a share card element (already in the DOM) to a watermarked PNG. */
export const captureShareCard = async (element: HTMLElement): Promise<Blob> => {
    await waitForCaptureImages(element);
    const backgroundColor =
        getComputedStyle(document.documentElement).getPropertyValue('--color-bg-panel').trim() || '#181818';
    const canvas = await html2canvas(element, {
        backgroundColor,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
    });
    const ctx = canvas.getContext('2d');
    if (ctx) await drawTierTableWatermark(ctx, canvas.width, canvas.height);
    return canvasToPngBlob(canvas);
};

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

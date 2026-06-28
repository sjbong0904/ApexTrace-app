import html2canvas from 'html2canvas';

import { APEXTRACE_LOGO, type TierTableMode } from './tierTableData';

const APEXTRACE_PICTURES_DIR = 'ApexTrace';

type SaveMethod = 'picker' | 'download';

type SaveTierScreenshotResult = {
    path: string;
    method: SaveMethod;
};

type SaveFilePickerOptions = {
    suggestedName?: string;
    types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
    }>;
};

type SaveFilePickerWindow = Window & {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
};

export const waitForCaptureImages = async (root: HTMLElement): Promise<void> => {
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
        images.map(
            (img) =>
                new Promise<void>((resolve) => {
                    if (img.complete) {
                        resolve();
                        return;
                    }
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                }),
        ),
    );
};

export const drawTierTableWatermark = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
): Promise<void> => {
    const padding = 24;
    const logoSize = 48;
    const text = 'APEXTRACE';
    const fontSize = 20;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const innerPadX = 14;
    const innerPadY = 10;
    const blockWidth = innerPadX * 2 + logoSize + 10 + textWidth;
    const blockHeight = innerPadY * 2 + logoSize;
    const x = canvasWidth - blockWidth - padding;
    const y = canvasHeight - blockHeight - padding;

    return new Promise((resolve) => {
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.onload = () => {
            ctx.save();
            ctx.fillStyle = 'rgba(16, 20, 28, 0.82)';
            ctx.beginPath();
            ctx.roundRect(x, y, blockWidth, blockHeight, 10);
            ctx.fill();
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = '#ffffff';
            ctx.drawImage(logo, x + innerPadX, y + innerPadY, logoSize, logoSize);
            ctx.fillText(text, x + innerPadX + logoSize + 10, y + innerPadY + logoSize * 0.72);
            ctx.restore();
            resolve();
        };
        logo.onerror = () => {
            ctx.save();
            ctx.fillStyle = 'rgba(16, 20, 28, 0.82)';
            ctx.beginPath();
            ctx.roundRect(x, y, blockWidth, blockHeight, 10);
            ctx.fill();
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x + innerPadX, y + innerPadY + logoSize * 0.72);
            ctx.restore();
            resolve();
        };
        logo.src = APEXTRACE_LOGO;
    });
};

const prepareCaptureClone = (root: HTMLElement): void => {
    const fixNode = (node: HTMLElement): void => {
        node.style.visibility = 'visible';
        node.style.opacity = '1';
        node.style.transform = 'none';
        node.style.pointerEvents = 'none';
    };

    fixNode(root);
    let parent = root.parentElement;
    while (parent) {
        fixNode(parent);
        parent.style.overflow = 'visible';
        parent.style.maxHeight = 'none';
        parent = parent.parentElement;
    }
};

const findCaptureTarget = (clonedElement: HTMLElement): HTMLElement | null => {
    if (clonedElement.matches('[data-tier-screenshot-wrapper], [data-tier-capture-root]')) {
        return clonedElement;
    }
    const found = clonedElement.querySelector('[data-tier-screenshot-wrapper], [data-tier-capture-root]');
    return found instanceof HTMLElement ? found : null;
};

const applyCaptureWidthToClone = (captureTarget: HTMLElement, captureWidth: number): void => {
    captureTarget.style.width = `${captureWidth}px`;
    captureTarget.style.maxWidth = 'none';

    const wrapper = captureTarget.closest('[data-tier-screenshot-wrapper]');
    if (wrapper instanceof HTMLElement) {
        wrapper.style.width = `${captureWidth}px`;
        wrapper.style.maxWidth = 'none';
    }
};

export type TierTableCaptureOptions = {
    /** Export width in px — applied only to html2canvas clone so preview layout stays unchanged. */
    captureWidth?: number;
};

export const captureTierTableToCanvas = async (
    element: HTMLElement,
    options?: TierTableCaptureOptions,
): Promise<HTMLCanvasElement> => {
    const backgroundColor =
        getComputedStyle(document.documentElement).getPropertyValue('--color-bg-panel').trim() || '#141820';

    const captureWidth = options?.captureWidth;
    const useFixedViewport = !captureWidth;
    const width = element.clientWidth;
    const height = element.scrollHeight;

    return html2canvas(element, {
        backgroundColor,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        ...(useFixedViewport
            ? { width, height, windowWidth: width, windowHeight: height }
            : {}),
        scrollX: 0,
        scrollY: 0,
        onclone: (_doc, clonedElement) => {
            const captureTarget = findCaptureTarget(clonedElement);

            if (captureTarget instanceof HTMLElement) {
                if (captureWidth) {
                    applyCaptureWidthToClone(captureTarget, captureWidth);
                }
                prepareCaptureClone(captureTarget);
                return;
            }

            prepareCaptureClone(clonedElement);
        },
    });
};

export const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
            if (result) {
                resolve(result);
                return;
            }
            reject(new Error('Failed to encode PNG'));
        }, 'image/png');
    });

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const formatTierScreenshotTimestamp = (date = new Date()): string =>
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;

/** Strip characters invalid on Windows/macOS file names. */
export const sanitizeTierScreenshotFilename = (title: string): string => {
    const trimmed = title.trim();
    if (!trimmed) return '';

    const sanitized = trimmed
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);

    if (!sanitized) return '';
    return sanitized.toLowerCase().endsWith('.png') ? sanitized : `${sanitized}.png`;
};

export const buildTierScreenshotFilename = (
    mode: TierTableMode,
    date = new Date(),
    title?: string,
): string => {
    const fromTitle = title ? sanitizeTierScreenshotFilename(title) : '';
    if (fromTitle) return fromTitle;

    const modeLabel = mode === 'legend' ? 'LegendTier' : 'WeaponTier';
    return `ApexTrace-${modeLabel}-${formatTierScreenshotTimestamp(date)}.png`;
};

export const getDefaultTierScreenshotFolder = (): string | null => {
    if (typeof overwolf !== 'undefined' && overwolf.io?.paths?.pictures) {
        return `${overwolf.io.paths.pictures}\\${APEXTRACE_PICTURES_DIR}`;
    }
    return null;
};

const ensureDefaultScreenshotFolder = async (): Promise<string | null> => {
    const folder = getDefaultTierScreenshotFolder();
    if (!folder || typeof overwolf === 'undefined' || !overwolf.io?.dir || !overwolf.io.writeFileContents) {
        return folder;
    }

    return new Promise((resolve) => {
        overwolf.io.dir(folder, (result) => {
            if (result.success) {
                resolve(folder);
                return;
            }

            const markerPath = `${folder}\\.keep`;
            overwolf.io.writeFileContents(
                markerPath,
                '',
                'UTF8' as overwolf.io.enums.eEncoding,
                false,
                () => {
                    resolve(folder);
                },
            );
        });
    });
};

const saveViaDownload = (blob: Blob, filename: string): SaveTierScreenshotResult => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { path: filename, method: 'download' };
};

const saveViaNativeFilePicker = async (blob: Blob, filename: string): Promise<SaveTierScreenshotResult> => {
    const pickerWindow = window as SaveFilePickerWindow;
    if (typeof pickerWindow.showSaveFilePicker !== 'function') {
        throw new Error('Save file picker unavailable');
    }

    const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
    });

    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();

    return { path: handle.name, method: 'picker' };
};

export class TierScreenshotCancelledError extends Error {
    constructor() {
        super('Screenshot save cancelled');
        this.name = 'TierScreenshotCancelledError';
    }
}

export const promptSaveTierTableScreenshot = async (
    blob: Blob,
    mode: TierTableMode,
    title?: string,
): Promise<SaveTierScreenshotResult> => {
    const filename = buildTierScreenshotFilename(mode, new Date(), title);
    await ensureDefaultScreenshotFolder();

    try {
        return await saveViaNativeFilePicker(blob, filename);
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new TierScreenshotCancelledError();
        }
        if (err instanceof TierScreenshotCancelledError) {
            throw err;
        }
        console.warn('[TierTable] Save picker unavailable, falling back to download:', err);
        return saveViaDownload(blob, filename);
    }
};

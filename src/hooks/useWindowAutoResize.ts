// src/hooks/useWindowAutoResize.ts
import { useCallback, useEffect } from 'react';

type BackgroundWindow = Window & {
    WindowController?: {
        resizeWindowToDisplay?: (
            windowInfo: overwolf.windows.WindowInfo,
            preferredWidth: number,
            preferredHeight: number,
        ) => void;
    };
};

/**
 * Compact content metrics (match row density, padding) — independent of profile panel.
 * Profile open/close is user-controlled via nav (not this threshold).
 */
export const NARROW_LAYOUT_WIDTH = 1280;

/** Cap main content width when maximized so panels don't stretch endlessly. */
export const CONTENT_MAX_WIDTH = 1440;

export const useWindowAutoResize = (
    targetWidth: number = 1680,
    targetHeight: number = 920,
) => {
    const handleResize = useCallback(() => {
        if (typeof overwolf === 'undefined' || !overwolf.windows?.getCurrentWindow) return;

        overwolf.windows.getCurrentWindow((result) => {
            if (!result.success || !result.window) return;
            const currentWindow = result.window;

            if (currentWindow.state === 'Minimized' || !currentWindow.isVisible) return;

            try {
                const bg = overwolf.windows.getMainWindow() as BackgroundWindow;
                if (bg?.WindowController?.resizeWindowToDisplay) {
                    bg.WindowController.resizeWindowToDisplay(
                        currentWindow,
                        targetWidth,
                        targetHeight,
                    );
                    return;
                }
            } catch {
                // fall through to screen-based fallback
            }

            // Fallback when background helpers are unavailable
            const screenWidth = window.screen.availWidth;
            const screenHeight = window.screen.availHeight;
            const newWidth = targetWidth > screenWidth
                ? Math.floor(screenWidth * 0.95)
                : targetWidth;
            const newHeight = targetHeight > screenHeight
                ? Math.floor(screenHeight * 0.95)
                : targetHeight;

            const widthDiff = Math.abs(currentWindow.width - newWidth);
            const heightDiff = Math.abs(currentWindow.height - newHeight);

            if (widthDiff > 2 || heightDiff > 2) {
                overwolf.windows.changeSize({
                    window_id: currentWindow.id,
                    width: newWidth,
                    height: newHeight,
                }, () => {});
            }
        });
    }, [targetWidth, targetHeight]);

    useEffect(() => {
        handleResize();
    }, [handleResize]);

    return { handleResize };
};

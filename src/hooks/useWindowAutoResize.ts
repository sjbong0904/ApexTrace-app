// src/hooks/useWindowAutoResize.ts
import { useCallback, useEffect } from 'react';

export const useWindowAutoResize = (
    targetWidth: number = 1300,
    targetHeight: number = 800
) => {
    // ✅ useCallback으로 분리 — 외부 수동 트리거 가능
    const handleResize = useCallback(() => {
        overwolf.windows.getCurrentWindow((result) => {
            if (!result.success) return;
            const currentWindow = result.window;

            if (currentWindow.state === 'Minimized' || !currentWindow.isVisible) return;

            const screenWidth  = window.screen.availWidth;
            const screenHeight = window.screen.availHeight;

            const newWidth  = targetWidth  > screenWidth  ? Math.floor(screenWidth  * 0.9) : targetWidth;
            const newHeight = targetHeight > screenHeight ? Math.floor(screenHeight * 0.9) : targetHeight;

            const widthDiff  = Math.abs(currentWindow.width  - newWidth);
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

    // ✅ 의존성 배열 수정
    useEffect(() => {
        handleResize();
    }, [handleResize]);

    return { handleResize };
};
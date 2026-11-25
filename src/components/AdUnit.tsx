import React, { useEffect, useRef } from 'react';

/** Overwolf ads SDK (owads.min.js) — only the members this wrapper uses. */
interface OwAdInstance {
    shutdown(): void | Promise<void>;
}
type OwAdConstructor = new (
    container: HTMLElement,
    options: { size: { width: number; height: number }; containerId?: string },
) => OwAdInstance;

declare global {
    interface Window {
        /** Set by owads.min.js once it loads. */
        OwAd?: OwAdConstructor;
    }
}

interface AdUnitProps {
    width: number;
    height: number;
    /** Unique id for identical sizes in one window (max 20 chars). */
    containerId: string;
    className?: string;
    style?: React.CSSProperties;
    /** OW-compliant transparent parent (see OwAd docs) so real app content shows through. */
    transparent?: boolean;
    /**
     * Temporarily stop serving without destroying the instance.
     * OW: set display:none on the OwAd container element itself.
     */
    paused?: boolean;
}

const OWADS_READY = 'owads-ready';
const OWADS_FAILED = 'owads-failed';

type WaitHandle = {
    promise: Promise<OwAdConstructor>;
    cancel: () => void;
};

function waitForOwAd(timeoutMs = 15000): WaitHandle {
    if (typeof window.OwAd !== 'undefined') {
        return {
            promise: Promise.resolve(window.OwAd),
            cancel: () => {},
        };
    }

    let settled = false;
    let timer = 0;
    const onReady = () => finish(true);
    const onFail = () => finish(false);

    let resolveFn: (value: OwAdConstructor) => void = () => {};
    let rejectFn: (reason?: unknown) => void = () => {};

    const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener(OWADS_READY, onReady);
        window.removeEventListener(OWADS_FAILED, onFail);
        if (ok && typeof window.OwAd !== 'undefined') resolveFn(window.OwAd);
        else rejectFn(new Error('OwAd SDK failed to load'));
    };

    const promise = new Promise<OwAdConstructor>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
        timer = window.setTimeout(() => finish(typeof window.OwAd !== 'undefined'), timeoutMs);
        window.addEventListener(OWADS_READY, onReady);
        window.addEventListener(OWADS_FAILED, onFail);
        if (typeof window.OwAd !== 'undefined') finish(true);
    });

    return {
        promise,
        cancel: () => finish(false),
    };
}

/**
 * Overwolf OwAd wrapper.
 * Parent must only show this while the container is fully on-screen
 * (OW ads policy: ads may not be covered, off-screen, or visibility:hidden).
 * Prefer transparent containers so rail atmosphere shows through (OW docs).
 */
const AdUnit: React.FC<AdUnitProps> = ({
    width,
    height,
    containerId,
    className,
    style,
    transparent = false,
    paused = false,
}) => {
    const adContainerRef = useRef<HTMLDivElement>(null);
    const adInstance = useRef<OwAdInstance | null>(null);

    useEffect(() => {
        let cancelled = false;
        const wait = waitForOwAd();

        const start = async () => {
            if (!adContainerRef.current) return;
            try {
                await wait.promise;
            } catch {
                return;
            }
            if (cancelled || !adContainerRef.current || typeof window.OwAd === 'undefined') return;

            const instance = new window.OwAd(adContainerRef.current, {
                size: { width, height },
                containerId: containerId.slice(0, 20),
            });
            adInstance.current = instance;
        };

        void start();

        return () => {
            cancelled = true;
            wait.cancel();
            if (adInstance.current) {
                try {
                    adInstance.current.shutdown();
                } catch {
                    /* ignore */
                }
                adInstance.current = null;
            }
        };
    }, [width, height, containerId]);

    // OW docs (new OwAd(...) example): "Ensure the ad container's parent element
    // has background: transparent set." A solid plate here is non-compliant AND
    // adds an extra color swap (real bg → plate → ad) instead of (real bg → ad),
    // which is why other OW apps' ad slots blend into their own background.
    const bg = transparent ? 'transparent' : 'var(--color-bg-nav)';

    return (
        <div
            className={className}
            style={{
                width: `${width}px`,
                height: `${height}px`,
                minWidth: width,
                minHeight: height,
                position: 'relative',
                background: bg,
                backgroundColor: bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                ...style,
            }}
        >
            <div
                ref={adContainerRef}
                className="apex-owad-slot"
                id={containerId.slice(0, 20)}
                style={{
                    width: '100%',
                    height: '100%',
                    minWidth: width,
                    minHeight: height,
                    position: 'relative',
                    zIndex: 1,
                    background: bg,
                    backgroundColor: bg,
                    // CSS Color Adjust: if the <iframe> element's used color-scheme differs
                    // from the embedded (ad) document's, Chromium paints an OPAQUE Canvas
                    // (white for a light ad doc) instead of a transparent one. Our :root is
                    // color-scheme: dark and it inherits into OwAd's iframe → white slot.
                    // Force light here so it matches the ad doc and the canvas stays transparent.
                    colorScheme: 'light',
                    // OW policy: only `display:none` is an approved way to pause ads —
                    // opacity/visibility manipulation of the ad container is explicitly
                    // disallowed (https://dev.overwolf.com/ow-native/monetization/advertising/overview/).
                    display: paused ? 'none' : 'block',
                }}
            />
        </div>
    );
};

export default AdUnit;

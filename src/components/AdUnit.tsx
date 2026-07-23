// src/components/AdUnit.tsx
import React, { useEffect, useRef } from 'react';

declare global {
    interface Window {
        OwAd: any;
    }
}

interface AdUnitProps {
    width: number;
    height: number;
    /** Unique id for identical sizes in one window (max 20 chars). */
    containerId: string;
    className?: string;
    style?: React.CSSProperties;
    /** No solid fill — lets parent map/atmosphere show through (OW Ads guidance). */
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
    promise: Promise<typeof window.OwAd>;
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

    let resolveFn: (value: typeof window.OwAd) => void = () => {};
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

    const promise = new Promise<typeof window.OwAd>((resolve, reject) => {
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
    const adInstance = useRef<any>(null);

    useEffect(() => {
        let cancelled = false;
        const wait = waitForOwAd();

        const start = async () => {
            if (!adContainerRef.current) return;
            try {
                await wait.promise;
            } catch {
                if (!cancelled) console.warn('⚠️ OwAd SDK not available');
                return;
            }
            if (cancelled || !adContainerRef.current || typeof window.OwAd === 'undefined') return;

            const instance = new window.OwAd(adContainerRef.current, {
                size: { width, height },
                containerId: containerId.slice(0, 20),
            });
            adInstance.current = instance;

            instance.addEventListener?.('display_ad_loaded', () => {
                console.log('✅ Display ad loaded', containerId);
            });
            instance.addEventListener?.('player_loaded', () => {
                console.log('✅ Video ad player loaded', containerId);
            });
            instance.addEventListener?.('error', (error: unknown) => {
                console.warn('⚠️ Ad error:', containerId, error);
            });
        };

        void start();

        return () => {
            cancelled = true;
            wait.cancel();
            if (adInstance.current) {
                try {
                    adInstance.current.shutdown();
                } catch (e) {
                    console.warn('OwAd.shutdown failed', e);
                }
                adInstance.current = null;
            }
        };
    }, [width, height, containerId]);

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
                    background: 'transparent',
                    backgroundColor: 'transparent',
                    // OW: pause by setting display:none on the OwAd container element.
                    display: paused ? 'none' : 'block',
                }}
            />
        </div>
    );
};

export default AdUnit;

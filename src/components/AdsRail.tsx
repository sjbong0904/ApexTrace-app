import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import AdUnit from './AdUnit';
import mapBg from '../assets/worlds-edge-decor.webp';

const MemoAdUnit = memo(AdUnit);

/** 20px sides → 441px rail: ≥ 440px wide ad zone, so High Impact ads can be enabled later. */
const RAIL_PAD_X = 20;
export const ADS_RAIL_WIDTH = 1 + RAIL_PAD_X * 2 + 400;

const AD_STACK_GAP = 10;
const RAIL_PAD_TOP = 10;
const RAIL_PAD_BOTTOM = 10;

/**
 * Right ad rail: map atmosphere + transparent ad slots (OW: parent bg transparent).
 *
 * Same stack as Overwolf's 440×670 ad-zone layout: 400x60 on top, one gap, 400x600.
 * Keep it this tight — the desktop window's min height (manifest min_size) is
 * title bar 35 + 10 + 60 + 10 + 600 + 10, so 1366×768 screens still fit both ads.
 *
 * - 400x60 pinned to top of the ad area
 * - 400x600 pinned to bottom via margin-top:auto (taller windows add space between them)
 */
const AdsRail: React.FC<{ paused?: boolean }> = ({ paused = false }) => {
    const { t } = useTranslation();

    return (
        <aside
            aria-label={t('ads.railLabel')}
            aria-hidden={paused}
            style={{
                boxSizing: 'border-box',
                flex: `0 0 ${ADS_RAIL_WIDTH}px`,
                width: ADS_RAIL_WIDTH,
                minWidth: ADS_RAIL_WIDTH,
                borderLeft: '1px solid color-mix(in srgb, var(--color-border) 55%, transparent)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: `${RAIL_PAD_TOP}px ${RAIL_PAD_X}px ${RAIL_PAD_BOTTOM}px`,
                gap: AD_STACK_GAP,
                overflow: 'hidden',
                flexShrink: 0,
                zIndex: 15,
                background: 'transparent',
            }}
        >
            <style>{`
                /* OW docs: ad container's parent must be background: transparent —
                   lets the rail atmosphere (map bg below) show through (STORE-QA #3).
                   color-scheme: light is the actual fix for the white slot: our :root is
                   color-scheme: dark, the ad iframe document is light, and a mismatch makes
                   Chromium paint an opaque white Canvas behind the iframe (css-color-adjust-1).
                   Matching schemes keeps the iframe canvas transparent. */
                .apex-owad-slot,
                .apex-owad-slot iframe {
                    color-scheme: light !important;
                    background: transparent !important;
                    background-color: transparent !important;
                }
            `}</style>
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${mapBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'saturate(0.75) brightness(0.78)',
                    zIndex: 0,
                    pointerEvents: 'none',
                }}
            />
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'linear-gradient(180deg, rgba(8,12,18,0.12) 0%, rgba(8,12,18,0.22) 100%)',
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
            />

            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: AD_STACK_GAP,
                    width: '100%',
                    flex: 1,
                    minHeight: 0,
                    background: 'transparent',
                }}
            >
                <MemoAdUnit
                    width={400}
                    height={60}
                    containerId="at_400x60_d_top"
                    transparent
                    paused={paused}
                />

                {/* margin-top:auto (not a spacer element) so the stack has a single gap at min height. */}
                <MemoAdUnit
                    width={400}
                    height={600}
                    containerId="at_400x600_d_bot"
                    transparent
                    paused={paused}
                    style={{ marginTop: 'auto' }}
                />

                <div
                    style={{
                        fontSize: 10,
                        color: 'rgba(230,236,245,0.78)',
                        textAlign: 'center',
                        lineHeight: 1.35,
                        padding: '6px 8px 4px',
                        maxWidth: 400,
                        textShadow: '0 1px 3px rgba(0,0,0,0.65)',
                        background: 'transparent',
                        display: paused ? 'none' : undefined,
                        flexShrink: 0,
                    }}
                >
                    {t('ads.railFooter')}
                </div>
            </div>
        </aside>
    );
};

export default AdsRail;

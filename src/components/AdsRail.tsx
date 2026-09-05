import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import AdUnit from './AdUnit';

const MemoAdUnit = memo(AdUnit);

const RAIL_PAD_X = 16;
export const ADS_RAIL_WIDTH = 1 + RAIL_PAD_X * 2 + 400;

const MAP_BG =
    'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/worlds_edge_s30.png';

const AD_STACK_GAP = 14;

/**
 * Right ad rail: map atmosphere + transparent ad slots (OW: parent bg transparent).
 *
 * - 400x60 pinned to top of the ad area
 * - 400x600 pinned to bottom (grows away from it when the window is taller)
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
                padding: `12px ${RAIL_PAD_X}px 10px`,
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
                    backgroundImage: `url(${MAP_BG})`,
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

                {/* Flexible gap: window growth sits between banner and bottom unit. */}
                <div style={{ flex: 1, minHeight: 0, width: '100%', background: 'transparent' }} aria-hidden />

                <MemoAdUnit
                    width={400}
                    height={600}
                    containerId="at_400x600_d_bot"
                    transparent
                    paused={paused}
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

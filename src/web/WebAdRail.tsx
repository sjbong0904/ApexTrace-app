import { useTranslation } from 'react-i18next';

/** AdSense wide skyscraper (160×600) + horizontal padding. */
const SLOT_W = 160;
const SLOT_H = 600;
const RAIL_PAD_X = 12;
export const WEB_ADS_RAIL_WIDTH = SLOT_W + RAIL_PAD_X * 2;

/** Hide side rails below this width so the center app stays usable. */
export const WEB_ADS_MIN_VIEWPORT = 1480;

type WebAdRailProps = {
    side: 'left' | 'right';
};

/**
 * Empty side rail reserved for AdSense.
 * Mount real ads into `[data-ad-slot]` later without changing layout.
 */
const WebAdRail = ({ side }: WebAdRailProps) => {
    const { t } = useTranslation();
    const isLeft = side === 'left';

    return (
        <aside
            aria-label={t('ads.railLabel')}
            data-web-ads-rail={side}
            style={{
                boxSizing: 'border-box',
                flex: `0 0 ${WEB_ADS_RAIL_WIDTH}px`,
                width: WEB_ADS_RAIL_WIDTH,
                minWidth: WEB_ADS_RAIL_WIDTH,
                borderLeft: isLeft ? 'none' : '1px solid color-mix(in srgb, var(--color-border) 55%, transparent)',
                borderRight: isLeft ? '1px solid color-mix(in srgb, var(--color-border) 55%, transparent)' : 'none',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: `16px ${RAIL_PAD_X}px 12px`,
                overflow: 'hidden',
                flexShrink: 0,
                zIndex: 10,
                background: 'var(--color-bg-main)',
            }}
        >
            {/* Primary skyscraper slot */}
            <div
                data-ad-slot={`${side}-skyscraper`}
                style={{
                    width: SLOT_W,
                    height: SLOT_H,
                    maxHeight: '100%',
                    flexShrink: 0,
                    background: 'color-mix(in srgb, var(--color-bg-card) 55%, transparent)',
                    border: '1px dashed color-mix(in srgb, var(--color-border-light) 70%, transparent)',
                    borderRadius: 6,
                }}
            />
        </aside>
    );
};

export default WebAdRail;

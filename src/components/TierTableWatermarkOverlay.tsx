import React from 'react';
import { APEXTRACE_LOGO } from '../utils/tierTableData';

/** Horizontal inset aligned with tier table edges in capture view. */
export const TIER_CAPTURE_PAD_X = 20;

/** Matches App.tsx top bar title typography (12px bold, letter-spacing 1px). */
const TASKBAR_TITLE_STYLE: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: '1px',
    fontFamily: 'inherit',
    color: 'var(--color-text-muted)',
};

type TierTableWatermarkOverlayProps = {
    insetRight?: number;
    insetBottom?: number;
};

const TierTableWatermarkOverlay: React.FC<TierTableWatermarkOverlayProps> = ({
    insetRight = TIER_CAPTURE_PAD_X,
    insetBottom = 16,
}) => (
    <div
        aria-hidden
        style={{
            position: 'absolute',
            right: insetRight,
            bottom: insetBottom,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none',
            zIndex: 2,
            maxWidth: `calc(100% - ${insetRight * 2}px)`,
            boxSizing: 'border-box',
        }}
    >
        <img
            src={APEXTRACE_LOGO}
            alt=""
            crossOrigin="anonymous"
            draggable={false}
            style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }}
        />
        <span style={{ ...TASKBAR_TITLE_STYLE, whiteSpace: 'nowrap' }}>APEXTRACE</span>
    </div>
);

export default TierTableWatermarkOverlay;

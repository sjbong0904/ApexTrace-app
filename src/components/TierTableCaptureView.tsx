import React from 'react';
import {
    getTierRowColor,
    getTierLabelFontSize,
    TIER_FALLBACK_IMG,
    type TierTableItem,
    type TierTableMode,
    type TierTableState,
} from '../utils/tierTableData';
import TierTableWatermarkOverlay, { TIER_CAPTURE_PAD_X } from './TierTableWatermarkOverlay';

const LEGEND_TIER = { w: 50, h: 50 };
const WEAPON_TIER = { w: 68, h: 48 };
const ROW_GAP = 8;
const CAPTURE_PAD_TOP = 16;
const CAPTURE_PAD_BOTTOM = 32;
const WATERMARK_INSET_BOTTOM = 8;

/** Reserved top slot — grows with wrapped title text; min height balances watermark area. */
const TITLE_SLOT_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 28,
    paddingBottom: 14,
    marginBottom: 2,
    flexShrink: 0,
};

const TITLE_TEXT_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: '1px',
    fontFamily: 'inherit',
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    lineHeight: 1.35,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
};

type TierTableCaptureViewProps = {
    mode: TierTableMode;
    tableState: TierTableState;
    itemMap: Map<string, TierTableItem>;
    title?: string;
    width?: number | string;
    captureRootRef?: React.RefObject<HTMLDivElement | null>;
};

const TierTableCaptureView: React.FC<TierTableCaptureViewProps> = ({
    mode,
    tableState,
    itemMap,
    title = '',
    width = '100%',
    captureRootRef,
}) => {
    const tierSize = mode === 'legend' ? LEGEND_TIER : WEAPON_TIER;
    const displayTitle = title.trim();
    const panelBg =
        getComputedStyle(document.documentElement).getPropertyValue('--color-bg-panel').trim() || '#141820';

    return (
        <div
            ref={captureRootRef}
            data-tier-capture-root
            style={{
                position: 'relative',
                width,
                boxSizing: 'border-box',
                background: panelBg,
                padding: `${CAPTURE_PAD_TOP}px ${TIER_CAPTURE_PAD_X}px ${CAPTURE_PAD_BOTTOM}px`,
            }}
        >
            <div style={TITLE_SLOT_STYLE} aria-hidden={!displayTitle}>
                {displayTitle ? <span style={TITLE_TEXT_STYLE}>{displayTitle}</span> : null}
            </div>
            {tableState.tiers.map((tier, index) => {
                const tierColor = getTierRowColor(tier, index);
                const tierItemIds = tableState.assignments[tier.id] ?? [];
                const tierItems = tierItemIds
                    .map((id) => itemMap.get(id))
                    .filter((item): item is TierTableItem => !!item);

                return (
                    <div
                        key={tier.id}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '108px 1fr',
                            minHeight: 58,
                            marginBottom: index < tableState.tiers.length - 1 ? ROW_GAP : 0,
                            borderRadius: 8,
                            overflow: 'visible',
                            border: '1px solid var(--color-border)',
                        }}
                    >
                        <div
                            style={{
                                background: tierColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 58,
                                padding: '8px 6px',
                                borderRadius: '8px 0 0 8px',
                            }}
                        >
                            <span
                                style={{
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: getTierLabelFontSize(tier.label),
                                    lineHeight: 1.2,
                                    textAlign: 'center',
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                    maxWidth: '100%',
                                }}
                            >
                                {tier.label}
                            </span>
                        </div>
                        <div
                            style={{
                                background: 'var(--color-bg-card)',
                                padding: '8px 10px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: 6,
                                minHeight: 58,
                                borderRadius: '0 8px 8px 0',
                            }}
                        >
                            {tierItems.map((item) => (
                                <div
                                    key={`${tier.id}-${item.id}`}
                                    title={item.label}
                                    style={{
                                        width: tierSize.w,
                                        height: tierSize.h,
                                        borderRadius: mode === 'legend' ? '50%' : 6,
                                        border: '1px solid var(--color-border-light)',
                                        background: 'var(--color-bg-sub-header)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                    }}
                                >
                                    <img
                                        src={item.image}
                                        alt={item.label}
                                        crossOrigin="anonymous"
                                        draggable={false}
                                        style={{
                                            maxWidth: mode === 'legend' ? '100%' : '92%',
                                            maxHeight: mode === 'legend' ? '100%' : '88%',
                                            objectFit: mode === 'legend' ? 'cover' : 'contain',
                                            transform: mode === 'legend' ? 'scale(1.06)' : undefined,
                                            pointerEvents: 'none',
                                        }}
                                        onError={(e) => { e.currentTarget.src = TIER_FALLBACK_IMG; }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
            <TierTableWatermarkOverlay
                insetRight={TIER_CAPTURE_PAD_X}
                insetBottom={WATERMARK_INSET_BOTTOM}
            />
        </div>
    );
};

export default TierTableCaptureView;

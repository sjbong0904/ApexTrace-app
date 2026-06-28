import type { CSSProperties } from 'react';

export const MATCH_PANEL_HEADER: CSSProperties = {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    height: '36px',
    boxSizing: 'border-box',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg-sub-header)',
    color: 'var(--color-text-muted)',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
};

export const MATCH_PANEL_BODY_PADDING = '10px 12px 12px';

/** Shared row grid — sized to original Combat Log row (8px pad + 20px icon) */
export const MATCH_TIMELINE_ROW_HEIGHT = 36;
export const MATCH_TIMELINE_ROW_GAP = 8;
export const MATCH_TIMELINE_TIME_WIDTH = 40;
export const MATCH_TIMELINE_CONTENT_HEIGHT = 20;

export const matchTimelineRowGap = (isLast: boolean): CSSProperties => ({
    marginBottom: isLast ? 0 : `${MATCH_TIMELINE_ROW_GAP}px`,
});

export const matchTimelineRowStyle = (overrides: CSSProperties = {}): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    height: `${MATCH_TIMELINE_ROW_HEIGHT}px`,
    minHeight: `${MATCH_TIMELINE_ROW_HEIGHT}px`,
    boxSizing: 'border-box',
    padding: '0 8px',
    borderRadius: '4px',
    width: '100%',
    fontSize: '12px',
    ...overrides,
});

export const matchTimelineTimeStyle: CSSProperties = {
    flexShrink: 0,
    width: `${MATCH_TIMELINE_TIME_WIDTH}px`,
    minWidth: `${MATCH_TIMELINE_TIME_WIDTH}px`,
    color: 'var(--color-text-muted)',
    fontSize: '11px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
};

export const matchTimelineContentStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    height: `${MATCH_TIMELINE_CONTENT_HEIGHT}px`,
};

export const matchPanelTabStyle = (active: boolean): CSSProperties => ({
    flex: 1,
    border: 'none',
    borderRight: '1px solid var(--color-border)',
    background: active ? 'var(--color-bg-main)' : 'transparent',
    color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
    padding: '8px 10px',
    height: '36px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    cursor: 'pointer',
    boxSizing: 'border-box',
    boxShadow: active ? 'inset 0 -2px 0 var(--color-warning)' : 'none',
});

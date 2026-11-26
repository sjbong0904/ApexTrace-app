import { useLayoutEffect, useRef, useState } from 'react';
import type { Match } from '../types';
import type { RecentComparison } from '../utils/matchComparison';
import MapVisualizer from './MapVisualizer';
import MatchDetailTabs from './MatchDetailTabs';
import MatchShareActions from './MatchShareActions';

/** Below this detail width the map stacks above the tabs instead of beside them. */
const STACK_BELOW_PX = 900;
/** Share bar under the tabs (copy / save / X / Facebook). */
const SHARE_BAR_PX = 40;
/** Side-by-side height (map + tabs): the old 440px plus the share bar. */
const ROW_HEIGHT_PX = 440 + SHARE_BAR_PX;
/** Stacked: map height follows width, clamped. Tabs keep their own fixed height. */
const STACKED_MAP_MIN_PX = 300;
const STACKED_MAP_MAX_PX = 400;
const STACKED_TABS_PX = 330;

interface MatchDetailBodyProps {
    match: Match;
    isPremium: boolean;
    isExpanded: boolean;
    /** False while the accordion is still animating open: the map (4096² image) mounts after it. */
    mapReady?: boolean;
    modeLabel: string;
    modeColor: string;
    comparison: RecentComparison | null;
    onUserSelect?: (user: { uid: string; name: string }) => void;
}

/**
 * Expanded match: the map is the main view at every size; Overview / Details / Combat log /
 * Loadout tabs sit beside it (wide) or under it (narrow), with the share bar under the tabs. Measured on the detail itself, so the
 * ad rail (free) vs no rail (Premium) picks the right layout in the same window.
 */
const MatchDetailBody = ({ match, isPremium, isExpanded, mapReady = true, modeLabel, modeColor, comparison, onUserSelect }: MatchDetailBodyProps) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [seek, setSeek] = useState<{ t: number; n: number } | null>(null);
    const handleSeek = (t: number) => setSeek((prev) => ({ t, n: (prev?.n ?? 0) + 1 }));

    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        // Measure before first paint: the body now mounts when the row opens, and a 0-width
        // first frame would flip side-by-side → stacked mid-animation.
        setWidth(Math.round(el.getBoundingClientRect().width));
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver((entries) => {
            const box = entries[0]?.contentRect;
            if (box) setWidth(Math.round(box.width));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const stacked = width > 0 && width < STACK_BELOW_PX;
    const mapHeight = Math.min(STACKED_MAP_MAX_PX, Math.max(STACKED_MAP_MIN_PX, Math.round(width * 0.6)));

    return (
        <div
            ref={rootRef}
            style={{
                display: 'flex',
                flexDirection: stacked ? 'column' : 'row',
                height: stacked ? undefined : ROW_HEIGHT_PX,
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-bg-sub-header)',
                minWidth: 0,
            }}
        >
            <div style={{
                flex: stacked ? '0 0 auto' : '1.2 1 0',
                height: stacked ? mapHeight : undefined,
                minWidth: 0,
                position: 'relative',
                overflow: 'hidden',
                borderRight: stacked ? 'none' : '1px solid var(--color-border)',
                borderBottom: stacked ? '1px solid var(--color-border)' : 'none',
            }}>
                {isExpanded && mapReady && <MapVisualizer match={match} isPremium={isPremium} seekRequest={seek} />}
            </div>
            <div style={{
                flex: stacked ? '0 0 auto' : '1 1 0',
                height: stacked ? STACKED_TABS_PX + SHARE_BAR_PX : undefined,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <div style={{ flex: 1, minHeight: 0 }}>
                    <MatchDetailTabs
                        match={match}
                        onUserSelect={onUserSelect}
                        includeCombatLog
                        comparison={comparison}
                        onSeek={handleSeek}
                        seekTimestamp={seek?.t ?? null}
                    />
                </div>
                {/* Not gated on isExpanded: that flips false as soon as the row starts closing,
                    while MatchAccordion keeps this body mounted through the close animation —
                    dropping the bar then let the tabs grow 40px mid-collapse. */}
                <div style={{ flex: `0 0 ${SHARE_BAR_PX}px`, minHeight: 0 }}>
                    <MatchShareActions match={match} modeLabel={modeLabel} modeColor={modeColor} />
                </div>
            </div>
        </div>
    );
};

export default MatchDetailBody;

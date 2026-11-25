import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import MatchStats from './MatchStats';
import LoadoutTimeline from './LoadoutTimeline';
import CombatLog from './CombatLog';
import { MATCH_PANEL_HEADER, matchPanelTabStyle } from './matchPanelStyles';
import type { RecentComparison } from '../utils/matchComparison';

type DetailTab = 'overview' | 'stats' | 'combat' | 'loadout';

/** Show Stats + Loadout side-by-side when the detail panel is wide enough. */
const SPLIT_MIN_WIDTH = 520;

interface MatchDetailTabsProps {
    match: Match;
    onUserSelect?: (user: { uid: string; name: string }) => void;
    /** Always show Loadout | Stats side-by-side (skip width-based tabs). */
    forceSplit?: boolean;
    /** Desktop detail layout: Combat Log is a third tab (the map gets the freed width). Never splits. */
    includeCombatLog?: boolean;
    /** This match vs recent games — shown on the Overview tab (desktop 4-tab layout). */
    comparison?: RecentComparison | null;
    /** Rendered at the right end of the tab bar (e.g. share actions). */
    trailing?: ReactNode;
    /** Combat log / loadout row clicked: move the map replay to this epoch-ms moment. */
    onSeek?: (timestamp: number) => void;
    /** Row last sent to the replay (highlighted). */
    seekTimestamp?: number | null;
}

const PanelTitle = ({ children }: { children: ReactNode }) => (
    <div style={{ ...MATCH_PANEL_HEADER, justifyContent: 'flex-start', gap: 6 }}>
        {children}
    </div>
);

export const MatchLoadoutPanel = ({ match }: { match: Match }) => {
    const { t } = useTranslation();

    return (
        <div style={{
            height: '100%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--color-bg-sub-header)',
        }}>
            <PanelTitle>
                {t('matchDetails.loadout', { defaultValue: 'Loadout' })}
            </PanelTitle>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <LoadoutTimeline match={match} />
            </div>
        </div>
    );
};

export const MatchStatsPanel = ({
    match,
    onUserSelect,
    comparison = null,
}: {
    match: Match;
    onUserSelect?: (user: { uid: string; name: string }) => void;
    comparison?: RecentComparison | null;
}) => {
    const { t } = useTranslation();
    const [view, setView] = useState<'overview' | 'detail'>('overview');

    return (
        <div style={{
            height: '100%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--color-bg-sub-header)',
        }}>
            {/* Narrow 2×2 layout: same Overview / Details split as the wide tab bar. */}
            <div style={{ ...MATCH_PANEL_HEADER, padding: 0, display: 'flex' }}>
                <button type="button" onClick={() => setView('overview')} style={matchPanelTabStyle(view === 'overview')}>
                    {t('matchDetails.overview', { defaultValue: 'Overview' })}
                </button>
                <button type="button" onClick={() => setView('detail')} style={{ ...matchPanelTabStyle(view === 'detail'), borderRight: 'none' }}>
                    {t('matchDetails.detailStats', { defaultValue: 'Details' })}
                </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                <MatchStats match={match} onUserSelect={onUserSelect} view={view} comparison={comparison} />
            </div>
        </div>
    );
};

const SplitPanels = ({
    match,
    onUserSelect,
    rootRef,
}: {
    match: Match;
    onUserSelect?: (user: { uid: string; name: string }) => void;
    rootRef?: RefObject<HTMLDivElement | null>;
}) => (
    <div
        ref={rootRef}
        style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            background: 'var(--color-bg-sub-header)',
            minWidth: 0,
        }}
    >
        <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid var(--color-border)' }}>
            <MatchLoadoutPanel match={match} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <MatchStatsPanel match={match} onUserSelect={onUserSelect} />
        </div>
    </div>
);

const MatchDetailTabs = ({ match, onUserSelect, forceSplit = false, includeCombatLog = false, comparison = null, trailing = null, onSeek, seekTimestamp = null }: MatchDetailTabsProps) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<DetailTab>(includeCombatLog ? 'overview' : 'stats');
    const [measuredSplit, setMeasuredSplit] = useState(forceSplit);
    // Forced modes come straight from props; only the auto mode is measured.
    const split = forceSplit ? true : includeCombatLog ? false : measuredSplit;
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (forceSplit || includeCombatLog) return;

        const el = rootRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;

        const update = (width: number) => setMeasuredSplit(width >= SPLIT_MIN_WIDTH);

        // ResizeObserver reports the current size right after observe(), so no separate first read.
        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? 0;
            update(width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [forceSplit, includeCombatLog]);



    if (split && !includeCombatLog) {
        return <SplitPanels match={match} onUserSelect={onUserSelect} rootRef={rootRef} />;
    }

    return (
        <div
            ref={rootRef}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-sub-header)' }}
        >
            <div style={{ ...MATCH_PANEL_HEADER, padding: 0, display: 'flex' }}>
                {includeCombatLog && (
                    <button type="button" onClick={() => setActiveTab('overview')} style={matchPanelTabStyle(activeTab === 'overview')}>
                        {t('matchDetails.overview', { defaultValue: 'Overview' })}
                    </button>
                )}
                <button type="button" onClick={() => setActiveTab('stats')} style={matchPanelTabStyle(activeTab === 'stats')}>
                    {includeCombatLog
                        ? t('matchDetails.detailStats', { defaultValue: 'Details' })
                        : t('matchDetails.stats', { defaultValue: 'Stats' })}
                </button>
                {includeCombatLog && (
                    <button type="button" onClick={() => setActiveTab('combat')} style={matchPanelTabStyle(activeTab === 'combat')}>
                        {t('combatLog.tabTitle')}
                    </button>
                )}
                <button type="button" onClick={() => setActiveTab('loadout')} style={{ ...matchPanelTabStyle(activeTab === 'loadout'), borderRight: 'none' }}>
                    {t('matchDetails.loadout', { defaultValue: 'Loadout' })}
                </button>
                {trailing}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {activeTab === 'overview' || activeTab === 'stats' ? (
                    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
                        <MatchStats
                            match={match}
                            onUserSelect={onUserSelect}
                            view={includeCombatLog ? (activeTab === 'overview' ? 'overview' : 'detail') : 'full'}
                            comparison={comparison}
                        />
                    </div>
                ) : activeTab === 'combat' ? (
                    <CombatLog match={match} hideHeader onSeek={onSeek} activeTimestamp={seekTimestamp} />
                ) : (
                    <LoadoutTimeline match={match} onSeek={onSeek} activeTimestamp={seekTimestamp} />
                )}
            </div>
        </div>
    );
};

export default MatchDetailTabs;

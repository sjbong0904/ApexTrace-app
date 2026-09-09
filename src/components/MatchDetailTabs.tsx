import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import MatchStats from './MatchStats';
import LoadoutTimeline from './LoadoutTimeline';
import { MATCH_PANEL_HEADER, matchPanelTabStyle } from './matchPanelStyles';

type DetailTab = 'stats' | 'loadout';

/** Show Stats + Loadout side-by-side when the detail panel is wide enough. */
const SPLIT_MIN_WIDTH = 520;

interface MatchDetailTabsProps {
    match: Match;
    onUserSelect?: (user: { uid: string; name: string }) => void;
    /** Always show Loadout | Stats side-by-side (skip width-based tabs). */
    forceSplit?: boolean;
}

const PanelTitle = ({ children }: { children: ReactNode }) => (
    <div style={{ ...MATCH_PANEL_HEADER, justifyContent: 'flex-start', gap: 6 }}>
        {children}
    </div>
);

export const MatchLoadoutPanel = ({ match }: { match: Match }) => {
    const { t } = useTranslation();
    const timelineCount = match.weaponTimeline?.length || 0;

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
                {timelineCount > 0 ? (
                    <span style={{ color: 'var(--color-warning)', fontSize: '10px' }}>
                        {timelineCount}
                    </span>
                ) : null}
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
}: {
    match: Match;
    onUserSelect?: (user: { uid: string; name: string }) => void;
}) => {
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
                {t('matchDetails.stats', { defaultValue: 'Stats' })}
            </PanelTitle>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                <MatchStats match={match} onUserSelect={onUserSelect} />
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

const MatchDetailTabs = ({ match, onUserSelect, forceSplit = false }: MatchDetailTabsProps) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<DetailTab>('stats');
    const [split, setSplit] = useState(forceSplit);
    const rootRef = useRef<HTMLDivElement>(null);
    const timelineCount = match.weaponTimeline?.length || 0;

    useEffect(() => {
        if (forceSplit) {
            setSplit(true);
            return;
        }

        const el = rootRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;

        const update = (width: number) => setSplit(width >= SPLIT_MIN_WIDTH);
        update(el.getBoundingClientRect().width);

        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? 0;
            update(width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [forceSplit]);

    const loadoutBadge = timelineCount > 0 ? (
        <span style={{ marginLeft: '6px', color: 'var(--color-warning)', fontSize: '10px' }}>
            {timelineCount}
        </span>
    ) : null;

    if (split) {
        return <SplitPanels match={match} onUserSelect={onUserSelect} rootRef={rootRef} />;
    }

    return (
        <div
            ref={rootRef}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-sub-header)' }}
        >
            <div style={{ ...MATCH_PANEL_HEADER, padding: 0, display: 'flex' }}>
                <button type="button" onClick={() => setActiveTab('stats')} style={matchPanelTabStyle(activeTab === 'stats')}>
                    {t('matchDetails.stats', { defaultValue: 'Stats' })}
                </button>
                <button type="button" onClick={() => setActiveTab('loadout')} style={{ ...matchPanelTabStyle(activeTab === 'loadout'), borderRight: 'none' }}>
                    {t('matchDetails.loadout', { defaultValue: 'Loadout' })}
                    {loadoutBadge}
                </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {activeTab === 'stats' ? (
                    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
                        <MatchStats match={match} onUserSelect={onUserSelect} />
                    </div>
                ) : (
                    <LoadoutTimeline match={match} />
                )}
            </div>
        </div>
    );
};

export default MatchDetailTabs;

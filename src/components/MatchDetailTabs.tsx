import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import MatchStats from './MatchStats';
import LoadoutTimeline from './LoadoutTimeline';

type DetailTab = 'stats' | 'loadout';

interface MatchDetailTabsProps {
    match: Match;
    onUserSelect?: (user: { uid: string; name: string }) => void;
}

const MatchDetailTabs = ({ match, onUserSelect }: MatchDetailTabsProps) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<DetailTab>('stats');
    const timelineCount = match.weaponTimeline?.length || 0;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-main)' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-sub-header)', flexShrink: 0 }}>
                <button type="button" onClick={() => setActiveTab('stats')} style={tabStyle(activeTab === 'stats')}>
                    {t('matchDetails.stats', { defaultValue: 'Stats' })}
                </button>
                <button type="button" onClick={() => setActiveTab('loadout')} style={tabStyle(activeTab === 'loadout')}>
                    {t('matchDetails.loadoutTimeline', { defaultValue: 'Loadout Timeline' })}
                    {timelineCount > 0 && (
                        <span style={{ marginLeft: '6px', color: 'var(--color-warning)', fontSize: '10px' }}>
                            {timelineCount}
                        </span>
                    )}
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

const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    border: 'none',
    borderRight: '1px solid var(--color-border)',
    borderBottom: active ? '2px solid var(--color-warning)' : '2px solid transparent',
    background: active ? 'var(--color-bg-main)' : 'transparent',
    color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
    padding: '10px 8px',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    cursor: 'pointer',
});

export default MatchDetailTabs;

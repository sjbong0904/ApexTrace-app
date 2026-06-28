import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import MatchStats from './MatchStats';
import LoadoutTimeline from './LoadoutTimeline';
import { MATCH_PANEL_HEADER, matchPanelTabStyle } from './matchPanelStyles';

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
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-sub-header)' }}>
            <div style={{ ...MATCH_PANEL_HEADER, padding: 0, display: 'flex' }}>
                <button type="button" onClick={() => setActiveTab('stats')} style={matchPanelTabStyle(activeTab === 'stats')}>
                    {t('matchDetails.stats', { defaultValue: 'Stats' })}
                </button>
                <button type="button" onClick={() => setActiveTab('loadout')} style={{ ...matchPanelTabStyle(activeTab === 'loadout'), borderRight: 'none' }}>
                    {t('matchDetails.loadout', { defaultValue: 'Loadout' })}
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

export default MatchDetailTabs;

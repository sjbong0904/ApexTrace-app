import React from 'react';
import type { Match } from '../types';
import type { MatchHistory } from '../utils/match';
import Sidebar from './Sidebar';
import SidebarStats from './SidebarStats';
import PerformanceTrend from './PerformanceTrend';

interface UserData {
    uid: string | null;
    name?: string;
    level?: number;
    prestige?: number;
    rankName?: string;
    rankScore?: number;
    rankDiv?: number | null;
    legend?: string | null;
    role?: string;
}

interface InlineProfileSectionProps {
    searchSlot: React.ReactNode;
    /** Mode tabs (BR / Ranked / …) — Dashboard only */
    modeTabsSlot?: React.ReactNode;
    statusMessage?: string;
    user: UserData;
    history: MatchHistory[];
    /** Recent matches for placement trend chart (Dashboard) */
    trendHistory?: Match[];
    isFavorite: boolean;
    isPinned: boolean;
    hasPinnedUser: boolean;
    onToggleFavorite: () => void;
    onTogglePin: () => void;
    onReturnToPinned: () => void;
    compact?: boolean;
    /** Hide pin / favorite controls (web shell). */
    showFavoritePin?: boolean;
}

/**
 * Profile header inside main scroll:
 * mode tabs → search → profile | (stats [+ trend on wide])
 */
const InlineProfileSection: React.FC<InlineProfileSectionProps> = ({
    searchSlot,
    modeTabsSlot,
    statusMessage,
    user,
    history,
    trendHistory,
    isFavorite,
    isPinned,
    hasPinnedUser,
    onToggleFavorite,
    onTogglePin,
    onReturnToPinned,
    compact = false,
    showFavoritePin = true,
}) => {
    const showTrendInStatsColumn = Boolean(trendHistory) && !compact;
    const showTrendBelow = Boolean(trendHistory) && compact;

    return (
        <div id="inline-profile" style={{ marginBottom: compact ? 16 : 24 }}>
            {modeTabsSlot ? (
                <div style={{ marginBottom: 12 }}>
                    {modeTabsSlot}
                </div>
            ) : null}

            <div style={{ marginBottom: 12, maxWidth: 480 }}>
                {searchSlot}
                {statusMessage ? (
                    <div style={{
                        color: 'var(--color-danger)',
                        fontSize: 11,
                        marginTop: 6,
                        fontWeight: 'bold',
                    }}>
                        {statusMessage}
                    </div>
                ) : null}
            </div>

            <div
                style={{
                    display: 'grid',
                    /* Stable width ratio: profile ~38%, stats ~62% (both screens) */
                    gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.45fr)',
                    gap: compact ? 10 : 12,
                    alignItems: 'stretch',
                }}
            >
                <div
                    style={{
                        borderRadius: 12,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-card)',
                        overflow: 'hidden',
                        minHeight: 0,
                        minWidth: 0,
                    }}
                >
                    <Sidebar
                        layout="inline"
                        dense={compact}
                        user={user}
                        history={history}
                        isFavorite={isFavorite}
                        isPinned={isPinned}
                        hasPinnedUser={hasPinnedUser}
                        onToggleFavorite={onToggleFavorite}
                        onTogglePin={onTogglePin}
                        onReturnToPinned={onReturnToPinned}
                        showFavoritePin={showFavoritePin}
                    />
                </div>

                <div
                    style={{
                        borderRadius: 12,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-card)',
                        overflow: 'hidden',
                        minWidth: 0,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                    }}
                >
                    <div style={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        <SidebarStats history={history} layout="inline" dense={compact} />
                    </div>

                    {showTrendInStatsColumn && trendHistory ? (
                        <div style={{
                            flex: '0 0 auto',
                            borderTop: '1px solid var(--color-border)',
                            padding: '8px 12px 10px',
                        }}>
                            <PerformanceTrend history={trendHistory} embedded />
                        </div>
                    ) : null}
                </div>
            </div>

            {showTrendBelow && trendHistory ? (
                <div
                    style={{
                        marginTop: 10,
                        borderRadius: 12,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-card)',
                        padding: '10px 12px 12px',
                    }}
                >
                    <PerformanceTrend history={trendHistory} embedded />
                </div>
            ) : null}
        </div>
    );
};

export default InlineProfileSection;

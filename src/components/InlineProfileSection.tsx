import React from 'react';
import type { Match } from '../types';
import type { MatchHistory } from '../utils/match';
import Sidebar from './Sidebar';
import SidebarStats from './SidebarStats';

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
    currentXp?: number | null;
    neededXp?: number | null;
}

interface InlineProfileSectionProps {
    searchSlot: React.ReactNode;
    /** Mode tabs (BR / Ranked / …) — Dashboard only */
    modeTabsSlot?: React.ReactNode;
    statusMessage?: string;
    user: UserData;
    history: MatchHistory[];
    /** Mode/season-filtered matches (newest first) for the LAST 20 card: RP chart, placement blocks, summary. */
    trendHistory?: Match[];
    isFavorite: boolean;
    isPinned: boolean;
    hasPinnedUser: boolean;
    onToggleFavorite: () => void;
    onTogglePin: () => void;
    onReturnToPinned: () => void;
    /** Manual profile refresh — shown next to the player name. */
    onRefresh?: () => void;
    refreshCooldown?: number;
    compact?: boolean;
    /** Hide pin / favorite controls (web shell). */
    showFavoritePin?: boolean;
    /** Premium: account (GEP player_stats) scopes in the stats card. */
    isPremium?: boolean;
}

/** Profile : stats — stats column holds the RP chart + placement blocks. */
const PROFILE_STATS_COLUMNS = 'minmax(0, 1fr) minmax(0, 1.75fr)';

/**
 * Profile header inside main scroll:
 * col1: search → mode tabs → profile | stats [+ trend]
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
    onRefresh,
    refreshCooldown = 0,
    compact = false,
    showFavoritePin = true,
    isPremium = false,
}) => {
    const profileStackRows = modeTabsSlot ? 3 : 2;
    const cardsRow = profileStackRows;

    return (
        <div id="inline-profile" style={{ marginBottom: compact ? 16 : 24 }}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: PROFILE_STATS_COLUMNS,
                    gridTemplateRows: modeTabsSlot
                        ? 'auto auto minmax(0, auto)'
                        : 'auto minmax(0, auto)',
                    columnGap: 12,
                    rowGap: compact ? 10 : 12,
                    alignItems: 'stretch',
                    width: '100%',
                    minWidth: 0,
                }}
            >
                <div style={{ gridColumn: 1, gridRow: 1, minWidth: 0 }}>
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

                {modeTabsSlot ? (
                    <div style={{ gridColumn: '1 / -1', gridRow: 2, minWidth: 0 }}>
                        {modeTabsSlot}
                    </div>
                ) : null}

                <div
                    style={{
                        gridColumn: 1,
                        gridRow: cardsRow,
                        borderRadius: 12,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-card)',
                        overflow: 'hidden',
                        minHeight: 0,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
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
                        onRefresh={onRefresh}
                        refreshCooldown={refreshCooldown}
                        showFavoritePin={showFavoritePin}
                        isPremium={isPremium}
                    />
                </div>

                <div
                    style={{
                        gridColumn: 2,
                        gridRow: cardsRow,
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
                        <SidebarStats
                            history={(trendHistory as unknown as MatchHistory[] | undefined) ?? history}
                            layout="inline"
                            dense={compact}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
};

export default InlineProfileSection;

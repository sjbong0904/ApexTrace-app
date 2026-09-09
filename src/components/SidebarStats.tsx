import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchHistory } from '../utils/match';
import { hasUsableMatchStats } from '../utils/match';
import {
    getAvgAssistsColor,
    getAvgDamageColor,
    getAvgKillsColor,
    getAvgKnocksColor,
    getAvgPlacementColor,
    getWinRateColor,
    isKnownLegend,
} from '../utils/helpers';

interface SidebarStatsProps {
    history: MatchHistory[];
    layout?: 'panel' | 'inline';
    /** Tighter cards for narrow side-by-side layouts */
    dense?: boolean;
}

const STAT_CARD_STYLE: React.CSSProperties = {
    textAlign: 'center',
    padding: '8px 6px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    height: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
};

const StatCard = ({
    label,
    value,
    color = 'var(--color-text-primary)',
    dense = false,
}: {
    label: string;
    value: string | number;
    color?: string;
    dense?: boolean;
}) => (
    <div style={{
        ...STAT_CARD_STYLE,
        padding: dense ? '6px 4px' : '8px 6px',
    }}>
        <div style={{
            fontSize: dense ? 8 : 9,
            color: 'var(--color-text-muted)',
            marginBottom: dense ? 2 : 4,
            fontWeight: 600,
            lineHeight: 1.25,
            flexShrink: 0,
        }}>
            {label}
        </div>
        <div style={{
            fontSize: dense ? 13 : 15,
            fontWeight: 'bold',
            color,
            lineHeight: 1.2,
            flexShrink: 0,
        }}>
            {value}
        </div>
    </div>
);

const SidebarStats: React.FC<SidebarStatsProps> = ({ history, layout = 'panel', dense = false }) => {
    const { t } = useTranslation();
    const isInline = layout === 'inline';

    const stats = useMemo(() => {
        const recentMatches = history
            .filter(m => isKnownLegend(m.legend) && hasUsableMatchStats(m))
            .slice(0, 20);
        const count = recentMatches.length;
        if (count === 0) return null;

        let wins = 0, totalKills = 0, totalAssists = 0, totalDamage = 0, totalPlacement = 0, totalKnocks = 0;

        recentMatches.forEach(m => {
            if (m.placement === 1) wins++;
            totalKills += m.kills ?? 0;
            totalAssists += m.assists ?? 0;
            totalDamage += m.damage ?? 0;
            totalKnocks += m.knocks ?? 0;
            totalPlacement += typeof m.placement === 'number' ? m.placement : Number(m.placement) || 20;
        });

        const avgDamage = Math.round(totalDamage / count);

        return {
            count,
            winRate: ((wins / count) * 100).toFixed(0),
            avgPlacement: (totalPlacement / count).toFixed(1),
            avgKills: (totalKills / count).toFixed(1),
            avgKnocks: (totalKnocks / count).toFixed(1),
            avgAssists: (totalAssists / count).toFixed(1),
            avgDamage,
            avgDamageLabel: avgDamage.toLocaleString(),
        };
    }, [history]);

    if (!stats) {
        return (
            <div style={{
                fontSize: '11px',
                height: isInline ? 'auto' : '100%',
                minHeight: isInline ? 120 : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-faint)',
                background: isInline ? 'transparent' : 'var(--color-bg-sub-header)',
                padding: isInline ? 16 : undefined,
            }}>
                {t('sidebarStats.noMatches')}
            </div>
        );
    }

    const winRateNum = parseFloat(stats.winRate);
    const cellMinH = dense ? 52 : 60;

    return (
        <div style={{
            width: '100%',
            height: '100%',
            padding: isInline ? (dense ? '10px 8px' : '12px 12px 10px') : '12px 10px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            background: isInline ? 'transparent' : 'var(--color-bg-sub-header)',
            minHeight: 0,
        }}>
            <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                marginBottom: dense ? 6 : 8,
                flexShrink: 0,
                letterSpacing: '0.02em',
            }}>
                {t('sidebarStats.recentGames', { count: stats.count })}
            </div>

            <div style={{
                display: 'grid',
                /* compact (dense): 2×3; normal/large: 3×2 */
                gridTemplateColumns: isInline
                    ? (dense ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))')
                    : '1fr 1fr',
                gridTemplateRows: isInline
                    ? (dense
                        ? `repeat(3, minmax(${cellMinH}px, 1fr))`
                        : `repeat(2, minmax(${cellMinH}px, 1fr))`)
                    : 'repeat(3, 1fr)',
                gap: dense ? 5 : 8,
                flex: 1,
                minHeight: 0,
                alignItems: 'stretch',
            }}>
                <StatCard
                    dense={dense}
                    label={t('sidebarStats.winRate')}
                    value={`${stats.winRate}%`}
                    color={getWinRateColor(winRateNum)}
                />
                <StatCard
                    dense={dense}
                    label={t('sidebarStats.avgPlacement')}
                    value={`#${stats.avgPlacement}`}
                    color={getAvgPlacementColor(stats.avgPlacement)}
                />
                <StatCard
                    dense={dense}
                    label={t('sidebarStats.avgKills')}
                    value={stats.avgKills}
                    color={getAvgKillsColor(stats.avgKills)}
                />
                <StatCard
                    dense={dense}
                    label={t('sidebarStats.avgKnocks')}
                    value={stats.avgKnocks}
                    color={getAvgKnocksColor(stats.avgKnocks)}
                />
                <StatCard
                    dense={dense}
                    label={t('sidebarStats.avgAssists')}
                    value={stats.avgAssists}
                    color={getAvgAssistsColor(stats.avgAssists)}
                />
                <StatCard
                    dense={dense}
                    label={t('sidebarStats.avgDamage')}
                    value={stats.avgDamageLabel}
                    color={getAvgDamageColor(stats.avgDamage)}
                />
            </div>
        </div>
    );
};

export default SidebarStats;

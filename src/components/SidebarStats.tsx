import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchHistory } from '../utils/match';
import { hasUsableMatchStats } from '../utils/match';
import { isKnownLegend, normalizeLegendKey, getAvgPlacementColor, getWinRateColor } from '../utils/helpers';
import { formatLegendDisplayName } from '../utils/statsAggregation';

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

/** Same footprint as StatCard: label + compact value row (avatar + name). */
const LegendCard = ({ label, legendName, dense = false }: { label: string; legendName: string; dense?: boolean }) => {
    const avatarPx = dense ? 18 : 22;
    const displayName = legendName === '-' ? legendName : formatLegendDisplayName(legendName);
    const imageKey = legendName === '-' ? 'unknown' : legendName.toLowerCase();
    return (
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: dense ? 4 : 6,
                minWidth: 0,
                maxWidth: '100%',
                flexShrink: 0,
            }}>
                <img
                    src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${imageKey}.png`}
                    alt={displayName}
                    style={{
                        width: avatarPx,
                        height: avatarPx,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '1px solid var(--color-border-light)',
                        background: 'var(--color-bg-deep)',
                    }}
                    onError={(e) => {
                        (e.target as HTMLImageElement).src =
                            'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png';
                    }}
                />
                <span style={{
                    fontSize: dense ? 11 : 13,
                    fontWeight: 'bold',
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                }}>
                    {displayName}
                </span>
            </div>
        </div>
    );
};

const SidebarStats: React.FC<SidebarStatsProps> = ({ history, layout = 'panel', dense = false }) => {
    const { t } = useTranslation();
    const isInline = layout === 'inline';

    const stats = useMemo(() => {
        const recentMatches = history
            .filter(m => isKnownLegend(m.legend) && hasUsableMatchStats(m))
            .slice(0, 20);
        const count = recentMatches.length;
        if (count === 0) return null;

        let wins = 0, totalKills = 0, totalAssists = 0, totalDamage = 0, totalPlacement = 0;
        const legendCounts: Record<string, number> = {};

        recentMatches.forEach(m => {
            if (m.placement === 1) wins++;
            totalKills += m.kills ?? 0;
            totalAssists += m.assists ?? 0;
            totalDamage += m.damage ?? 0;
            totalPlacement += typeof m.placement === 'number' ? m.placement : Number(m.placement) || 20;
            const legend = normalizeLegendKey(m.legend);
            legendCounts[legend] = (legendCounts[legend] || 0) + 1;
        });

        const sortedLegends = Object.entries(legendCounts).sort((a, b) => b[1] - a[1]);
        const mostUsedLegend = sortedLegends[0]?.[0] ?? '-';

        return {
            count,
            winRate: ((wins / count) * 100).toFixed(0),
            avgPlacement: (totalPlacement / count).toFixed(1),
            avgKills: (totalKills / count).toFixed(1),
            avgAssists: (totalAssists / count).toFixed(1),
            avgDamage: Math.round(totalDamage / count).toLocaleString(),
            mostLegend: mostUsedLegend,
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
                    color="var(--color-warning)"
                />
                <StatCard
                    dense={dense}
                    label={t('sidebarStats.avgDamage')}
                    value={stats.avgDamage}
                    color="#ffa502"
                />
                <StatCard
                    dense={dense}
                    label={t('sidebarStats.avgAssists')}
                    value={stats.avgAssists}
                    color="#54a0ff"
                />
                <LegendCard dense={dense} label={t('sidebarStats.mostPlayed')} legendName={stats.mostLegend} />
            </div>
        </div>
    );
};

export default SidebarStats;

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchHistory } from '../utils/match';
import { isKnownLegend, normalizeLegendKey } from '../utils/helpers';

interface SidebarStatsProps {
    history: MatchHistory[];
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
    overflow: 'hidden',
};

const StatCard = ({
    label,
    value,
    color = 'var(--color-text-primary)',
}: {
    label: string;
    value: string | number;
    color?: string;
}) => (
    <div style={STAT_CARD_STYLE}>
        <div style={{
            fontSize: '9px',
            color: 'var(--color-text-muted)',
            marginBottom: '4px',
            fontWeight: 600,
            lineHeight: 1.25,
        }}>
            {label}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 'bold', color, lineHeight: 1.2 }}>{value}</div>
    </div>
);

const LegendCard = ({ label, legendName }: { label: string; legendName: string }) => (
    <div style={{ ...STAT_CARD_STYLE, padding: '6px 6px 8px', justifyContent: 'flex-start' }}>
        <div style={{
            fontSize: '9px',
            color: 'var(--color-text-muted)',
            marginBottom: '4px',
            fontWeight: 600,
            lineHeight: 1.25,
            flexShrink: 0,
        }}>
            {label}
        </div>
        <div style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <img
                src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${legendName.toLowerCase()}.png`}
                alt={legendName}
                style={{ maxHeight: '100%', maxWidth: '78%', objectFit: 'contain' }}
                onError={(e) => {
                    (e.target as HTMLImageElement).src =
                        'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png';
                }}
            />
        </div>
        <div style={{
            fontSize: '11px',
            fontWeight: 'bold',
            color: 'var(--color-text-primary)',
            lineHeight: 1.2,
            marginTop: '2px',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        }}>
            {legendName}
        </div>
    </div>
);

const getAvgPlacementColor = (avgPlacement: string | number): string => {
    const val = typeof avgPlacement === 'number' ? avgPlacement : parseFloat(avgPlacement);
    if (isNaN(val)) return 'var(--color-text-muted)';
    if (val <= 3) return '#fdcb6e';
    if (val <= 5) return '#4ade80';
    return 'var(--color-text-muted)';
};

const SidebarStats: React.FC<SidebarStatsProps> = ({ history }) => {
    const { t } = useTranslation();

    const stats = useMemo(() => {
        const recentMatches = history.filter(m => isKnownLegend(m.legend)).slice(0, 20);
        const count = recentMatches.length;
        if (count === 0) return null;

        let wins = 0, totalKills = 0, totalAssists = 0, totalDamage = 0, totalPlacement = 0;
        const legendCounts: Record<string, number> = {};

        recentMatches.forEach(m => {
            if (m.placement === 1) wins++;
            totalKills += m.kills ?? 0;
            totalAssists += m.assists ?? 0;
            totalDamage += m.damage ?? 0;
            totalPlacement += m.placement ?? 20;
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
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-faint)',
                background: 'var(--color-bg-sub-header)',
            }}>
                {t('sidebarStats.noMatches')}
            </div>
        );
    }

    const winRateNum = parseFloat(stats.winRate);

    return (
        <div style={{
            width: '100%',
            height: '100%',
            padding: '12px 10px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg-sub-header)',
        }}>
            <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                marginBottom: '8px',
                flexShrink: 0,
                letterSpacing: '0.02em',
            }}>
                {t('sidebarStats.recentGames', { count: stats.count })}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: 'repeat(3, 1fr)',
                gap: '6px',
                flex: 1,
                minHeight: 0,
            }}>
                <StatCard
                    label={t('sidebarStats.winRate')}
                    value={`${stats.winRate}%`}
                    color={winRateNum >= 10 ? '#4ade80' : 'var(--color-text-primary)'}
                />
                <StatCard
                    label={t('sidebarStats.avgPlacement')}
                    value={`#${stats.avgPlacement}`}
                    color={getAvgPlacementColor(stats.avgPlacement)}
                />
                <StatCard
                    label={t('sidebarStats.avgKills')}
                    value={stats.avgKills}
                    color="var(--color-warning)"
                />
                <StatCard
                    label={t('sidebarStats.avgDamage')}
                    value={stats.avgDamage}
                    color="#ffa502"
                />
                <StatCard
                    label={t('sidebarStats.avgAssists')}
                    value={stats.avgAssists}
                    color="#54a0ff"
                />
                <LegendCard label={t('sidebarStats.mostPlayed')} legendName={stats.mostLegend} />
            </div>
        </div>
    );
};

export default SidebarStats;

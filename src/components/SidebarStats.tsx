import React, { useMemo } from 'react';
import { FaTrophy, FaMedal, FaSkull, FaHandsHelping, FaFire, FaChartLine } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import type { MatchHistory } from '../utils/match';

interface SidebarStatsProps {
    history: MatchHistory[];
}

// ✅ 컴포넌트 외부로 이동 — 렌더마다 재생성 방지
interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
}

const StatCard = ({ icon, label, value, color }: StatCardProps) => (
    <div style={{
        background: '#222', borderRadius: '4px', padding: '4px 2px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: '1px solid #333', position: 'relative', overflow: 'hidden',
        minHeight: '0'
    }}>
        <div style={{ fontSize: '9px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '1px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ color }}>{icon}</span> {label}
        </div>
        <div style={{ fontSize: '14px', fontWeight: '800', color: '#eee', lineHeight: '1.1' }}>{value}</div>
    </div>
);

const SidebarStats: React.FC<SidebarStatsProps> = ({ history }) => {
    const { t } = useTranslation();

    const stats = useMemo(() => {
        const recentMatches = history.slice(0, 20);
        const count = recentMatches.length;
        if (count === 0) return null;

        let wins = 0, top5 = 0, totalKills = 0, totalAssists = 0, totalDamage = 0;
        const legendCounts: Record<string, number> = {};

        recentMatches.forEach(m => {
            if (m.placement === 1) wins++;
            if ((m.placement ?? 20) <= 5) top5++;
            totalKills += m.kills ?? 0;
            totalAssists += m.assists ?? 0;
            totalDamage += m.damage ?? 0;
            const legend = m.legend ?? 'unknown';
            legendCounts[legend] = (legendCounts[legend] || 0) + 1;
        });

        const sortedLegends = Object.entries(legendCounts).sort((a, b) => b[1] - a[1]);
        const mostUsedLegend = sortedLegends[0]?.[0] ?? 'unknown';

        return {
            count,
            winRate: ((wins / count) * 100).toFixed(0),
            top5Rate: ((top5 / count) * 100).toFixed(0),
            avgKills: (totalKills / count).toFixed(1),
            avgAssists: (totalAssists / count).toFixed(1),
            avgDamage: Math.round(totalDamage / count).toLocaleString(),
            mostLegend: mostUsedLegend
        };
    }, [history]);

    if (!stats) {
        return (
            <div style={{ fontSize: '11px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666', background: '#1a1a1a' }}>
                <div style={{ fontSize: '11px' }}>{t('sidebarStats.noMatches')}</div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', padding: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: '#1a1a1a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#e67e22', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FaChartLine /> {t('sidebarStats.recentGames', { count: stats.count })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(3, 1fr)', gap: '5px', flex: 1, minHeight: 0 }}>
                <StatCard icon={<FaTrophy size={10} />} label={t('sidebarStats.winRate')} value={`${stats.winRate}%`} color="#f1c40f" />
                <StatCard icon={<FaMedal size={10} />} label={t('sidebarStats.top5Rate')} value={`${stats.top5Rate}%`} color="#9b59b6" />
                <StatCard icon={<FaSkull size={10} />} label={t('sidebarStats.avgKills')} value={stats.avgKills} color="#e74c3c" />
                <StatCard icon={<FaFire size={10} />} label={t('sidebarStats.avgDamage')} value={stats.avgDamage} color="#e67e22" />
                <StatCard icon={<FaHandsHelping size={10} />} label={t('sidebarStats.avgAssists')} value={stats.avgAssists} color="#3498db" />

                {/* 모스트 레전드 */}
                <div style={{
                    background: '#222', borderRadius: '4px', padding: '0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #333', position: 'relative', overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '12px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', zIndex: 1 }} />
                    <div style={{ position: 'absolute', top: '2px', width: '100%', textAlign: 'center', fontSize: '8px', color: '#2ecc71', fontWeight: 'bold', zIndex: 2, textShadow: '0 1px 2px black' }}>
                        {t('sidebarStats.mostPlayed')}
                    </div>
                    <img
                        src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${stats.mostLegend.toLowerCase()}.png`}
                        alt={stats.mostLegend}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.1) translateY(-10px)', filter: 'brightness(0.9)' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png'; }}
                    />
                    <div style={{ position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '9px', fontWeight: 'bold', textAlign: 'center', padding: '1px 0' }}>
                        {stats.mostLegend.toUpperCase()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SidebarStats;
import React, { useState, useMemo } from 'react';
import {
    CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, Legend as RechartsLegend,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ComposedChart, Line, Bar, XAxis, YAxis
} from 'recharts';
import { FaLock, FaCrown, FaHistory, FaInfoCircle } from 'react-icons/fa';
import { COLORS, TARGET_MAPS, MAP_THUMBNAILS, LEGENDS_LIST, SHORT_WEAPON_NAMES } from '../utils/gameData';
import { useTranslation } from 'react-i18next';
import type { MatchHistory, Season } from '../utils/match';

const formatDuration = (ms: number): string => {
    if (!ms) return "0m 0s";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
};

// ✅ MatchHistory 타입 적용
const calculateStats = (matches: MatchHistory[]) => {
    if (matches.length === 0) return null;
    const totalMatches = matches.length;
    const totalKills = matches.reduce((sum, m) => sum + (m.kills || 0), 0);
    const totalDamage = matches.reduce((sum, m) => sum + (m.damage || 0), 0);
    const totalAssists = matches.reduce((sum, m) => sum + (m.assists || 0), 0);
    const totalWins = matches.filter(m => m.placement === 1).length;
    const totalTop5 = matches.filter(m => (m.placement ?? 20) <= 5).length;
    const totalDeaths = totalMatches - totalWins;
    const totalTime = matches.reduce((sum, m: any) => sum + ((m.endTime || Date.now()) - m.startTime), 0);
    const totalPlacement = matches.reduce((sum, m) => sum + (m.placement ?? 20), 0);
    const maxKills = Math.max(...matches.map(m => m.kills || 0));
    const totalsquadKills = matches.reduce((sum, m: any) => sum + (m.squadKills || 0), 0);
    const legendCounts: Record<string, number> = {};
    matches.forEach(m => {
        const l = (m.legend || 'unknown').toLowerCase();
        legendCounts[l] = (legendCounts[l] || 0) + 1;
    });
    const mostLegend = Object.entries(legendCounts).sort((a, b) => b[1] - a[1])[0];
    const weaponCounts: Record<string, number> = {};
    matches.forEach(m => {
        if (m.loadout?.primary) weaponCounts[m.loadout.primary] = (weaponCounts[m.loadout.primary] || 0) + 1;
        if (m.loadout?.secondary) weaponCounts[m.loadout.secondary] = (weaponCounts[m.loadout.secondary] || 0) + 1;
    });
    const mostWeapon = Object.entries(weaponCounts).sort((a, b) => b[1] - a[1])[0];
    const myContribution = totalKills + (totalAssists * 0.5);
    const actualSquadKills = totalsquadKills > 0 ? totalsquadKills : (totalKills || 1);
    const contributionRate = (myContribution / actualSquadKills) * 100;

    return {
        matches: totalMatches,
        wins: totalWins,
        totalDamage,
        winRate: ((totalWins / totalMatches) * 100).toFixed(1),
        top5Rate: ((totalTop5 / totalMatches) * 100).toFixed(1),
        kills: totalKills,
        deaths: totalDeaths,
        kd: totalDeaths === 0 ? totalKills : (totalKills / totalDeaths).toFixed(2),
        avgDamage: Math.round(totalDamage / totalMatches),
        avgTime: formatDuration(totalTime / totalMatches),
        avgTimeSec: Math.round(totalTime / totalMatches / 1000),
        avgmin: Math.floor(Math.round(totalTime / totalMatches / 1000) / 60),
        avgsec: Math.round(Math.round(totalTime / totalMatches / 1000) % 60),
        mostLegend: mostLegend ? mostLegend[0] : '-',
        mostWeapon: mostWeapon ? mostWeapon[0].replace('weapon_', '').toUpperCase() : '-',
        avgKills: (totalKills / totalMatches).toFixed(1),
        avgPlacement: (totalPlacement / totalMatches).toFixed(1),
        maxKills,
        squadKills: totalsquadKills,
        assists: totalAssists,
        lograte: Math.min(contributionRate, 100).toFixed(1)
    };
};

// ✅ 타입 정의
interface BigStatBoxProps {
    title: string;
    value: string | number;
    sub: string;
    icon?: React.ReactNode;
    color: string;
}

interface InfoRowProps {
    label: string;
    value: string | number;
    highlight?: boolean;
}

interface EmptyStateProps {
    msg?: string;
}

// ✅ borderLeft 안티패턴 → borderTop으로 변경
const BigStatBox = ({ title, value, sub, icon, color }: BigStatBoxProps) => (
    <div style={{
        background: 'var(--color-bg-card)', padding: '15px', borderRadius: '10px',
        borderTop: `3px solid ${color}`,
        display: 'flex', flexDirection: 'column', justifyContent: 'center'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>{title}</div>
            <div style={{ fontSize: '14px' }}>{icon}</div>
        </div>
        <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{value}</div>
        <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>{sub}</div>
    </div>
);

const InfoRow = ({ label, value, highlight = false }: InfoRowProps) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{label}</span>
        <span style={{ color: highlight ? 'var(--color-text-primary)' : 'var(--color-text-dim)', fontWeight: highlight ? 'bold' : 'normal', fontSize: highlight ? '15px' : '13px' }}>{value}</span>
    </div>
);

const EmptyState = ({ msg }: EmptyStateProps) => {
    const { t } = useTranslation();
    return (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-faint)', border: '2px dashed var(--color-border)', borderRadius: '10px' }}>
            <h3>{t('statistics.emptyState.title')}</h3>
            {/* ✅ 하드코딩 제거 */}
            <p>{msg || t('statistics.emptyState.noData')}</p>
        </div>
    );
};

const PremiumLockView = ({ title }: { title: string }) => {
    const { t } = useTranslation();
    return (
        <div style={{ animation: 'fadeIn 0.3s', padding: '40px 0' }}>
            <div
                onClick={() => { alert(t('premium.redirecting')); }}
                style={{
                    background: `repeating-linear-gradient(45deg, var(--color-bg-sub-header), var(--color-bg-sub-header) 10px, var(--color-bg-table-header) 10px, var(--color-bg-table-header) 20px)`,
                    border: '2px dashed var(--color-border-light)', borderRadius: '12px', padding: '60px 20px',
                    textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '15px', transition: 'all 0.2s',
                    maxWidth: '600px', margin: '0 auto'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-warning)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}
            >
                <div style={{
                    background: 'var(--color-bg-card-hover)', width: '60px', height: '60px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                }}>
                    <FaLock size={24} color="var(--color-text-dim)" />
                </div>
                <div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '5px' }}>
                        {t('statistics.premiumLock.unlockAnalytics', { title })}
                    </div>
                    {/* ✅ 하드코딩 제거 */}
                    <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                        {t('statistics.premiumLock.goBeyond')}<br />
                        {t('statistics.premiumLock.getDetailedInsights')}
                    </div>
                </div>
                <button style={{
                    marginTop: '10px', padding: '12px 30px',
                    background: 'linear-gradient(90deg, var(--color-warning) 0%, var(--color-warning-hover) 100%)',
                    border: 'none', borderRadius: '6px', color: 'var(--color-text-primary)',
                    fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 6px rgba(230, 126, 34, 0.3)'
                }}>
                    <FaCrown /> {t('statistics.premiumLock.upgradeToPremium')}
                </button>
            </div>
        </div>
    );
};

const OverviewView = ({ data }: { data: MatchHistory[] }) => {
    const { t } = useTranslation();
    const stats = calculateStats(data);
    const { radarData, totalTier, totalScore } = useMemo(() => {
        if (!stats) return { radarData: [], totalTier: '-', totalScore: 0 };
        const scoreKD = Math.min((parseFloat(stats.kd as string) / 4.0) * 100, 100);
        const scoreDmg = Math.min((stats.avgDamage / 1000) * 100, 100);
        const scoreSurv = Math.min((stats.avgTimeSec / 900) * 100, 100);
        const myContribution = stats.kills + (stats.assists * 0.5);
        const teamTotal = stats.squadKills > 0 ? stats.squadKills : myContribution;
        let carryRate = teamTotal > 0 ? myContribution / teamTotal : 0;
        if (carryRate > 1) carryRate = 1;
        let scoreContrib = 0;
        if (carryRate >= 0.66) scoreContrib = 100;
        else if (carryRate >= 0.33) scoreContrib = 70 + ((carryRate - 0.33) / 0.33) * 30;
        else scoreContrib = (carryRate / 0.33) * 70;

        const rawPlacement = parseFloat(stats.avgPlacement);
        let scorePlace = 0;
        if (rawPlacement <= 5) scorePlace = 100;
        else if (rawPlacement >= 15) scorePlace = 0;
        else scorePlace = ((15 - rawPlacement) / 10) * 100;

        const scorePlacementCombined = (scorePlace * 0.7) + (scoreSurv * 0.3);
        const scorePeak = Math.min((stats.maxKills / 15) * 100, 100);
        let weightedScore = (scoreKD * 0.30) + (scoreDmg * 0.25) + (scorePlacementCombined * 0.20) + (scorePeak * 0.10) + (scoreContrib * 0.15);

        if (parseFloat(stats.kd as string) < 0.5) weightedScore -= 15;
        if (stats.avgDamage < 250) weightedScore -= 15;
        if (rawPlacement > 16) weightedScore -= 15;
        weightedScore = Math.max(0, Math.min(weightedScore, 100));

        let tier = 'None';
        if (weightedScore >= 97) tier = 'SSS';
        else if (weightedScore >= 90) tier = 'SS';
        else if (weightedScore >= 85) tier = 'S';
        else if (weightedScore >= 80) tier = 'A+';
        else if (weightedScore >= 75) tier = 'A';
        else if (weightedScore >= 70) tier = 'A-';
        else if (weightedScore >= 65) tier = 'B+';
        else if (weightedScore >= 60) tier = 'B';
        else if (weightedScore >= 55) tier = 'B-';
        else if (weightedScore >= 50) tier = 'C+';
        else if (weightedScore >= 45) tier = 'C';
        else if (weightedScore >= 40) tier = 'C-';
        else if (weightedScore >= 35) tier = 'D+';
        else if (weightedScore >= 30) tier = 'D';
        else tier = 'D-';

        return {
            radarData: [
                { subject: 'Combat', A: scoreKD, fullMark: 100 },
                { subject: 'Damage', A: scoreDmg, fullMark: 100 },
                { subject: 'Survival', A: scorePlace, fullMark: 100 },
                { subject: 'Potential', A: scorePeak, fullMark: 100 },
                { subject: 'Carry', A: scoreContrib, fullMark: 100 },
            ],
            totalTier: tier,
            totalScore: Math.round(weightedScore),
        };
    }, [stats]);

    const trendData = useMemo(() => {
        return [...data].slice(0, 20).reverse().map((m: any, i) => ({
            name: `${i + 1}`,
            kills: m.kills || 0,
            damage: m.damage || 0,
            placement: parseInt(m.placement) || 20
        }));
    }, [data]);

    if (!stats) return <EmptyState />;

    return (
        <div style={{ animation: 'fadeIn 0.5s' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', height: '320px' }}>
                <div style={{ flex: 1, background: 'var(--color-bg-sub-header)', borderRadius: '12px', border: '1px solid var(--color-border)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '15px', left: '20px', fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                        <span style={{ color: COLORS.NEON_RED }}>◆</span> {t('statistics.overview.analytics')}
                    </div>
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <RadarChart cx="50%" cy="55%" outerRadius="70%" data={radarData}>
                            <PolarGrid stroke="var(--color-border-light)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--color-text-dim)', fontSize: 10, fontWeight: 'bold' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Stats" dataKey="A" stroke={COLORS.NEON_ORANGE} strokeWidth={3} fill={COLORS.NEON_ORANGE} fillOpacity={0.4} />
                        </RadarChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', bottom: '15px', right: '20px', textAlign: 'right' }}>
                        <div style={{ fontSize: '42px', fontWeight: '900', color: totalScore >= 80 ? 'var(--color-text-primary)' : (totalScore >= 50 ? 'var(--color-text-dim)' : 'var(--color-text-faint)'), letterSpacing: '-2px', lineHeight: '1' }}>
                            <span style={{ fontSize: '16px', color: COLORS.NEON_RED, marginLeft: '5px' }}>{t('statistics.overview.tier')} </span>{totalTier}
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1.2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <BigStatBox title={t('statistics.overview.kdRatio')} value={stats.kd} sub={t('statistics.overview.totalKills', { count: stats.kills })} color="var(--color-danger)" />
                    <BigStatBox title={t('statistics.overview.avgDamage')} value={stats.avgDamage} sub={t('statistics.overview.totalDamage', { count: stats.totalDamage })} color="#ffa502" />
                    <BigStatBox title={t('statistics.overview.avgSurvival')} value={`#${stats.avgPlacement}`} sub={t('statistics.overview.avgSurvivedTime', { m: stats.avgmin, s: stats.avgsec })} color="#54a0ff" />
                    <BigStatBox title={t('statistics.overview.performance')} value={t('statistics.overview.peakKills', { count: stats.maxKills })} sub={t('statistics.overview.killContribute', { rate: stats.lograte })} color="#ff9ff3" />
                </div>
            </div>

            <div style={{ background: 'var(--color-bg-sub-header)', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: 'var(--color-text-primary)' }}>{t('statistics.overview.performanceChartTitle')}</h4>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('statistics.overview.performanceChartLegend')}</div>
                </div>
                <div style={{ width: '100%', height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <ComposedChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: 'var(--color-text-faint)', fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="dmg" orientation="left" stroke="#ffa502" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="kills" orientation="right" stroke="var(--color-danger)" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="place" orientation="right" reversed={true} domain={[1, 20]} hide={true} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)', borderRadius: '4px' }} itemStyle={{ fontSize: '12px', color: 'var(--color-text-primary)', fontWeight: 'bold' }} />
                            <RechartsLegend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar yAxisId="dmg" name="Damage" dataKey="damage" fill="#ffa502" radius={[2, 2, 0, 0]} maxBarSize={15} />
                            <Bar yAxisId="kills" name="Kills" dataKey="kills" fill="var(--color-danger)" radius={[2, 2, 0, 0]} maxBarSize={15} />
                            <Line yAxisId="place" name="Placement" type="monotone" dataKey="placement" stroke="#54a0ff" strokeWidth={3} dot={{ r: 4, fill: '#54a0ff', strokeWidth: 2, stroke: 'var(--color-bg-sub-header)' }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const MapsView = ({ data }: { data: MatchHistory[] }) => {
    const { t } = useTranslation();
    const [selectedMap, setSelectedMap] = useState<string>(TARGET_MAPS[0]);
    const stats = useMemo(() => {
        const mapMatches = data.filter(m => ((m as any).map || '').toLowerCase() === selectedMap.toLowerCase());
        return calculateStats(mapMatches);
    }, [data, selectedMap]);

    return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '15px', marginBottom: '20px', scrollbarWidth: 'thin' }}>
                {TARGET_MAPS.map(mapName => {
                    const isSelected = selectedMap === mapName;
                    const bgImage = MAP_THUMBNAILS[mapName] || 'thumbnail-kings_canyon.png';
                    return (
                        <div
                            key={mapName}
                            onClick={() => setSelectedMap(mapName)}
                            style={{
                                minWidth: '140px', height: '80px', borderRadius: '8px',
                                border: isSelected ? '2px solid var(--color-text-primary)' : '2px solid var(--color-border-light)',
                                backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${bgImage})`,
                                backgroundSize: 'cover', backgroundPosition: 'center',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: '0.2s', position: 'relative',
                                boxShadow: isSelected ? '0 0 10px rgba(255,255,255,0.2)' : 'none'
                            }}
                        >
                            <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold', fontSize: '14px', textAlign: 'center', padding: '0 5px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                {mapName}
                            </span>
                            {isSelected && <div style={{ position: 'absolute', bottom: '-8px', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid var(--color-text-primary)' }} />}
                        </div>
                    );
                })}
            </div>

            {stats ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ background: 'var(--color-bg-card)', padding: '20px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                        <h3 style={{ margin: '0 0 20px 0', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px' }}>{selectedMap} {t('statistics.maps.statistics')}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <InfoRow label={t('statistics.maps.totalMatches')} value={stats.matches} />
                            <InfoRow label={t('statistics.maps.winRate')} value={`${stats.winRate}%`} highlight />
                            <InfoRow label={t('statistics.maps.kdRatio')} value={stats.kd} highlight />
                            <InfoRow label={t('statistics.maps.avgDamage')} value={stats.avgDamage} />
                            <InfoRow label={t('statistics.maps.avgSurvival')} value={stats.avgTime} />
                            <InfoRow label={t('statistics.maps.totalKills')} value={stats.kills} />
                        </div>
                    </div>
                    <div style={{ background: 'var(--color-bg-card)', padding: '20px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                        <h3 style={{ margin: '0 0 20px 0', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px' }}>{t('statistics.maps.playstyle')}</h3>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('statistics.maps.mostPlayedLegend')}</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <img src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${stats.mostLegend}.png`} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-text-faint)' }} />
                                {stats.mostLegend}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('statistics.maps.favoriteWeapon')}</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e17055' }}>{stats.mostWeapon}</div>
                        </div>
                    </div>
                </div>
            ) : (
                <EmptyState msg={t('statistics.maps.noMatchesFound', { map: selectedMap })} />
            )}
        </div>
    );
};

const LegendsView = ({ data }: { data: MatchHistory[] }) => {
    const { t } = useTranslation();
    const [selectedLegend, setSelectedLegend] = useState<string>('wraith');
    const stats = useMemo(() => {
        const legendMatches = data.filter(m => (m.legend || '').toLowerCase() === selectedLegend.toLowerCase());
        return calculateStats(legendMatches);
    }, [data, selectedLegend]);

    const pieData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const counts: Record<string, number> = {};
        data.forEach(m => {
            const l = (m.legend || 'unknown').toLowerCase();
            counts[l] = (counts[l] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
    }, [data]);

    return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <div style={{ flex: 2, display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '15px', background: 'var(--color-bg-deep)', borderRadius: '10px', border: '1px solid var(--color-border)', maxHeight: '300px', overflowY: 'auto' }}>
                    {LEGENDS_LIST.map(legend => {
                        const isSelected = selectedLegend === legend;
                        return (
                            <div
                                key={legend}
                                onClick={() => setSelectedLegend(legend)}
                                style={{
                                    width: '45px', height: '45px', borderRadius: '6px',
                                    boxShadow: isSelected ? 'inset 0 0 0 2px #e17055' : 'inset 0 0 0 1px var(--color-border)',
                                    overflow: 'hidden', cursor: 'pointer',
                                    filter: isSelected ? 'grayscale(0%)' : 'grayscale(80%)',
                                    opacity: isSelected ? 1 : 0.6, transition: '0.2s',
                                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                                    zIndex: isSelected ? 1 : 0
                                }}
                                title={legend}
                            >
                                <img src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${legend}.png`} alt={legend} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png'; }} />
                            </div>
                        );
                    })}
                </div>
                <div style={{ flex: 1, background: 'var(--color-bg-card)', borderRadius: '10px', border: '1px solid var(--color-border)', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h5 style={{ margin: '0 0 10px 0', color: 'var(--color-text-dim)' }}>{t('statistics.legends.top5PickRates')}</h5>
                    {pieData.length > 0 ? (
                        <div style={{ width: '100%', height: '200px' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                                        {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS.CHART[index % COLORS.CHART.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-deep)', border: '1px solid var(--color-border-light)', fontSize: '12px' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <RechartsLegend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-faint)', fontSize: '12px' }}>{t('statistics.legends.noData')}</div>
                    )}
                </div>
            </div>

            {stats ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                    <div style={{ background: `linear-gradient(135deg, var(--color-bg-card) 0%, var(--color-bg-main) 100%)`, padding: '20px', borderRadius: '10px', border: '1px solid var(--color-border)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${selectedLegend}.png`} alt={selectedLegend} style={{ width: '100px', height: '100px', borderRadius: '50%', border: '4px solid #e17055', marginBottom: '15px', objectFit: 'cover' }} />
                        <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: '24px' }}>{selectedLegend}</h2>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '20px' }}>{stats.matches} {t('statistics.legends.matches')}</div>
                        <div style={{ width: '100%', background: 'var(--color-bg-deep)', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'space-around' }}>
                            <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('statistics.legends.winRate')}</div><div style={{ fontSize: '16px', color: '#fdcb6e', fontWeight: 'bold' }}>{stats.winRate}%</div></div>
                            <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('statistics.legends.kd')}</div><div style={{ fontSize: '16px', color: '#d63031', fontWeight: 'bold' }}>{stats.kd}</div></div>
                        </div>
                    </div>
                    <div style={{ background: 'var(--color-bg-card)', padding: '20px', borderRadius: '10px', border: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignContent: 'start' }}>
                        <InfoRow label={t('statistics.legends.avgDamage')} value={stats.avgDamage} highlight />
                        <InfoRow label={t('statistics.legends.avgSurvival')} value={stats.avgTime} />
                        <InfoRow label={t('statistics.legends.totalKills')} value={stats.kills} />
                        <InfoRow label={t('statistics.legends.avgKillsMatch')} value={stats.avgKills} />
                        <InfoRow label={t('statistics.legends.mostUsedWeapon')} value={stats.mostWeapon} highlight />
                        <InfoRow label={t('statistics.legends.wins')} value={stats.wins} />
                    </div>
                </div>
            ) : <EmptyState msg={t('statistics.legends.noMatchesFound', { legend: selectedLegend })} />}
        </div>
    );
};

const WeaponsView = ({ data }: { data: MatchHistory[] }) => {
    const { t } = useTranslation();
    const weaponStats = useMemo(() => {
        const map: Record<string, { games: number; wins: number; kills: number; assists: number; deaths: number }> = {};
        data.forEach(m => {
            if (!m.loadout) return;
            const isWin = m.placement === 1;
            const matchKills = m.kills || 0;
            const matchAssists = m.assists || 0;
            const matchDeath = isWin ? 0 : 1;

            (['primary', 'secondary'] as const).forEach(slot => {
                // ✅ 백엔드에서 이미 정규화된 키 그대로 사용
                const fileId = m.loadout![slot];
                if (!fileId || fileId === 'unknown' || fileId === 'none') return;

                if (!map[fileId]) map[fileId] = { games: 0, wins: 0, kills: 0, assists: 0, deaths: 0 };
                map[fileId].games++;
                map[fileId].kills += matchKills;
                map[fileId].assists += matchAssists;
                map[fileId].deaths += matchDeath;
                if (isWin) map[fileId].wins++;
            });
        });

        return Object.entries(map).map(([k, v]) => {
            // ✅ OFFICIAL_WEAPON_NAMES 제거 → SHORT_WEAPON_NAMES로 교체
            const displayName = SHORT_WEAPON_NAMES(k) ?? k.toUpperCase().replace(/-/g, ' ');
            const kd = v.deaths === 0 ? v.kills.toFixed(2) : (v.kills / v.deaths).toFixed(2);
            const kda = v.deaths === 0 ? (v.kills + v.assists).toFixed(2) : ((v.kills + v.assists) / v.deaths).toFixed(2);
            return {
                id: k, name: displayName, games: v.games,
                winRate: ((v.wins / v.games) * 100).toFixed(1),
                kd: parseFloat(kd), kda: parseFloat(kda)
            };
        }).sort((a, b) => b.games - a.games);
    }, [data]);

    const top3 = weaponStats.slice(0, 3);
    const others = weaponStats.slice(3);

    return (
        <div style={{ animation: 'fadeIn 0.5s' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                {top3.map((w, i) => (
                    <div key={w.id} style={{
                        background: i === 0 ? `linear-gradient(135deg, var(--color-warning-hover) 0%, var(--color-bg-card) 100%)` : 'var(--color-bg-card)',
                        borderRadius: '12px', border: `1px solid ${i === 0 ? 'var(--color-warning)' : 'var(--color-border)'}`,
                        padding: '20px', position: 'relative', overflow: 'hidden',
                        boxShadow: i === 0 ? '0 0 15px rgba(230, 126, 34, 0.3)' : 'none'
                    }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '5px' }}>
                            {i === 0 ? t('statistics.weapons.mostUsed') : t('statistics.weapons.pick', { rank: i + 1 })}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--color-text-primary)', marginBottom: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={w.name}>
                            {w.name}
                        </div>
                        <div style={{ height: '80px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            <img
                                src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${w.id}.png`}
                                alt={w.name}
                                style={{ width: '90%', height: '90%', objectFit: 'contain' }}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.innerHTML = '<span style="font-size:30px">🔫</span>';
                                }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', fontSize: '13px' }}>
                            <div style={{ textAlign: 'center' }}><div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{t('statistics.weapons.matches')}</div><div style={{ fontWeight: 'bold' }}>{w.games}</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{t('statistics.weapons.kd')}</div>                            <div style={{ fontWeight: 'bold', color: 'var(--color-warning)' }}>{w.kd}</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{t('statistics.weapons.kad')}</div><div style={{ fontWeight: 'bold', color: '#54a0ff' }}>{w.kda}</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{t('statistics.weapons.winPercent')}</div><div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{w.winRate}</div></div>
                        </div>
                    </div>
                ))}
                {top3.length === 0 && <div style={{ gridColumn: 'span 3' }}><EmptyState msg={t('statistics.weapons.noWeaponData')} /></div>}
            </div>

            <div style={{ background: 'var(--color-bg-sub-header)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-table-header)' }}>
                    <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '14px' }}>{t('statistics.weapons.detailedStatsTitle')}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-faint)' }}>{t('statistics.weapons.rank4Plus')}</span>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg-table-header)', zIndex: 1 }}>
                            <tr style={{ color: 'var(--color-text-muted)', fontSize: '11px', borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: '12px 20px', width: '50px' }}>{t('statistics.weapons.rank')}</th>
                                <th style={{ padding: '12px 20px' }}>{t('statistics.weapons.weapon')}</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>{t('statistics.weapons.matches')}</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>{t('statistics.weapons.winRate')}</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>{t('statistics.weapons.kd')}</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>
                                    {t('statistics.weapons.kad')}
                                    <span title={t('statistics.weapons.kadTooltip')} style={{ cursor: 'help', marginLeft: '4px', display: 'inline-block', verticalAlign: 'middle' }}>
                                        <FaInfoCircle size={12} color="var(--color-text-muted)" />
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {others.map((w, i) => (
                                <tr key={w.id} style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-card-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '12px 20px', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>#{i + 4}</td>
                                    <td style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', color: 'var(--color-text-dim)', fontWeight: 'bold' }}>
                                        <div style={{ width: '50px', height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginRight: '12px' }}>
                                            <img
                                                src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${w.id}.png`}
                                                alt={w.name}
                                                style={{ maxWidth: '40px', maxHeight: '20px', objectFit: 'contain' }}
                                                onError={(e) => { e.currentTarget.style.opacity = '0'; }}
                                            />
                                        </div>
                                        {w.name}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', color: 'var(--color-text-dim)' }}>{w.games}</td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: parseFloat(w.winRate) >= 10 ? '#4ade80' : 'var(--color-text-muted)' }}>{w.winRate}%</td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: 'var(--color-warning)' }}>{w.kd}</td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#54a0ff' }}>{w.kda}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {others.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px' }}>{t('statistics.weapons.noMoreWeapons')}</div>}
                </div>
            </div>
        </div>
    );
};

interface StatisticsTabProps {
    history: MatchHistory[];
    isPremium: boolean;
    selectedSeasonId: number;
    seasons: Season[];
}

const StatisticsTab: React.FC<StatisticsTabProps> = ({ history, isPremium, selectedSeasonId, seasons }) => {
    const { t } = useTranslation();
    const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'MAPS' | 'LEGENDS' | 'WEAPONS'>('OVERVIEW');
    const [selectedMode, setSelectedMode] = useState<'ALL' | 'RANKED' | 'TRIO' | 'DUO'>('ALL');

    // ✅ 객체 맵으로 정리
    const TAB_LABELS: Record<string, string> = {
        OVERVIEW: t('statistics.tabs.overview'),
        MAPS: t('statistics.tabs.maps'),
        LEGENDS: t('statistics.tabs.legends'),
        WEAPONS: t('statistics.tabs.weapons'),
    };

    const MODE_LABELS: Record<string, string> = {
        ALL: t('statistics.modes.all'),
        RANKED: t('statistics.modes.ranked'),
        TRIO: t('statistics.modes.trio'),
        DUO: t('statistics.modes.duo'),
    };

    const filteredHistory = useMemo(() => {
        const currentSeason = seasons.find((s: Season) => s.id === selectedSeasonId);
        const nextSeason = seasons.find((s: Season) => s.id === selectedSeasonId + 1);
        if (!currentSeason) return [];
        const seasonStart = currentSeason.startTime ?? 0;
        const seasonEnd = nextSeason?.startTime ?? Infinity;
        let result = history.filter(match => {
            const matchTime = (match as any).startTime || (match as any).endTime || 0;
            if (matchTime === 0) return true;
            return matchTime >= seasonStart && matchTime < seasonEnd;
        });
        result = result.filter(match => {
            const m = ((match as any).mode || '').toLowerCase();
            const isBR = m.includes('ranked') || m.includes('trio') || m.includes('duo');
            if (!isBR) return false;
            if (selectedMode !== 'ALL') {
                if (selectedMode === 'RANKED') return m.includes('ranked');
                if (selectedMode === 'TRIO') return m.includes('trio') && !m.includes('ranked');
                if (selectedMode === 'DUO') return m.includes('duo') && !m.includes('ranked');
                return false;
            }
            return true;
        });
        return result;
    }, [history, selectedMode, selectedSeasonId]);

    const renderContent = () => {
        if (!isPremium && (activeSubTab !== 'OVERVIEW' || selectedMode !== 'ALL')) {
            const titles: Record<string, string> = {
                OVERVIEW: `${t('statistics.tabs.overview')} (${MODE_LABELS[selectedMode]})`,
                MAPS: t('statistics.tabs.maps'),
                LEGENDS: t('statistics.tabs.legends'),
                WEAPONS: t('statistics.tabs.weapons'),
            };
            return <PremiumLockView title={titles[activeSubTab]} />;
        }
        switch (activeSubTab) {
            case 'OVERVIEW': return <OverviewView data={filteredHistory} />;
            case 'MAPS': return <MapsView data={filteredHistory} />;
            case 'LEGENDS': return <LegendsView data={filteredHistory} />;
            case 'WEAPONS': return <WeaponsView data={filteredHistory} />;
            default: return null;
        }
    };

    return (
        <div style={{ paddingBottom: '40px', color: 'var(--color-text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '2px solid var(--color-border)', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                    {(['OVERVIEW', 'MAPS', 'LEGENDS', 'WEAPONS'] as const).map(tab => {
                        const isActive = activeSubTab === tab;
                        const isLocked = !isPremium && tab !== 'OVERVIEW';
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveSubTab(tab)}
                                style={{
                                    padding: '8px 16px',
                                    background: isActive ? 'var(--color-accent)' : 'transparent',
                                    color: isActive ? 'var(--color-text-primary)' : (isLocked ? 'var(--color-text-subtle)' : 'var(--color-text-muted)'),
                                    border: 'none', borderRadius: '4px',
                                    fontWeight: 'bold', cursor: 'pointer', transition: '0.2s',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                {TAB_LABELS[tab]}
                                {isLocked && <FaLock size={10} color="var(--color-text-subtle)" />}
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', background: 'var(--color-bg-deep)', padding: '4px', borderRadius: '6px' }}>
                        {(['ALL', 'RANKED', 'TRIO', 'DUO'] as const).map(mode => {
                            const isLocked = !isPremium && mode !== 'ALL';
                            return (
                                <button
                                    key={mode}
                                    onClick={() => setSelectedMode(mode)}
                                    style={{
                                        padding: '6px 12px', fontSize: '11px', fontWeight: 'bold',
                                        border: 'none', borderRadius: '4px', cursor: 'pointer',
                                        background: selectedMode === mode ? 'var(--color-bg-card-hover)' : 'transparent',
                                        color: selectedMode === mode ? 'var(--color-text-primary)' : (isLocked ? 'var(--color-text-subtle)' : 'var(--color-text-faint)'),
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    {MODE_LABELS[mode]}
                                    {isLocked && <FaLock size={9} color="var(--color-text-subtle)" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px', color: 'var(--color-text-faint)', fontSize: '11px', fontStyle: 'italic', gap: '5px', alignItems: 'center' }}>
                <FaHistory /> {t('statistics.showingStatsFor')} <span style={{ color: COLORS.NEON_ORANGE, fontWeight: 'bold' }}>{seasons.find(s => s.id === selectedSeasonId)?.name}</span> ({selectedMode === 'ALL' ? t('statistics.allBrModes') : selectedMode})
            </div>

            {isPremium && (
                <div style={{ background: 'linear-gradient(90deg, var(--color-success) 0%, var(--color-success-dark) 100%)', color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', padding: '8px', borderRadius: '6px', marginBottom: '20px', boxShadow: '0 4px 10px rgba(46, 204, 113, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', animation: 'fadeIn 0.5s' }}>
                    <FaCrown /><span>{t('statistics.betaNotice')} <b>{t('statistics.fullAnalyticsUnlocked')}</b></span>
                </div>
            )}

            {renderContent()}
        </div>
    );
};

export default StatisticsTab;
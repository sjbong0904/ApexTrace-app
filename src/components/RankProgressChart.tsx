import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { Season } from '../utils/match';
import { getRankTierColor, getRankTierKey, type RankTierKey } from '../utils/helpers';
import {
    fetchDailyRankSnapshots,
    getSeasonSnapshotDateRange,
    hasRankProgressChartData,
    trimLeadingZeroSnapshots,
    type DailyRankSnapshot,
} from '../utils/rankSnapshots';

interface RankProgressChartProps {
    uid: string;
    selectedSeasonId: number;
    seasons: Season[];
}

type ChartPoint = DailyRankSnapshot & {
    idx: number;
    delta: number | null;
    label: string;
    tierKey: RankTierKey;
    tierColor: string;
};

type TierSegment = {
    key: string;
    color: string;
    startIdx: number;
    endIdx: number;
    bridgeStartIdx: number;
    dataKey: string;
};

const formatDelta = (delta: number): string => {
    if (delta > 0) return `+${delta.toLocaleString()}`;
    return delta.toLocaleString();
};

function buildTierSegments(data: ChartPoint[]): TierSegment[] {
    if (data.length === 0) return [];

    const changeStarts = [0];
    for (let i = 1; i < data.length; i++) {
        if (data[i].tierKey !== data[i - 1].tierKey) {
            changeStarts.push(i);
        }
    }

    return changeStarts.map((startIdx, segIndex) => {
        const nextStart = changeStarts[segIndex + 1];
        const endIdx = nextStart != null ? nextStart - 1 : data.length - 1;
        const bridgeStartIdx = startIdx > 0 ? startIdx - 1 : startIdx;

        return {
            key: `${startIdx}-${endIdx}`,
            color: data[startIdx].tierColor,
            startIdx,
            endIdx,
            bridgeStartIdx,
            dataKey: `score_${segIndex}`,
        };
    });
}

function enrichChartDataWithSegments(data: ChartPoint[], segments: TierSegment[]): ChartPoint[] {
    return data.map((point, idx) => {
        const segmentValues = Object.fromEntries(
            segments.map(seg => [
                seg.dataKey,
                idx >= seg.bridgeStartIdx && idx <= seg.endIdx ? point.rank_score : null,
            ]),
        ) as Record<string, number | null>;

        return { ...point, ...segmentValues };
    });
}

const RankProgressChart = ({ uid, selectedSeasonId, seasons }: RankProgressChartProps) => {
    const { t, i18n } = useTranslation();
    const [snapshots, setSnapshots] = useState<DailyRankSnapshot[]>([]);
    const [loading, setLoading] = useState(true);

    const dateRange = useMemo(
        () => getSeasonSnapshotDateRange(seasons, selectedSeasonId),
        [seasons, selectedSeasonId],
    );

    useEffect(() => {
        if (!uid || !dateRange) {
            setSnapshots([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        fetchDailyRankSnapshots(uid, dateRange.startDate, dateRange.endDate)
            .then(rows => {
                if (!cancelled) {
                    setSnapshots(rows);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setSnapshots([]);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [uid, dateRange?.startDate, dateRange?.endDate]);

    const showChart = useMemo(() => hasRankProgressChartData(snapshots), [snapshots]);

    const chartData = useMemo<ChartPoint[]>(() => {
        const locale = i18n.language || 'en';
        const trimmed = trimLeadingZeroSnapshots(snapshots);
        return trimmed.map((row, idx) => {
            const prev = idx > 0 ? trimmed[idx - 1].rank_score : null;
            const date = new Date(`${row.snapshot_date}T00:00:00Z`);
            const tierKey = getRankTierKey(row.rank_name);
            return {
                ...row,
                idx,
                delta: prev != null ? row.rank_score - prev : null,
                label: date.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
                tierKey,
                tierColor: getRankTierColor(row.rank_name),
            };
        });
    }, [snapshots, i18n.language]);

    const tierSegments = useMemo(() => buildTierSegments(chartData), [chartData]);
    const plotData = useMemo(
        () => enrichChartDataWithSegments(chartData, tierSegments),
        [chartData, tierSegments],
    );

    const summary = useMemo(() => {
        if (chartData.length === 0) return null;
        const latest = chartData[chartData.length - 1];
        const first = chartData[0];
        const peak = chartData.reduce((best, row) => (row.rank_score > best.rank_score ? row : best), chartData[0]);
        return {
            latestRp: latest.rank_score,
            latestRank: latest.rank_name,
            latestTierColor: latest.tierColor,
            netChange: latest.rank_score - first.rank_score,
            peakRp: peak.rank_score,
        };
    }, [chartData]);

    const yDomain = useMemo((): [number, number] => {
        if (chartData.length === 0) return [0, 1000];
        const scores = chartData.map(d => d.rank_score);
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const pad = Math.max(48, Math.round((max - min) * 0.12));
        return [Math.max(0, min - pad), max + pad];
    }, [chartData]);

    const cardStyle = {
        background: 'var(--color-bg-sub-header)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        overflow: 'hidden' as const,
    };

    if (!loading && !showChart) return null;

    return (
        <div style={cardStyle}>
            <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-bg-table-header)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                flexWrap: 'wrap',
            }}>
                <div>
                    <h4 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '14px' }}>
                        {t('statistics.overview.rankProgressTitle')}
                    </h4>
                    <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-text-faint)' }}>
                        {t('statistics.overview.rankProgressSubtitle')}
                    </div>
                </div>
                {summary && (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px' }}>
                        <div>
                            <div style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>{t('statistics.overview.rankProgressLatest')}</div>
                            <div style={{ fontWeight: 'bold', color: summary.latestTierColor }}>{summary.latestRp.toLocaleString()} RP</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>{t('statistics.overview.rankProgressPeak')}</div>
                            <div style={{ fontWeight: 'bold', color: 'var(--color-text-dim)' }}>{summary.peakRp.toLocaleString()} RP</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>{t('statistics.overview.rankProgressChange')}</div>
                            <div style={{
                                fontWeight: 'bold',
                                color: summary.netChange > 0 ? '#4ade80' : summary.netChange < 0 ? 'var(--color-danger)' : 'var(--color-text-dim)',
                            }}>
                                {formatDelta(summary.netChange)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ padding: '16px', minHeight: '220px', boxSizing: 'border-box' }}>
                {loading ? (
                    <div style={{
                        height: '188px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-faint)',
                        fontSize: '12px',
                    }}>
                        {t('statistics.overview.rankProgressLoading')}
                    </div>
                ) : chartData.length === 0 ? (
                    <div style={{
                        height: '188px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-muted)',
                        fontSize: '12px',
                        textAlign: 'center',
                        padding: '0 20px',
                        lineHeight: 1.5,
                    }}>
                        {t('statistics.overview.rankProgressNoData')}
                    </div>
                ) : (
                    <div style={{ width: '100%', height: '188px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <LineChart data={plotData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                <XAxis
                                    dataKey="idx"
                                    type="number"
                                    domain={plotData.length <= 1 ? [-0.5, 0.5] : [-0.5, plotData.length - 0.5]}
                                    ticks={plotData.map(d => d.idx)}
                                    tickFormatter={(tick) => plotData[Number(tick)]?.label ?? ''}
                                    tick={{ fill: 'var(--color-text-faint)', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    domain={yDomain}
                                    tick={{ fill: 'var(--color-text-faint)', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={44}
                                    tickFormatter={(v) => Number(v).toLocaleString()}
                                />
                                <Tooltip
                                    cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.[0]?.payload) return null;
                                        const point = payload[0].payload as ChartPoint;
                                        return (
                                            <div style={{
                                                background: 'var(--color-bg-card)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '8px',
                                                padding: '10px 12px',
                                                fontSize: '12px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                                            }}>
                                                <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{point.snapshot_date}</div>
                                                <div style={{ fontWeight: 'bold', color: point.tierColor }}>
                                                    {t('statistics.overview.rankProgressTooltipRp', { score: point.rank_score.toLocaleString() })}
                                                </div>
                                                {point.rank_name && (
                                                    <div style={{ color: 'var(--color-text-dim)', marginTop: '2px' }}>
                                                        {t('statistics.overview.rankProgressTooltipRank', { rank: point.rank_name })}
                                                    </div>
                                                )}
                                                {point.delta != null && (
                                                    <div style={{
                                                        marginTop: '4px',
                                                        color: point.delta > 0 ? '#4ade80' : point.delta < 0 ? 'var(--color-danger)' : 'var(--color-text-faint)',
                                                    }}>
                                                        {t('statistics.overview.rankProgressTooltipDelta', { delta: formatDelta(point.delta) })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }}
                                />
                                {tierSegments.map(seg => (
                                    <Line
                                        key={seg.key}
                                        type="monotone"
                                        dataKey={seg.dataKey}
                                        stroke={seg.color}
                                        strokeWidth={2.5}
                                        connectNulls
                                        isAnimationActive={false}
                                        dot={(props) => {
                                            const { cx, cy, payload } = props;
                                            if (cx == null || cy == null || !payload) return null;
                                            const point = payload as ChartPoint;
                                            const value = point[seg.dataKey as keyof ChartPoint];
                                            if (value == null) return null;
                                            if (point.idx < seg.startIdx || point.idx > seg.endIdx) return null;

                                            return (
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={3}
                                                    fill={seg.color}
                                                    stroke="var(--color-bg-sub-header)"
                                                    strokeWidth={1}
                                                />
                                            );
                                        }}
                                        activeDot={false}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RankProgressChart;

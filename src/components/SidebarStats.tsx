import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchHistory } from '../utils/match';
import { hasUsableMatchStats } from '../utils/match';
import {
    getAvgDamageColor,
    getAvgPlacementColor,
    getKdColor,
    getMatchDeaths,
    getRankColor,
    getRankTierColorFromRp,
    getRankTierNameFromRp,
    isKnownLegend,
    RANK_TIER_RP_FLOORS,
} from '../utils/helpers';

interface SidebarStatsProps {
    history: MatchHistory[];
    layout?: 'panel' | 'inline';
    /** Tighter cards for narrow side-by-side layouts */
    dense?: boolean;
}

const RECENT_COUNT = 20;
const BLOCKS_PER_ROW = 10;

type SummaryView = {
    avgPlacement: string;
    kd: string;
    avgDamage: number;
};

const formatKd = (kills: number, deaths: number): string =>
    (deaths > 0 ? kills / deaths : kills).toFixed(2);

const isRankedMatch = (m: MatchHistory): boolean =>
    String((m as { mode?: string }).mode ?? '').toLowerCase().includes('ranked');

const matchKey = (m: MatchHistory): string | undefined => (m as { matchId?: string }).matchId;

const parsePlacement = (m: MatchHistory): number | null => {
    const raw = typeof m.placement === 'number' ? m.placement : parseInt(String(m.placement ?? ''), 10);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
};

const SummaryStat = ({ label, value, color = 'var(--color-text-primary)', dense }: {
    label: string; value: string; color?: string; dense: boolean;
}) => (
    <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: dense ? '4px 8px' : '6px 10px',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: 'rgba(255,255,255,0.03)',
        boxSizing: 'border-box',
        minWidth: 0,
    }}>
        <span style={{ fontSize: dense ? 9 : 10, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
        </span>
        <span style={{ fontSize: dense ? 13 : 15, fontWeight: 'bold', color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {value}
        </span>
    </div>
);

type RpPoint = { match: MatchHistory; rp: number };

/** RP after the game: GEP rank_score pinned on the match, else start RP + processed delta. */
const rpAfterMatch = (m: MatchHistory): number | null => {
    const x = m as { rankScore?: unknown; rpChange?: unknown; rpProcessed?: boolean; rank?: { startScore?: unknown } };
    const score = Number(x.rankScore);
    if (x.rankScore != null && Number.isFinite(score) && score > 0) return score;
    const start = Number(x.rank?.startScore);
    const delta = Number(x.rpChange);
    if (x.rpProcessed && Number.isFinite(start) && start > 0 && Number.isFinite(delta)) return start + delta;
    return null;
};

const GRID_STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

/** Axis label outside the plot's right edge. */
const axisLabelStyle: React.CSSProperties = {
    position: 'absolute', left: 'calc(100% + 4px)', top: 0, transform: 'translateY(-50%)',
    fontSize: 8, fontWeight: 600, color: 'var(--color-text-faint)', whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums', pointerEvents: 'none',
};

const rankNameOf = (m: MatchHistory): string | null => (m as { rank?: { name?: string } }).rank?.name ?? null;

/** Actual RP per ranked game, oldest → newest; line, dots and tier floors use tier colors. */
const RpChangeChart = ({ games, dense }: { games: RpPoint[]; dense: boolean }) => {
    const { t } = useTranslation();
    const values = games.map((g) => g.rp);
    const deltas = games.map((g, i) => {
        const d = Number((g.match as { rpChange?: unknown }).rpChange);
        if (Number.isFinite(d) && (g.match as { rpProcessed?: boolean }).rpProcessed) return d;
        return i > 0 ? g.rp - games[i - 1].rp : null;
    });
    const colors = games.map((g) => getRankTierColorFromRp(g.rp, rankNameOf(g.match)));
    // Fewer than 20 ranked games: pad the oldest side so the newest point always sits at the right edge.
    const padCount = Math.max(0, RECENT_COUNT - values.length);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const pad = Math.max(40, Math.round((max - min) * 0.15));
    const lo = Math.max(0, min - pad);
    const hi = max + pad;
    const xOf = (i: number) => ((padCount + i + 0.5) / RECENT_COUNT) * 100;
    const yOf = (rp: number) => 100 - ((rp - lo) / (hi - lo)) * 100;
    const floors = RANK_TIER_RP_FLOORS.filter((f) => f.rp > lo && f.rp < hi);
    // ~4 horizontal grid lines on a round RP step; skip ones that would sit on a tier floor.
    const step = GRID_STEPS.find((s) => s >= (hi - lo) / 4) ?? GRID_STEPS[GRID_STEPS.length - 1];
    // ~14% of plot height ≈ one label line on the short sidebar chart.
    const tooClose = (v: number, other: number) => Math.abs(yOf(v) - yOf(other)) < 14;
    const gridLines: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v < hi; v += step) {
        if (floors.some((f) => tooClose(v, f.rp))) continue;
        gridLines.push(v);
    }
    const latest = games[games.length - 1];
    const net = games.length > 1 ? latest.rp - games[0].rp : 0;
    const fmtDelta = (v: number) => (v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString());

    return (
        <div style={{ flex: 1, minHeight: dense ? 84 : 100, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t('sidebarStats.rpTrendTitle', { count: games.length, defaultValue: 'RP · last {{count}} ranked' })}
                </span>
                {latest ? (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontSize: 11, fontWeight: 'bold', color: colors[colors.length - 1] }}>
                            {latest.rp.toLocaleString()} RP
                        </span>
                        {games.length > 1 ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: net > 0 ? 'var(--color-success)' : net < 0 ? 'var(--color-danger)' : 'var(--color-text-faint)' }}>
                                {fmtDelta(net)}
                            </span>
                        ) : null}
                    </span>
                ) : null}
            </div>
            {games.length === 0 ? (
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: 'var(--color-text-faint)',
                    border: '1px dashed var(--color-border)', borderRadius: 8,
                }}>
                    {t('sidebarStats.rpNoRanked', { defaultValue: 'No ranked games with RP yet' })}
                </div>
            ) : (
                <div style={{
                    flex: 1,
                    minHeight: 0,
                    // Right gutter holds the RP axis labels.
                    padding: '10px 40px 10px 6px',
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    background: 'rgba(255,255,255,0.02)',
                    boxSizing: 'border-box',
                    display: 'flex',
                }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                        {/* Round-step RP grid. */}
                        {gridLines.map((v) => (
                            <div key={`grid-${v}`} style={{ position: 'absolute', left: 0, right: 0, top: `${yOf(v)}%`, pointerEvents: 'none' }}>
                                <div style={{ borderTop: '1px solid color-mix(in srgb, var(--color-border) 70%, transparent)' }} />
                                <span style={axisLabelStyle}>{v.toLocaleString()}</span>
                            </div>
                        ))}
                        {/* Tier floors inside the visible RP range. */}
                        {floors.map((f) => {
                            const color = getRankTierColorFromRp(f.rp);
                            return (
                                <div key={f.key} style={{ position: 'absolute', left: 0, right: 0, top: `${yOf(f.rp)}%`, pointerEvents: 'none' }}>
                                    <div style={{ borderTop: `1px dashed color-mix(in srgb, ${color} 55%, transparent)` }} />
                                    <span style={{
                                        position: 'absolute', left: 2, bottom: 1,
                                        fontSize: 8, fontWeight: 700, color, opacity: 0.85, whiteSpace: 'nowrap',
                                    }}>
                                        {f.name} {f.rp.toLocaleString()}
                                    </span>
                                </div>
                            );
                        })}
                        <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            aria-hidden
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
                        >
                            {values.slice(1).map((v, j) => (
                                <line
                                    key={j}
                                    x1={xOf(j)} y1={yOf(values[j])}
                                    x2={xOf(j + 1)} y2={yOf(v)}
                                    stroke={colors[j + 1]}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ))}
                        </svg>
                        {games.map((g, i) => {
                            const color = colors[i];
                            const d = deltas[i];
                            const tier = getRankTierNameFromRp(g.rp, rankNameOf(g.match));
                            const isLast = i === games.length - 1;
                            return (
                                <div
                                    key={`${matchKey(g.match) ?? i}`}
                                    title={`${tier} · ${g.rp.toLocaleString()} RP${d != null ? ` (${fmtDelta(d)})` : ''}`}
                                    style={{
                                        position: 'absolute',
                                        left: `${xOf(i)}%`,
                                        top: `${yOf(g.rp)}%`,
                                        width: 14,
                                        height: 14,
                                        transform: 'translate(-50%, -50%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'default',
                                    }}
                                >
                                    <div style={{
                                        width: isLast ? 8 : 6, height: isLast ? 8 : 6, borderRadius: '50%',
                                        background: color, border: '1px solid var(--color-bg-card)', boxShadow: `0 0 4px ${color}`,
                                    }} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

/** 20 placement blocks, 10 per row; newest game is the top-left block. */
const PlacementBlocks = ({ games, dense }: { games: MatchHistory[]; dense: boolean }) => {
    const { t } = useTranslation();
    const slots = Array.from({ length: RECENT_COUNT }, (_, i) => games[i] ?? null);
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${BLOCKS_PER_ROW}, minmax(0, 1fr))`,
            gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
            gap: dense ? 3 : 4,
            minWidth: 0,
            height: '100%',
        }}>
            {slots.map((m, i) => {
                if (!m) {
                    return (
                        <div key={`empty-${i}`} style={{
                            borderRadius: 6,
                            border: '1px dashed var(--color-border)',
                            minHeight: dense ? 24 : 28,
                        }} />
                    );
                }
                const place = parsePlacement(m);
                const color = place != null ? getRankColor(place) : 'var(--color-text-faint)';
                const isWin = place === 1;
                return (
                    <div
                        key={`${matchKey(m) ?? i}`}
                        title={t('sidebarStats.placementBlockTip', {
                            n: i + 1,
                            place: place ?? '-',
                            kills: m.kills ?? 0,
                            damage: (m.damage ?? 0).toLocaleString(),
                            defaultValue: '{{n}} games ago · #{{place}} · {{kills}} kills · {{damage}} dmg',
                        })}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: dense ? 24 : 28,
                            minWidth: 0,
                            borderRadius: 6,
                            border: `1px solid color-mix(in srgb, ${color} ${isWin ? 70 : 35}%, transparent)`,
                            background: `color-mix(in srgb, ${color} ${isWin ? 28 : 12}%, transparent)`,
                            color,
                            fontSize: dense ? 11 : 13,
                            fontWeight: 800,
                            fontVariantNumeric: 'tabular-nums',
                            cursor: 'default',
                            overflow: 'hidden',
                        }}
                    >
                        {place ?? '-'}
                    </div>
                );
            })}
        </div>
    );
};

const SidebarStats: React.FC<SidebarStatsProps> = ({
    history,
    layout = 'panel',
    dense = false,
}) => {
    const { t } = useTranslation();
    const isInline = layout === 'inline';

    const recentMatches = useMemo(
        () => history.filter(m => isKnownLegend(m.legend) && hasUsableMatchStats(m)).slice(0, RECENT_COUNT),
        [history],
    );

    /** Ranked games with a known post-game RP, oldest → newest for the chart. */
    const rpGames = useMemo(
        () => history
            .map((m) => ({ match: m, rp: rpAfterMatch(m) }))
            .filter((p): p is RpPoint => p.rp != null && isRankedMatch(p.match))
            .slice(0, RECENT_COUNT)
            .reverse(),
        [history],
    );

    const summary = useMemo<SummaryView | null>(() => {
        const count = recentMatches.length;
        if (count === 0) return null;
        let kills = 0, deaths = 0, damage = 0, placement = 0;
        recentMatches.forEach((m) => {
            kills += m.kills ?? 0;
            deaths += getMatchDeaths(m);
            damage += m.damage ?? 0;
            placement += parsePlacement(m) ?? 20;
        });
        return {
            avgPlacement: (placement / count).toFixed(1),
            kd: formatKd(kills, deaths),
            avgDamage: Math.round(damage / count),
        };
    }, [recentMatches]);

    if (recentMatches.length === 0 && rpGames.length === 0 && !summary) {
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

    const title = t('sidebarStats.recentGames', { count: recentMatches.length });
    const gap = dense ? 6 : 8;

    return (
        <div style={{
            width: '100%',
            height: '100%',
            padding: isInline ? (dense ? '10px 8px' : '12px 12px 10px') : '12px 10px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap,
            background: isInline ? 'transparent' : 'var(--color-bg-sub-header)',
            minHeight: 0,
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                flexShrink: 0,
                minWidth: 0,
            }}>
                <div style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                }}>
                    {title}
                </div>
            </div>

            {/* Rows 1–2: RP change per game. */}
            <RpChangeChart games={rpGames} dense={dense} />

            {/* Row 3: placement blocks (cols 1–2) | summary stack (col 3). */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
                gap,
                flexShrink: 0,
                minWidth: 0,
            }}>
                <PlacementBlocks games={recentMatches} dense={dense} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: dense ? 3 : 4, minWidth: 0 }}>
                    {summary ? (
                        <>
                            <SummaryStat dense={dense} label={t('sidebarStats.avgPlacement')} value={`#${summary.avgPlacement}`} color={getAvgPlacementColor(summary.avgPlacement)} />
                            <SummaryStat dense={dense} label={t('statistics.legends.kd', { defaultValue: 'K/D' })} value={summary.kd} color={getKdColor(summary.kd)} />
                            <SummaryStat dense={dense} label={t('sidebarStats.avgDamage')} value={summary.avgDamage.toLocaleString()} color={getAvgDamageColor(summary.avgDamage)} />
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default SidebarStats;

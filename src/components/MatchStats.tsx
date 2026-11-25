import { useEffect, useMemo, useRef, useState } from "react";
import { getMapConfig, formatMatchTime, toGameElapsedMs } from '../utils/helpers';
import type { Match } from '../types';
import { FaInfoCircle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { c } from '../theme';
import { resolveWeaponCombatForMatch } from '../utils/weaponMatchStats';
import { getWeaponDisplayName, getWeaponSilhouetteScale, getWeaponSilhouetteUrl, getWeaponAmmoTint, WHITE_SILHOUETTE_FILTER, PROFILE_IMAGE_BASE } from '../utils/weaponTheme';
import { COMPARISON_MIN_SAMPLE, type RecentComparison } from '../utils/matchComparison';
import {
    getDamagePerKnock,
    getGrenadeDamage,
    getHeadshotRate,
    getRevivesReceived,
    getTimeOutsideRingMs,
    getTimesKnocked,
    getUltimatesUsed,
} from '../utils/matchDetailStats';
import { classifyPlaystyle, extractPlaystyleSignals, PLAYSTYLE_VISUALS } from '../utils/playstyle';

interface AutoResizingTextProps {
    text: string | number;
    baseSize?: number;
    color?: string;
    weight?: string;
    suffix?: string;
}

const AutoResizingText = ({ text, baseSize = 16, color = 'var(--color-text-primary)', weight = '800', suffix = '' }: AutoResizingTextProps) => {
    const str = String(text);
    const len = str.length + (suffix ? suffix.length : 0);

    let fontSize = baseSize;
    if (len > 18) fontSize = baseSize * 0.8;
    else if (len > 14) fontSize = baseSize * 0.9;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'baseline',
                width: '100%',
                minWidth: 0,
                lineHeight: '1.2',
                overflow: 'hidden',
            }}
            title={suffix ? `${str}${suffix}` : str}
        >
            <span
                style={{
                    fontSize: `${fontSize}px`,
                    fontWeight: weight,
                    color: color,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                }}
            >
                {str}
            </span>
            {suffix ? (
                <span
                    style={{
                        fontSize: `${fontSize * 0.7}px`,
                        fontWeight: 'normal',
                        color: 'var(--color-text-muted)',
                        marginLeft: '2px',
                        flexShrink: 0,
                    }}
                >
                    {suffix}
                </span>
            ) : null}
        </div>
    );
};

const calculateTotalDistance = (path: Match['path'], mapName: string) => {
    if (!path || !Array.isArray(path) || path.length < 2) return 0;
    const config = getMapConfig(mapName);
    const scale = config?.scale || 30;
    const RAW_JUMP_THRESHOLD = 5.0 * scale;

    let totalDist = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        if (!p1 || !p2 || typeof p1.x !== 'number' || typeof p2.x !== 'number') continue;
        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        if (dist <= RAW_JUMP_THRESHOLD) totalDist += dist;
    }
    return Math.round(totalDist);
};

const boxStyle: React.CSSProperties = {
    background: 'var(--color-bg-card)',
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minWidth: 0
};

const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--color-text-muted)',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    width: '100%'
};

interface MarqueeLabelProps {
    children: string;
    style?: React.CSSProperties;
}

const MarqueeLabel = ({ children, style }: MarqueeLabelProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [shouldMarquee, setShouldMarquee] = useState(false);
    const [overflowDistance, setOverflowDistance] = useState(0);

    useEffect(() => {
        const updateOverflow = () => {
            const container = containerRef.current;
            const text = textRef.current;
            if (!container || !text) return;
            const distance = Math.max(0, text.scrollWidth - container.clientWidth);
            setOverflowDistance(distance);
            setShouldMarquee(distance > 1);
        };

        updateOverflow();
        const observer = new ResizeObserver(updateOverflow);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [children]);

    return (
        <div ref={containerRef} style={{ ...labelStyle, ...style }} title={children}>
            <span
                ref={textRef}
                style={{
                    display: 'inline-block',
                    minWidth: shouldMarquee ? 'max-content' : undefined,
                    paddingRight: shouldMarquee ? '16px' : 0,
                    animation: shouldMarquee ? 'matchStatsLabelPan 5s ease-in-out infinite alternate' : undefined,
                    willChange: shouldMarquee ? 'transform' : undefined,
                    ['--match-stats-label-distance' as string]: `${overflowDistance}px`,
                } as React.CSSProperties}
            >
                {children}
            </span>
        </div>
    );
};

const valContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    width: '100%',
    overflow: 'hidden'
};

interface MatchStatsProps {
    match: Match;
    onUserSelect?: (user: { uid: string, name: string }) => void;
    /**
     * full: every card in one grid (narrow / split layouts).
     * overview: playstyle, survival, teammates and this match vs recent games.
     * detail: the per-match efficiency numbers.
     */
    view?: 'full' | 'overview' | 'detail';
    comparison?: RecentComparison | null;
}


/** Weapon with the most kills (then assists, then hold time) this match. */
const BestWeaponCard = ({ match }: { match: Match }) => {
    const { t } = useTranslation();
    const [imgFailed, setImgFailed] = useState(false);

    const best = useMemo(() => {
        const combat = resolveWeaponCombatForMatch(match);
        const entries = Object.entries(combat).filter(([id]) => id && id.toLowerCase() !== 'unknown');
        if (entries.length === 0) return null;
        entries.sort(([, a], [, b]) =>
            (b.kills - a.kills) || ((b.assists || 0) - (a.assists || 0)) || ((b.holdMs || 0) - (a.holdMs || 0)));
        const [id, entry] = entries[0];
        return { id, ...entry };
    }, [match]);

    if (!best) {
        return (
            <div style={boxStyle}>
                <MarqueeLabel>{t('matchStats.bestWeapon', { defaultValue: 'Best weapon' })}</MarqueeLabel>
                <div style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>—</div>
            </div>
        );
    }

    const tint = getWeaponAmmoTint(best.id);
    const scale = getWeaponSilhouetteScale(best.id);
    const holdMin = best.holdMs > 0 ? Math.max(1, Math.round(best.holdMs / 60000)) : null;

    return (
        <div style={{
            ...boxStyle,
            position: 'relative',
            overflow: 'hidden',
            justifyContent: 'space-between',
            background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 22%, var(--color-bg-card)) 0%, var(--color-bg-card) 70%)`,
        }}>
            <MarqueeLabel>{t('matchStats.bestWeapon', { defaultValue: 'Best weapon' })}</MarqueeLabel>
            {!imgFailed && (
                <img
                    src={getWeaponSilhouetteUrl(best.id)}
                    alt=""
                    aria-hidden
                    onError={() => setImgFailed(true)}
                    style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: `translateY(-50%) scale(${scale})`,
                        maxWidth: '55%',
                        maxHeight: '58%',
                        objectFit: 'contain',
                        filter: WHITE_SILHOUETTE_FILTER,
                        opacity: 0.9,
                        pointerEvents: 'none',
                    }}
                />
            )}
            <div style={{ position: 'relative', minWidth: 0, maxWidth: '55%' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getWeaponDisplayName(best.id)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {t('matchStats.bestWeaponLine', { kills: best.kills, assists: best.assists || 0, defaultValue: '{{kills}} K · {{assists}} A' })}
                    {holdMin ? ` · ${t('matchStats.heldMinutes', { count: holdMin, defaultValue: '{{count}} min held' })}` : ''}
                </div>
            </div>
        </div>
    );
};

interface TeammateSlotProps {
    teammate?: { uid: unknown; name: string; legend?: string; kills: number };
    hovered: boolean;
    onClick?: () => void;
    onHover: (on: boolean) => void;
}

/** Always rendered: solo / duo keep an empty slot so the grid never reflows. */
const TeammateSlot = ({ teammate, hovered, onClick, onHover }: TeammateSlotProps) => {
    const { t } = useTranslation();
    const [imgFailed, setImgFailed] = useState(false);

    if (!teammate) {
        return (
            <div style={{ ...boxStyle, flexDirection: 'row', alignItems: 'center', gap: 10, border: '1px dashed var(--color-border)', background: 'transparent' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, border: '1px dashed var(--color-border-light)' }} />
                <div style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>{t('matchStats.noTeammate', { defaultValue: 'No teammate' })}</div>
            </div>
        );
    }

    const legendFile = (teammate.legend || 'unknown').toLowerCase();

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            title={onClick ? t('matchStats.clickToViewProfile') : t('matchStats.profileNotAvailable')}
            style={{
                ...boxStyle,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                background: hovered ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background 0.2s',
            }}
        >
            {imgFailed ? (
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'var(--color-bg-sub-header)' }} />
            ) : (
                <img
                    src={`${PROFILE_IMAGE_BASE}/${legendFile}.png`}
                    alt=""
                    onError={() => setImgFailed(true)}
                    style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, objectFit: 'cover', background: 'var(--color-bg-sub-header)' }}
                />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t('matchStats.teammate', { defaultValue: 'Teammate' })}
                </div>
                <div title={teammate.name} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {teammate.name}
                </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{teammate.kills}</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 3 }}>{t('matchStats.killsSuffix')}</span>
            </div>
        </div>
    );
};

/** This match vs the user's recent games in the same mode: bar = this match, tick = average. */
const MatchComparisonCard = ({ comparison }: { comparison?: RecentComparison | null }) => {
    const { t } = useTranslation();

    if (!comparison) {
        return (
            <div style={{ ...boxStyle, gridColumn: '1 / -1', padding: '10px 12px' }}>
                <MarqueeLabel>{t('match.vsRecentTitle', { defaultValue: 'vs your recent games' })}</MarqueeLabel>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {t('match.vsRecentEmpty', { count: COMPARISON_MIN_SAMPLE, defaultValue: 'Shows up once {{count}}+ earlier games in this mode are recorded.' })}
                </div>
            </div>
        );
    }

    /** Relative difference vs the average, + = better. Only decides the "about average" grey. */
    const rel = (value: number, avg: number, lowerIsBetter = false) => {
        if (avg <= 0) return value > 0 ? 1 : 0;
        const r = (value - avg) / avg;
        return lowerIsBetter ? -r : r;
    };
    /**
     * Split scale: centre = average, left end = worst of the window, right end = best.
     * Each half is scaled on its own so one outlier only squeezes its side. -1…1, + = better.
     */
    const pos = (value: number, avg: number, min: number, max: number, lowerIsBetter = false) => {
        if (value === avg) return 0;
        const better = (value > avg) !== lowerIsBetter;
        const end = better ? (lowerIsBetter ? min : max) : (lowerIsBetter ? max : min);
        const span = Math.abs(end - avg);
        if (span <= 0) return 0;
        const r = Math.abs(value - avg) / span;
        return better ? r : -r;
    };
    const rows = [
        {
            key: 'damage',
            label: t('match.damage', { defaultValue: 'Damage' }),
            rel: rel(comparison.damage.value, comparison.damage.avg),
            pos: pos(comparison.damage.value, comparison.damage.avg, comparison.damage.min, comparison.damage.max),
            worstText: comparison.damage.min.toLocaleString(),
            bestText: comparison.damage.max.toLocaleString(),
            text: comparison.damage.value.toLocaleString(),
            avgText: Math.round(comparison.damage.avg).toLocaleString(),
            delta: `${comparison.damage.deltaPct > 0 ? '+' : ''}${comparison.damage.deltaPct}%`,
        },
        {
            key: 'kills',
            label: t('match.kills', { defaultValue: 'Kills' }),
            rel: rel(comparison.kills.value, comparison.kills.avg),
            pos: pos(comparison.kills.value, comparison.kills.avg, comparison.kills.min, comparison.kills.max),
            worstText: String(comparison.kills.min),
            bestText: String(comparison.kills.max),
            text: String(comparison.kills.value),
            avgText: comparison.kills.avg.toFixed(1),
            delta: `${comparison.kills.delta > 0 ? '+' : ''}${comparison.kills.delta.toFixed(1)}`,
        },
        {
            key: 'placement',
            label: t('match.rank', { defaultValue: 'Placement' }),
            rel: rel(comparison.placement.value, comparison.placement.avg, true),
            pos: pos(comparison.placement.value, comparison.placement.avg, comparison.placement.min, comparison.placement.max, true),
            worstText: `#${comparison.placement.max}`,
            bestText: `#${comparison.placement.min}`,
            text: `#${comparison.placement.value}`,
            avgText: `#${comparison.placement.avg.toFixed(1)}`,
            delta: `${comparison.placement.delta < 0 ? '▲' : comparison.placement.delta > 0 ? '▼' : ''}${Math.abs(comparison.placement.delta).toFixed(1)}`,
        },
    ];

    const COLS = '52px minmax(0, 1fr) 42px 42px 46px';
    const head = { fontSize: 9, color: 'var(--color-text-muted)', textAlign: 'right' as const, textTransform: 'uppercase' as const, letterSpacing: '0.4px' };

    return (
        <div style={{ ...boxStyle, gridColumn: '1 / -1', padding: '10px 12px 16px', gap: 6 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>
                {t('match.vsRecent', { count: comparison.sampleSize, defaultValue: 'vs your last {{count}} games' })}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'end', gap: 10, width: '100%' }}>
                <span />
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--color-text-faint)' }}>
                    <span>{t('match.vsRecentLow', { defaultValue: 'Worst' })}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>{t('match.vsRecentAvg', { defaultValue: 'Avg' })}</span>
                    <span>{t('match.vsRecentHigh', { defaultValue: 'Best' })}</span>
                </span>
                <span style={head}>{t('match.vsRecentThis', { defaultValue: 'This' })}</span>
                <span style={head}>{t('match.vsRecentAvg', { defaultValue: 'Avg' })}</span>
                <span />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, width: '100%' }}>
                {rows.map((row) => {
                    // Centre = your average; a half fills completely at your worst / best.
                    const r = Math.max(-1, Math.min(1, row.pos));
                    const neutral = Math.abs(row.rel) < 0.03;
                    const better = r > 0;
                    const color = neutral ? 'var(--color-text-muted)' : better ? 'var(--color-rank-top5)' : 'var(--color-danger)';
                    const half = Math.max(neutral ? 0 : 3, Math.abs(r) * 50);
                    return (
                        <div key={row.key} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
                            <div style={{ position: 'relative', minWidth: 0 }}>
                            <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--color-bg-sub-header)', border: '1px solid var(--color-border)' }}>
                                <div style={{
                                    position: 'absolute',
                                    top: 1,
                                    bottom: 1,
                                    left: better ? '50%' : `${50 - half}%`,
                                    width: `${half}%`,
                                    borderRadius: 3,
                                    background: color,
                                }} />
                                <div aria-hidden style={{ position: 'absolute', left: 'calc(50% - 1px)', top: -3, bottom: -3, width: 2, borderRadius: 1, background: 'var(--color-text-primary)' }} />
                            </div>
                            {/* What the bar's ends stand for in this row. */}
                            <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', fontSize: 9, lineHeight: 1, color: 'var(--color-text-faint)', pointerEvents: 'none' }}>
                                <span>{row.worstText}</span>
                                <span>{row.bestText}</span>
                            </div>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-primary)', textAlign: 'right' }}>{row.text}</span>
                            <span style={{ fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'right' }}>{row.avgText}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color, textAlign: 'right' }}>{row.delta}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const MatchStats = ({ match, onUserSelect, view = 'full', comparison = null }: MatchStatsProps) => {
    const { t } = useTranslation();
    const [showTooltip, setShowTooltip] = useState(false);
    const [showTooltip2, setShowTooltip2] = useState(false);
    const [hoveredTm, setHoveredTm] = useState<number | null>(null);
    /** Stand-in end time for a match still in progress (no endTime yet), fixed when the panel opens. */
    const [openedAt] = useState(Date.now);

    const placement = typeof match.placement === 'string' ? parseInt(match.placement) : (match.placement || 20);
    const totalDamage = Number(match.damage || 0);
    const totalKills = Number(match.kills || 0);
    const totalAssists = Number(match.assists || 0);
    const totalKnocks = Number(match.knocks || 0);
    const events = match.events || [];
    const myName = match.playerName;

    const teammateStats = useMemo(() => {
        const roster = (match.teamStats || []).filter(tm => tm.name !== myName);
        const stats = roster.map((member) => ({
            name: member.name,
            uid: member.uid,
            legend: member.legend,
            kills: Number(member.kills || 0)
        }));
        return stats.sort((a, b) => b.kills - a.kills);
    }, [match.teamStats, myName]);

    const knockEvents = events.filter(e =>
        e.type === 'knockdown' && e.attacker === myName
    );
    const killEvents = events.filter(e =>
        e.type === 'kill' && e.attacker === myName
    );

    // 넉다운→킬 전환율: 피해자 기준 유니크 (동일 넉다운 로그 중복 시 분모 과대 방지)
    const KillConversionRate = useMemo(() => {
        const norm = (s: string) => s.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
        const knockedVictims = new Set(
            knockEvents.map(k => k.victim).filter((v): v is string => !!v).map(norm)
        );
        if (knockedVictims.size > 0) {
            const finishedVictims = new Set(
                killEvents
                    .filter(k => k.victim && knockedVictims.has(norm(k.victim)))
                    .map(k => norm(k.victim!))
            );
            return Math.min(100, Math.round((finishedVictims.size / knockedVictims.size) * 100));
        }
        const tk = Number(match.knocks || 0);
        if (tk > 0) return Math.min(100, Math.round((totalKills / tk) * 100));
        return 0;
    }, [knockEvents, killEvents, match.knocks, totalKills]);

    let squadKills = Number(match.squadKills || 0);
    if (totalAssists + totalKills > squadKills) {
        squadKills = totalAssists + totalKills;
    }

    const durationMs = toGameElapsedMs((match.endTime || openedAt) - match.startTime);
    const durationMin = durationMs / 1000 / 60;
    const timeLabel = formatMatchTime(durationMs, 'text');
    const dpm = durationMin > 0.1 ? Math.round(totalDamage / durationMin) : 0;
    const distance = useMemo(() => calculateTotalDistance(match.path, match.map), [match.path, match.map]);
    const avgSpeed = durationMin > 0.5 ? Math.round(distance / durationMin) : 0;
    const avgSpeedSec = (avgSpeed / 60).toFixed(1);
    const dmgPerKill = totalKills > 0 ? Math.round(totalDamage / totalKills) : 0;

    let KPP = Number(Math.round(((totalKills + totalAssists) / squadKills) * 100));
    if (squadKills === 0) KPP = 0;
    else if (KPP > 100) KPP = 100;

    const outsideRingMs = useMemo(() => getTimeOutsideRingMs(match), [match]);
    const playstyleSignals = useMemo(
        () => extractPlaystyleSignals(match, outsideRingMs),
        [match, outsideRingMs],
    );
    const playstyleKey = classifyPlaystyle(
        {
            timeMin: durationMin,
            dpm,
            speed: avgSpeed,
            dist: distance,
            dpk: dmgPerKill,
            kills: totalKills,
            damage: totalDamage,
            kcr: KillConversionRate,
            assists: totalAssists,
            placement,
            kpp: KPP,
            squadKills,
        },
        playstyleSignals,
    );
    const style = {
        // Names stay English in every language (they read as gamer terms); the tooltip sub is localized.
        name: t(`playstyles.${playstyleKey}.name`, { lng: 'en' }),
        sub: t(`playstyles.${playstyleKey}.sub`),
        bgGradient: PLAYSTYLE_VISUALS[playstyleKey].gradient,
        isPrimary: PLAYSTYLE_VISUALS[playstyleKey].isPrimary,
    };
    const detailCards = useMemo(() => {
        const headshotRate = getHeadshotRate(match);
        const dmgPerKnock = getDamagePerKnock(match);
        const grenadeDamage = getGrenadeDamage(match);
        const timesKnocked = getTimesKnocked(match);
        const support = getRevivesReceived(match);
        const ultimates = getUltimatesUsed(match);
        const notCollected = t('matchStats.notCollected', { defaultValue: 'Not recorded for this match' });
        const cards: {
            key: string;
            label: string;
            value: string | number | null;
            suffix?: string;
            color?: string;
            hint?: string;
        }[] = [
            { key: 'survival', label: t('matchStats.survivalTime'), value: timeLabel, color: 'var(--color-text-secondary)' },
            { key: 'distance', label: t('matchStats.travelDistance'), value: distance.toLocaleString(), suffix: t('matchStats.mSuffix') },
            { key: 'kpp', label: t('matchStats.killParticipant'), value: KPP, suffix: '%' },
            {
                key: 'dmgPerKnock',
                label: t('matchStats.damagePerKnock', { defaultValue: 'Damage per knock' }),
                value: dmgPerKnock,
                suffix: t('matchStats.dmgKnockSuffix', { defaultValue: ' dmg/knock' }),
            },
            {
                key: 'headshotRate',
                label: t('matchStats.headshotRate', { defaultValue: 'Headshot rate' }),
                value: headshotRate,
                suffix: '%',
                hint: headshotRate === null
                    ? notCollected
                    : t('matchStats.headshotRateHint', { headshots: match.headshots || 0, hits: match.damageHits || 0, defaultValue: '{{headshots}} of {{hits}} hits' }),
            },
            {
                key: 'grenade',
                label: t('matchStats.grenadeDamage', { defaultValue: 'Grenade damage' }),
                value: grenadeDamage === null ? null : grenadeDamage.toLocaleString(),
                suffix: grenadeDamage !== null && totalDamage > 0
                    ? ` (${Math.round((grenadeDamage / totalDamage) * 100)}%)`
                    : undefined,
                hint: grenadeDamage === null ? notCollected : undefined,
            },
            {
                key: 'knocked',
                label: t('matchStats.timesKnocked', { defaultValue: 'Times knocked' }),
                value: timesKnocked,
                suffix: t('matchStats.timesSuffix', { defaultValue: 'x' }),
            },
            {
                key: 'support',
                label: t('matchStats.revivesRespawns', { defaultValue: 'Revived · Respawned' }),
                value: support ? `${support.revives} · ${support.respawns}` : null,
                hint: support
                    ? t('matchStats.revivesRespawnsHint', { revives: support.revives, respawns: support.respawns, defaultValue: 'Revived {{revives}}x · Respawned {{respawns}}x' })
                    : notCollected,
            },
            {
                key: 'ultimates',
                label: t('matchStats.ultimatesUsed', { defaultValue: 'Ultimates used' }),
                value: ultimates,
                suffix: t('matchStats.timesSuffix', { defaultValue: 'x' }),
                hint: ultimates === null ? notCollected : undefined,
            },
            {
                key: 'outsideRing',
                label: t('matchStats.timeOutsideRing', { defaultValue: 'Time outside ring' }),
                value: outsideRingMs === null ? null : formatMatchTime(outsideRingMs, 'text'),
                color: outsideRingMs && outsideRingMs >= 30000 ? 'var(--color-danger)' : undefined,
                hint: outsideRingMs === null ? notCollected : undefined,
            },
        ];
        return cards;
    }, [match, t, timeLabel, distance, KPP, totalDamage, outsideRingMs]);

    const handleTeammateClick = (tm: { uid: string | null; name: string }) => {
        if (tm.uid && onUserSelect) {
            onUserSelect({ uid: tm.uid, name: tm.name });
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', padding: '10px 12px 12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                @keyframes matchStatsLabelPan {
                    from { transform: translateX(0); }
                    to { transform: translateX(calc(-1 * var(--match-stats-label-distance, 0px))); }
                }
            `}</style>
            {view === 'overview' ? (
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: 'minmax(64px, 1fr) minmax(56px, 1fr) auto',
                gap: '12px',
                flex: 1,
                minHeight: 0
            }}>
                <div style={{
                    ...boxStyle,
                    background: style.bgGradient,
                    border: 'none',
                    color: c.playstyleText,
                    position: 'relative',
                    textShadow: style.isPrimary ? c.playstyleTextShadow : 'none',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)',
                }}>
                    <MarqueeLabel style={{
                        color: c.playstyleLabel,
                        fontWeight: '600',
                        letterSpacing: '0.5px'
                    }}>
                        {t('matchStats.playedLike')}
                    </MarqueeLabel>
                    <div style={valContainerStyle}>
                        <AutoResizingText
                            text={style.name}
                            color={c.playstyleText}
                        />
                    </div>
                    <div
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            color: c.playstyleIcon,
                            cursor: 'help',
                            display: 'flex',
                            alignItems: 'center',
                            zIndex: 100
                        }}
                    >
                        <FaInfoCircle size={12} />
                    </div>
                    {showTooltip && (
                        <div style={{
                            position: 'absolute',
                            display: 'flex',
                            flexDirection: 'column',
                            top: '28px',
                            right: '8px',
                            background: 'var(--color-bg-card)',
                            border: `1px solid var(--color-border-light)`,
                            borderRadius: '4px',
                            padding: '6px 10px',
                            zIndex: 100,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            minWidth: '120px'
                        }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '2px' }}>
                                {t('matchStats.matchPlaystyle')}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-dim)' }}>
                                {style.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                                "{style.sub}"
                            </span>
                        </div>
                    )}
                </div>

                <BestWeaponCard match={match} />

                {[0, 1].map((slot) => {
                    const tm = teammateStats[slot];
                    const clickable = !!(tm?.uid && onUserSelect);
                    return (
                        <TeammateSlot
                            key={slot}
                            teammate={tm}
                            hovered={hoveredTm === slot}
                            onClick={clickable ? () => handleTeammateClick(tm!) : undefined}
                            onHover={(on) => setHoveredTm(on && clickable ? slot : null)}
                        />
                    );
                })}
                <MatchComparisonCard comparison={comparison} />
            </div>
            ) : view === 'detail' ? (
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: 'repeat(5, 1fr)',
                gap: '12px',
                flex: 1,
                minHeight: 0
            }}>
                {/* Pairs per row: flow · combat · damage quality · going down · utility & zone. */}
                {detailCards.map((card) => (
                    <div key={card.key} style={boxStyle} title={card.hint}>
                        <MarqueeLabel>{card.label}</MarqueeLabel>
                        <div style={valContainerStyle}>
                            {card.value === null ? (
                                <AutoResizingText text="-" color="var(--color-text-faint)" />
                            ) : (
                                <AutoResizingText text={card.value} suffix={card.suffix} color={card.color} />
                            )}
                        </div>
                    </div>
                ))}
            </div>
            ) : (
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: 'repeat(5, 1fr)',
                gap: '12px',
                flex: 1,
                minHeight: 0
            }}>
                <div style={{
                    ...boxStyle,
                    background: style.bgGradient,
                    border: 'none',
                    color: c.playstyleText,
                    position: 'relative',
                    textShadow: style.isPrimary ? c.playstyleTextShadow : 'none',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)',
                }}>
                    <MarqueeLabel style={{
                        color: c.playstyleLabel,
                        fontWeight: '600',
                        letterSpacing: '0.5px'
                    }}>
                        {t('matchStats.playedLike')}
                    </MarqueeLabel>
                    <div style={valContainerStyle}>
                        <AutoResizingText
                            text={style.name}
                            color={c.playstyleText}
                        />
                    </div>
                    <div
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            color: c.playstyleIcon,
                            cursor: 'help',
                            display: 'flex',
                            alignItems: 'center',
                            zIndex: 100
                        }}
                    >
                        <FaInfoCircle size={12} />
                    </div>
                    {showTooltip && (
                        <div style={{
                            position: 'absolute',
                            display: 'flex',
                            flexDirection: 'column',
                            top: '28px',
                            right: '8px',
                            background: 'var(--color-bg-card)',
                            border: `1px solid var(--color-border-light)`,
                            borderRadius: '4px',
                            padding: '6px 10px',
                            zIndex: 100,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            minWidth: '120px'
                        }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '2px' }}>
                                {t('matchStats.matchPlaystyle')}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-dim)' }}>
                                {style.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                                "{style.sub}"
                            </span>
                        </div>
                    )}
                </div>

                <div style={boxStyle}>
                    <MarqueeLabel>{t('matchStats.survivalTime')}</MarqueeLabel>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={timeLabel} color="var(--color-text-secondary)" />
                    </div>
                </div>

                <div style={boxStyle}>
                    <MarqueeLabel>{t('matchStats.killParticipant')}</MarqueeLabel>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={KPP} suffix="%" />
                    </div>
                </div>

                <div style={{ ...boxStyle, position: 'relative' }}>
                    <MarqueeLabel style={{ paddingRight: '16px' }}>{t('matchStats.knockToKill')}</MarqueeLabel>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={KillConversionRate} suffix="%" />
                    </div>
                    <div
                        onMouseEnter={() => setShowTooltip2(true)}
                        onMouseLeave={() => setShowTooltip2(false)}
                        style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--color-text-faint)', cursor: 'help', alignItems: 'center', zIndex: 100 }}
                    >
                        <FaInfoCircle size={12} />
                    </div>
                    {showTooltip2 && (
                        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', top: '28px', right: '20px', background: 'var(--color-bg-card)', border: `1px solid var(--color-text-faint)`, borderRadius: '4px', padding: '4px 8px', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,0.5)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                {t('matchStats.knockToKillTooltip1')}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                {t('matchStats.knockToKillTooltip2')}
                            </span>
                        </div>
                    )}
                </div>

                <div style={boxStyle}>
                    <MarqueeLabel>{t('matchStats.damagePerKill')}</MarqueeLabel>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={dmgPerKill} suffix={t('matchStats.dmgKillSuffix')} />
                    </div>
                </div>

                <div style={boxStyle}>
                    <MarqueeLabel>{t('matchStats.damagePerMin')}</MarqueeLabel>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={dpm} suffix={t('matchStats.dmgMinSuffix')} />
                    </div>
                </div>

                <div style={boxStyle}>
                    <MarqueeLabel>{t('matchStats.travelDistance')}</MarqueeLabel>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={distance.toLocaleString()} suffix={t('matchStats.mSuffix')} />
                    </div>
                </div>

                <div style={boxStyle}>
                    <MarqueeLabel>{t('matchStats.avgMoveSpeed')}</MarqueeLabel>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={avgSpeedSec} suffix={t('matchStats.msSuffix')} />
                    </div>
                </div>

                {teammateStats.length > 0 ? (
                    <>
                        {teammateStats.slice(0, 2).map((tm, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleTeammateClick(tm)}
                                onMouseEnter={() => { if (tm.uid && onUserSelect) setHoveredTm(idx); }}
                                onMouseLeave={() => setHoveredTm(null)}
                                style={{
                                    ...boxStyle,
                                    border: '1px solid var(--color-border-light)',
                                    background: hoveredTm === idx ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
                                    cursor: (tm.uid && onUserSelect) ? 'pointer' : 'default',
                                    transition: 'background 0.2s'
                                }}
                                title={tm.uid ? t('matchStats.clickToViewProfile') : t('matchStats.profileNotAvailable')}
                            >
                                {/* Without a label these read as "who I killed"; say they are teammates. */}
                                <MarqueeLabel>{`${t('matchStats.teammate', { defaultValue: 'Teammate' })} · ${tm.name}`}</MarqueeLabel>
                                <div style={valContainerStyle}>
                                    <AutoResizingText text={tm.kills} suffix={t('matchStats.killsSuffix')} />
                                </div>
                            </div>
                        ))}

                        {/* 듀오용 빈칸 채우기 */}
                        {teammateStats.length === 1 && (
                            <div style={{ ...boxStyle, border: '1px solid var(--color-border)' }}>
                                <MarqueeLabel>{t('matchStats.totalKnocks')}</MarqueeLabel>
                                <div style={valContainerStyle}>
                                    <AutoResizingText text={totalKnocks} suffix={t('matchStats.knocksSuffix')} />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div style={boxStyle}>
                            <MarqueeLabel>{t('matchStats.totalKnocks')}</MarqueeLabel>
                            <div style={valContainerStyle}>
                                <AutoResizingText text={totalKnocks} suffix={t('matchStats.knocksSuffix')} />
                            </div>
                        </div>
                        <div style={boxStyle}>
                            <MarqueeLabel>{t('matchStats.totalAssists')}</MarqueeLabel>
                            <div style={valContainerStyle}>
                                <AutoResizingText text={totalAssists} suffix={t('matchStats.assistsSuffix')} />
                            </div>
                        </div>
                    </>
                )}
            </div>
            )}
        </div>
    );
};

export default MatchStats;
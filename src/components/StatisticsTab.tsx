import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    CartesianGrid, Tooltip,
    Cell, PieChart, Pie, Legend as RechartsLegend,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Line, Bar, BarChart, LineChart, XAxis, YAxis, ReferenceLine
} from 'recharts';
import ChartContainer from './ChartContainer';
import { FaLock, FaCrown, FaHistory, FaInfoCircle, FaSync } from 'react-icons/fa';
import { COLORS, TARGET_MAPS, MAP_THUMBNAILS, LEGENDS_LIST, SHORT_WEAPON_NAMES } from '../utils/gameData';
import { useTranslation } from 'react-i18next';
import type { MatchHistory, Season } from '../utils/match';
import { normalizeHistoryForFrontend } from '../utils/matchNormalizer';
import { fetchPlayerStats, type StatisticsMode } from '../utils/playerStatsApi';
import { isSamePlayer, isKnownLegend, normalizeLegendKey, getTeammateSortKey, toGameElapsedMs } from '../utils/helpers';
import { WEAPONS_DB, type WeaponCategory } from '../utils/WeaponsData';
import { findWeaponByLoadoutId } from '../utils/weaponTheme';
import RankProgressChart from './RankProgressChart';
import PremiumBlurGate from './PremiumBlurGate';

const formatDuration = (ms: number): string => {
    if (!ms) return "0m 0s";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
};

const formatLegendDisplayName = (legendId: string) =>
    legendId.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

const getMatchPlacement = (m: MatchHistory): number => {
    const placement = m.placement;
    return placement != null && !isNaN(Number(placement)) ? Number(placement) : 20;
};

const formatAvgPlacement = (totalPlacement: number, count: number): string =>
    count > 0 ? (totalPlacement / count).toFixed(1) : '0.0';

const getAvgPlacementColor = (avgPlacement: string | number): string => {
    const val = typeof avgPlacement === 'number' ? avgPlacement : parseFloat(avgPlacement);
    if (isNaN(val)) return 'var(--color-text-muted)';
    if (val <= 3) return '#fdcb6e';
    if (val <= 5) return '#4ade80';
    return 'var(--color-text-muted)';
};

const AvgPlacementCell = ({ value, padding = '10px 12px' }: { value: string; padding?: string }) => (
    <td style={{ padding, textAlign: 'center', fontWeight: 'bold', color: getAvgPlacementColor(value) }}>
        #{value}
    </td>
);

const aggregateLegendStatsForMatches = (matches: MatchHistory[]) => {
    const map: Record<string, { games: number; wins: number; kills: number; assists: number; deaths: number; damage: number; placement: number }> = {};

    matches.forEach(m => {
        if (!isKnownLegend(m.legend)) return;

        const legend = normalizeLegendKey(m.legend);

        const isWin = m.placement === 1;
        if (!map[legend]) {
            map[legend] = { games: 0, wins: 0, kills: 0, assists: 0, deaths: 0, damage: 0, placement: 0 };
        }
        const entry = map[legend];
        entry.games++;
        entry.kills += m.kills || 0;
        entry.assists += m.assists || 0;
        entry.deaths += isWin ? 0 : 1;
        entry.damage += m.damage || 0;
        entry.placement += getMatchPlacement(m);
        if (isWin) entry.wins++;
    });

    return Object.entries(map).map(([id, v]) => {
        const kd = v.deaths === 0 ? v.kills.toFixed(2) : (v.kills / v.deaths).toFixed(2);
        const kda = v.deaths === 0 ? (v.kills + v.assists).toFixed(2) : ((v.kills + v.assists) / v.deaths).toFixed(2);
        return {
            id,
            name: formatLegendDisplayName(id),
            games: v.games,
            winRate: ((v.wins / v.games) * 100).toFixed(1),
            avgPlacement: formatAvgPlacement(v.placement, v.games),
            avgDamage: Math.round(v.damage / v.games),
            kd: parseFloat(kd),
            kda: parseFloat(kda),
        };
    }).sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        const winDiff = parseFloat(b.winRate) - parseFloat(a.winRate);
        if (winDiff !== 0) return winDiff;
        if (b.kd !== a.kd) return b.kd - a.kd;
        return b.avgDamage - a.avgDamage;
    });
};

const resolveMapName = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown') return null;
    return TARGET_MAPS.find(t => t.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
};

const aggregateWeaponStatsForMatches = (matches: MatchHistory[]) => {
    const map: Record<string, { games: number; wins: number; kills: number; assists: number; deaths: number; placement: number; legends: Record<string, number> }> = {};

    matches.forEach(m => {
        if (!m.loadout) return;
        const isWin = m.placement === 1;
        const matchKills = m.kills || 0;
        const matchAssists = m.assists || 0;
        const matchDeath = isWin ? 0 : 1;
        const matchPlacement = getMatchPlacement(m);
        const legend = isKnownLegend(m.legend) ? normalizeLegendKey(m.legend) : null;

        (['primary', 'secondary'] as const).forEach(slot => {
            const fileId = m.loadout![slot];
            if (!fileId || fileId === 'unknown' || fileId === 'none') return;

            if (!map[fileId]) map[fileId] = { games: 0, wins: 0, kills: 0, assists: 0, deaths: 0, placement: 0, legends: {} };
            const entry = map[fileId];
            entry.games++;
            entry.kills += matchKills;
            entry.assists += matchAssists;
            entry.deaths += matchDeath;
            entry.placement += matchPlacement;
            if (isWin) entry.wins++;
            if (legend) entry.legends[legend] = (entry.legends[legend] || 0) + 1;
        });
    });

    return Object.entries(map).map(([k, v]) => {
        const displayName = SHORT_WEAPON_NAMES(k) ?? k.toUpperCase().replace(/-/g, ' ');
        const kd = v.deaths === 0 ? v.kills.toFixed(2) : (v.kills / v.deaths).toFixed(2);
        const kda = v.deaths === 0 ? (v.kills + v.assists).toFixed(2) : ((v.kills + v.assists) / v.deaths).toFixed(2);
        const topLegends = Object.entries(v.legends)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([id]) => id);
        return {
            id: k,
            name: displayName,
            games: v.games,
            winRate: ((v.wins / v.games) * 100).toFixed(1),
            avgPlacement: formatAvgPlacement(v.placement, v.games),
            kd: parseFloat(kd),
            kda: parseFloat(kda),
            topLegends,
        };
    }).sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        if (b.kd !== a.kd) return b.kd - a.kd;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
    });
};

const aggregateMapStatsForMatches = (matches: MatchHistory[]) => {
    const map: Record<string, { games: number; wins: number }> = {};
    matches.forEach(m => {
        const mapName = resolveMapName(String((m as { map?: string }).map ?? ''));
        if (!mapName) return;
        if (!map[mapName]) map[mapName] = { games: 0, wins: 0 };
        map[mapName].games++;
        if (m.placement === 1) map[mapName].wins++;
    });

    const total = matches.length;
    return Object.entries(map)
        .map(([name, { games, wins }]) => ({
            name,
            games,
            share: total > 0 ? (games / total) * 100 : 0,
            winRate: games > 0 ? ((wins / games) * 100).toFixed(1) : '0.0',
        }))
        .sort((a, b) => b.games - a.games);
};

const MAP_IMAGE_BASE = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/';

const getMapThumbnailUrl = (mapName: string) =>
    `${MAP_IMAGE_BASE}${MAP_THUMBNAILS[mapName] || 'thumbnail-kings_canyon.png'}`;

const WeaponTopLegends = ({ legendIds }: { legendIds: string[] }) => {
    if (legendIds.length === 0) return null;
    return (
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '8px', flexShrink: 0, isolation: 'isolate' }}>
            {legendIds.map((id, i) => (
                <div
                    key={id}
                    title={formatLegendDisplayName(id)}
                    style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--color-border)',
                        marginLeft: i > 0 ? '-6px' : 0,
                        zIndex: legendIds.length - i,
                        position: 'relative',
                    }}
                >
                    <img
                        src={`${MAP_IMAGE_BASE}${id}.png`}
                        alt={id}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => { e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`; }}
                    />
                </div>
            ))}
        </div>
    );
};

const mapBreakdownTableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    fontSize: '12px',
};

const mapBreakdownHeadCellStyle: React.CSSProperties = {
    padding: '10px 12px',
    background: 'var(--color-bg-table-header)',
    color: 'var(--color-text-muted)',
    fontSize: '10px',
    fontWeight: 600,
    lineHeight: 1.25,
    minHeight: '40px',
    boxSizing: 'border-box',
    verticalAlign: 'middle',
    whiteSpace: 'normal',
    wordBreak: 'keep-all',
};

type SortDirection = 'desc' | 'asc';

type TableSortState<K extends string = string> = {
    column: K | null;
    direction: SortDirection;
};

const createDefaultTableSort = <K extends string>(): TableSortState<K> => ({
    column: null,
    direction: 'desc',
});

const toggleTableSort = <K extends string>(
    current: TableSortState<K>,
    column: K,
    firstClickDirection: SortDirection = 'desc',
): TableSortState<K> => {
    if (current.column !== column) {
        return { column, direction: firstClickDirection };
    }
    return { column, direction: current.direction === 'desc' ? 'asc' : 'desc' };
};

/** Legend / weapon name columns: first click follows tab or DB order (asc). */
const toggleCatalogNameTableSort = <K extends string>(
    current: TableSortState<K>,
    column: K,
): TableSortState<K> => toggleTableSort(current, column, column === 'name' ? 'asc' : 'desc');

const applyTableSort = <T, K extends string>(
    rows: readonly T[],
    sortState: TableSortState<K>,
    comparators: Record<K, (a: T, b: T) => number>,
): T[] => {
    if (!sortState.column) return [...rows];
    const compare = comparators[sortState.column];
    if (!compare) return [...rows];
    const factor = sortState.direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => compare(a, b) * factor);
};

const compareStrings = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

const compareNumbers = (a: number, b: number) => a - b;

const compareNumericStrings = (a: string, b: string) => parseFloat(a) - parseFloat(b);

/** Lower placement rank is better — invert so desc shows #1 first. */
const compareAvgPlacement = (a: string, b: string) => compareNumericStrings(b, a);

/** Matches Legends tab picker order (`LEGENDS_LIST`). */
const LEGEND_TAB_ORDER = new Map<string, number>(
    LEGENDS_LIST.map((slug, index) => [normalizeLegendKey(slug), index]),
);

const compareLegendTabOrder = (aId: string, bId: string): number => {
    const aKey = normalizeLegendKey(aId);
    const bKey = normalizeLegendKey(bId);
    const aOrder = LEGEND_TAB_ORDER.get(aKey) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = LEGEND_TAB_ORDER.get(bKey) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return compareStrings(aKey, bKey);
};

/** Matches Weapons tab / `WEAPONS_DB` category grid order. */
const WEAPON_CATEGORY_ORDER: WeaponCategory[] = ['AR', 'SMG', 'LMG', 'MARKSMAN', 'SNIPER', 'SHOTGUN', 'PISTOL'];

const registerWeaponOrderKeys = (map: Map<string, number>, key: string, order: number): void => {
    if (!key) return;
    const normalized = key.toLowerCase();
    const variants = [
        normalized,
        normalized.replace(/-/g, '_'),
        normalized.replace(/_/g, '-'),
        `weapon_${normalized}`,
        `weapon_${normalized.replace(/-/g, '_')}`,
    ];
    for (const variant of variants) {
        if (!map.has(variant)) map.set(variant, order);
    }
};

const WEAPON_DB_ORDER = (() => {
    const map = new Map<string, number>();
    let order = 0;
    const seen = new Set<string>();

    for (const category of WEAPON_CATEGORY_ORDER) {
        for (const weapon of WEAPONS_DB) {
            if (weapon.variant !== 'STANDARD' || weapon.category !== category) continue;
            const baseKey = weapon.baseId ?? weapon.id;
            if (seen.has(baseKey)) continue;
            seen.add(baseKey);
            registerWeaponOrderKeys(map, weapon.id, order);
            registerWeaponOrderKeys(map, baseKey, order);
            order += 1;
        }
    }

    WEAPONS_DB.forEach((weapon, dbIndex) => {
        registerWeaponOrderKeys(map, weapon.id, order + dbIndex);
        if (weapon.baseId) registerWeaponOrderKeys(map, weapon.baseId, order + dbIndex);
    });

    return map;
})();

const getWeaponDbOrderIndex = (loadoutId: string): number => {
    const direct =
        WEAPON_DB_ORDER.get(loadoutId.toLowerCase())
        ?? WEAPON_DB_ORDER.get(loadoutId.toLowerCase().replace(/^weapon_/, ''));
    if (direct !== undefined) return direct;

    const resolved = findWeaponByLoadoutId(loadoutId);
    if (resolved) {
        const keys = [resolved.id, resolved.baseId].filter(Boolean) as string[];
        for (const key of keys) {
            const idx = WEAPON_DB_ORDER.get(key.toLowerCase());
            if (idx !== undefined) return idx;
        }
    }

    return Number.MAX_SAFE_INTEGER;
};

const compareWeaponDbOrder = (aId: string, bId: string): number => {
    const aOrder = getWeaponDbOrderIndex(aId);
    const bOrder = getWeaponDbOrderIndex(bId);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return compareStrings(aId, bId);
};

const SORT_HEADER_COLOR_DESC = 'var(--color-accent-hover)';
const SORT_HEADER_COLOR_ASC = '#54a0ff';

type SortableThProps<K extends string> = {
    column: K;
    sortState: TableSortState<K>;
    onSort: (column: K) => void;
    style?: React.CSSProperties;
    children: React.ReactNode;
    title?: string;
};

const SortableTh = <K extends string>({ column, sortState, onSort, style, children, title }: SortableThProps<K>) => {
    const isActive = sortState.column === column;
    const sortColor = isActive
        ? (sortState.direction === 'desc' ? SORT_HEADER_COLOR_DESC : SORT_HEADER_COLOR_ASC)
        : undefined;

    return (
        <th
            style={{
                ...style,
                cursor: 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap',
            }}
            title={title}
            onClick={() => onSort(column)}
            aria-sort={isActive ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <span style={{ color: sortColor }}>
                {children}
            </span>
        </th>
    );
};

const mainTableHeadCellStyle: React.CSSProperties = {
    padding: '12px 20px',
    background: 'var(--color-bg-table-header)',
};

const mapBreakdownBodyCellStyle: React.CSSProperties = {
    padding: '10px 12px',
    verticalAlign: 'middle',
    boxSizing: 'border-box',
};

const mapBreakdownLegendBodyCellStyle: React.CSSProperties = {
    ...mapBreakdownBodyCellStyle,
    maxWidth: 0,
    overflow: 'hidden',
};

const mapBreakdownLegendInnerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    color: 'var(--color-text-dim)',
    fontWeight: 'bold',
};

const MARQUEE_OVERFLOW_KEYFRAMES = `
@keyframes marqueeOverflowPan {
    from { transform: translateX(0); }
    to { transform: translateX(calc(-1 * var(--marquee-overflow-distance, 0px))); }
}
`;

const MarqueeOverflowText = ({
    text,
    textStyle,
    containerStyle,
}: {
    text: string;
    textStyle?: React.CSSProperties;
    containerStyle?: React.CSSProperties;
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [shouldMarquee, setShouldMarquee] = useState(false);
    const [overflowDistance, setOverflowDistance] = useState(0);

    useEffect(() => {
        const updateOverflow = () => {
            const container = containerRef.current;
            const textEl = textRef.current;
            if (!container || !textEl) return;
            const distance = Math.max(0, textEl.scrollWidth - container.clientWidth);
            setOverflowDistance(distance);
            setShouldMarquee(distance > 1);
        };

        updateOverflow();
        const observer = new ResizeObserver(updateOverflow);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [text]);

    return (
        <div
            ref={containerRef}
            title={shouldMarquee ? text : undefined}
            style={{
                width: '100%',
                minWidth: 0,
                overflow: 'hidden',
                ...containerStyle,
            }}
        >
            <span
                ref={textRef}
                style={{
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                    minWidth: shouldMarquee ? 'max-content' : undefined,
                    paddingRight: shouldMarquee ? '12px' : 0,
                    animation: shouldMarquee
                        ? `marqueeOverflowPan ${Math.max(3, Math.min(7, overflowDistance / 18))}s ease-in-out infinite alternate`
                        : undefined,
                    willChange: shouldMarquee ? 'transform' : undefined,
                    ['--marquee-overflow-distance' as string]: `${overflowDistance}px`,
                    ...textStyle,
                } as React.CSSProperties}
            >
                {text}
            </span>
        </div>
    );
};

const MarqueeLegendName = ({ name }: { name: string }) => {
    return (
        <MarqueeOverflowText
            text={name}
            containerStyle={{ flex: 1, minWidth: 0 }}
            textStyle={{ lineHeight: 1.3 }}
        />
    );
};

const mapBreakdownPanelHeaderStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg-table-header)',
    minHeight: '58px',
    boxSizing: 'border-box',
};

const legendBreakdownPanelStyle: React.CSSProperties = {
    background: 'var(--color-bg-sub-header)',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
};

const LegendWeaponMapBreakdown = ({ matches, legendName }: { matches: MatchHistory[]; legendName: string }) => {
    const { t } = useTranslation();
    type WeaponSortCol = 'name' | 'games' | 'winRate' | 'avgPlacement' | 'kd';
    const [weaponSort, setWeaponSort] = useState<TableSortState<WeaponSortCol>>(createDefaultTableSort);
    const weaponStats = useMemo(() => aggregateWeaponStatsForMatches(matches).slice(0, 8), [matches]);
    const sortedWeaponStats = useMemo(
        () => applyTableSort(weaponStats, weaponSort, {
            name: (a, b) => compareWeaponDbOrder(a.id, b.id),
            games: (a, b) => compareNumbers(a.games, b.games),
            winRate: (a, b) => compareNumericStrings(a.winRate, b.winRate),
            avgPlacement: (a, b) => compareAvgPlacement(a.avgPlacement, b.avgPlacement),
            kd: (a, b) => compareNumbers(a.kd, b.kd),
        }),
        [weaponStats, weaponSort],
    );
    const mapStats = useMemo(() => aggregateMapStatsForMatches(matches), [matches]);

    const panelHeader = (title: string) => (
        <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-table-header)',
        }}>
            <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '13px' }}>{title}</h4>
            <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginTop: '2px' }}>
                {t('statistics.legends.breakdownSubtitle', { legend: legendName })}
            </div>
        </div>
    );

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
            <div style={legendBreakdownPanelStyle}>
                {panelHeader(t('statistics.legends.topWeapons'))}
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {weaponStats.length > 0 ? (
                        <table style={mapBreakdownTableStyle}>
                            <colgroup>
                                <col style={{ width: '28px' }} />
                                <col />
                                <col style={{ width: '58px' }} />
                                <col style={{ width: '58px' }} />
                                <col style={{ width: '58px' }} />
                                <col style={{ width: '52px' }} />
                            </colgroup>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>#</th>
                                    <SortableTh column="name" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'left' }}>
                                        {t('statistics.weapons.weapon')}
                                    </SortableTh>
                                    <SortableTh column="games" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.matches')}
                                    </SortableTh>
                                    <SortableTh column="winRate" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.winPercent')}
                                    </SortableTh>
                                    <SortableTh column="avgPlacement" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }} title={t('statistics.common.avgPlacement')}>
                                        {t('statistics.common.avgPlacementShort')}
                                    </SortableTh>
                                    <SortableTh column="kd" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.kd')}
                                    </SortableTh>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedWeaponStats.map((w, i) => (
                                    <tr key={w.id} style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }}>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>{i + 1}</td>
                                        <td style={mapBreakdownLegendBodyCellStyle}>
                                            <div style={mapBreakdownLegendInnerStyle}>
                                                <div style={{ width: '40px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', flexShrink: 0 }}>
                                                    <img
                                                        src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${w.id}.png`}
                                                        alt={w.name}
                                                        style={{ maxWidth: '34px', maxHeight: '16px', objectFit: 'contain' }}
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                </div>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={w.name}>{w.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-dim)' }}>{w.games}</td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: parseFloat(w.winRate) >= 10 ? '#4ade80' : 'var(--color-text-muted)' }}>{w.winRate}%</td>
                                        <AvgPlacementCell value={w.avgPlacement} padding="10px 12px" />
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: 'var(--color-warning)' }}>{w.kd}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px' }}>
                            {t('statistics.legends.noWeaponRankData')}
                        </div>
                    )}
                </div>
            </div>

            <div style={legendBreakdownPanelStyle}>
                {panelHeader(t('statistics.legends.mapDistribution'))}
                <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px 12px 12px' }}>
                    {mapStats.length > 0 ? (
                        mapStats.map((m, i) => {
                            const mapUrl = getMapThumbnailUrl(m.name);
                            return (
                                <div key={m.name} style={{ marginBottom: i < mapStats.length - 1 ? '14px' : 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                            <span style={{ color: 'var(--color-text-faint)', fontSize: '11px', fontWeight: 'bold', width: '16px' }}>{i + 1}</span>
                                            <span style={{ color: 'var(--color-text-dim)', fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.name}>{m.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <div style={{ fontSize: '11px', color: '#54a0ff', whiteSpace: 'nowrap', fontWeight: '600' }}>
                                                {t('statistics.legends.mapShareLabel', { count: m.games, percent: m.share.toFixed(1) })}
                                            </div>
                                            <div style={{
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                padding: '2px 7px',
                                                borderRadius: '4px',
                                                whiteSpace: 'nowrap',
                                                background: parseFloat(m.winRate) >= 10 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.06)',
                                                color: parseFloat(m.winRate) >= 10 ? '#4ade80' : 'var(--color-text-muted)',
                                                border: `1px solid ${parseFloat(m.winRate) >= 10 ? 'rgba(74, 222, 128, 0.35)' : 'var(--color-border)'}`,
                                            }}>
                                                {t('statistics.legends.winRate')} {m.winRate}%
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{
                                        position: 'relative',
                                        width: '100%',
                                        height: '38px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-deep)',
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.65)), url(${mapUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            opacity: 0.4,
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            bottom: 0,
                                            width: `${m.share}%`,
                                            minWidth: m.share > 0 ? '4px' : 0,
                                            backgroundImage: `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.35)), url(${mapUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                                        }} />
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ padding: '24px 4px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px' }}>
                            {t('statistics.legends.noMapRankData')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const isSelfTeammateEntry = (
    tm: { uid?: string | null; name?: string },
    matchPlayerName: string | undefined,
    profileUid?: string | null,
    profileName?: string | null,
) => {
    if (profileUid && tm.uid && String(tm.uid) === String(profileUid)) return true;
    if (profileName && tm.name && isSamePlayer(tm.name, profileName)) return true;
    if (matchPlayerName && tm.name && isSamePlayer(tm.name, matchPlayerName)) return true;
    return false;
};

const aggregateTeammateLegendPicksForMatches = (
    matches: MatchHistory[],
    profileUid?: string | null,
    profileName?: string | null,
) => {
    const counts: Record<string, { picks: number; wins: number; placement: number }> = {};
    let totalPicks = 0;

    matches.forEach(m => {
        const teamStats = (m as { teamStats?: Array<{ name?: string; uid?: string | null; legend?: string }> }).teamStats;
        if (!teamStats?.length) return;
        const isWin = m.placement === 1;
        const matchPlacement = getMatchPlacement(m);

        teamStats.forEach(tm => {
            if (isSelfTeammateEntry(tm, (m as { playerName?: string }).playerName, profileUid, profileName)) return;
            if (!isKnownLegend(tm.legend)) return;
            const legend = normalizeLegendKey(tm.legend);
            if (!counts[legend]) counts[legend] = { picks: 0, wins: 0, placement: 0 };
            counts[legend].picks++;
            counts[legend].placement += matchPlacement;
            if (isWin) counts[legend].wins++;
            totalPicks++;
        });
    });

    return Object.entries(counts)
        .map(([id, { picks, wins, placement }]) => ({
            id,
            name: formatLegendDisplayName(id),
            picks,
            pickRate: totalPicks > 0 ? ((picks / totalPicks) * 100).toFixed(1) : '0.0',
            winRate: picks > 0 ? ((wins / picks) * 100).toFixed(1) : '0.0',
            avgPlacement: formatAvgPlacement(placement, picks),
        }))
        .sort((a, b) => {
            if (b.picks !== a.picks) return b.picks - a.picks;
            return parseFloat(b.pickRate) - parseFloat(a.pickRate);
        });
};


const MapLegendBreakdown = ({
    matches,
    mapName,
    profileUid,
    profileName,
}: {
    matches: MatchHistory[];
    mapName: string;
    profileUid?: string | null;
    profileName?: string | null;
}) => {
    const { t } = useTranslation();
    type MapLegendSortCol = 'name' | 'games' | 'winRate' | 'avgPlacement' | 'kd' | 'avgDamage';
    type TeammatePickSortCol = 'name' | 'picks' | 'winRate' | 'avgPlacement' | 'pickRate';
    const [legendSort, setLegendSort] = useState<TableSortState<MapLegendSortCol>>(createDefaultTableSort);
    const [teammateSort, setTeammateSort] = useState<TableSortState<TeammatePickSortCol>>(createDefaultTableSort);
    const legendStats = useMemo(() => aggregateLegendStatsForMatches(matches), [matches]);
    const sortedLegendStats = useMemo(
        () => applyTableSort(legendStats, legendSort, {
            name: (a, b) => compareLegendTabOrder(a.id, b.id),
            games: (a, b) => compareNumbers(a.games, b.games),
            winRate: (a, b) => compareNumericStrings(a.winRate, b.winRate),
            avgPlacement: (a, b) => compareAvgPlacement(a.avgPlacement, b.avgPlacement),
            kd: (a, b) => compareNumbers(a.kd, b.kd),
            avgDamage: (a, b) => compareNumbers(a.avgDamage, b.avgDamage),
        }),
        [legendStats, legendSort],
    );
    const teammatePickStats = useMemo(
        () => aggregateTeammateLegendPicksForMatches(matches, profileUid, profileName),
        [matches, profileUid, profileName]
    );
    const sortedTeammatePickStats = useMemo(
        () => applyTableSort(teammatePickStats, teammateSort, {
            name: (a, b) => compareLegendTabOrder(a.id, b.id),
            picks: (a, b) => compareNumbers(a.picks, b.picks),
            winRate: (a, b) => compareNumericStrings(a.winRate, b.winRate),
            avgPlacement: (a, b) => compareAvgPlacement(a.avgPlacement, b.avgPlacement),
            pickRate: (a, b) => compareNumericStrings(a.pickRate, b.pickRate),
        }),
        [teammatePickStats, teammateSort],
    );

    const renderLegendAvatar = (legendId: string, size: number) => (
        <img
            src={`${MAP_IMAGE_BASE}${legendId}.png`}
            alt={legendId}
            style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%' }}
            onError={(e) => {
                e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`;
            }}
        />
    );

    const panelHeader = (title: string, subtitle: string) => (
        <div style={mapBreakdownPanelHeaderStyle}>
            <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: '18px' }}>{title}</h4>
            <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginTop: '2px', lineHeight: '15px' }}>{subtitle}</div>
        </div>
    );

    const renderMapBreakdownLegendCell = (legendId: string, name: string) => (
        <td style={mapBreakdownLegendBodyCellStyle}>
            <div style={mapBreakdownLegendInnerStyle}>
                <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', flexShrink: 0, overflow: 'hidden' }}>
                    {renderLegendAvatar(legendId, 24)}
                </div>
                <MarqueeLegendName name={name} />
            </div>
        </td>
    );

    if (legendStats.length === 0 && teammatePickStats.length === 0) return null;

    return (
        <div style={{ marginTop: '28px' }}>
            <style>{MARQUEE_OVERFLOW_KEYFRAMES}</style>
            <div style={{ marginBottom: '18px' }}>
                <h3 style={{ margin: '0 0 4px 0', color: 'var(--color-text-primary)', fontSize: '16px' }}>
                    {t('statistics.maps.legendBreakdownTitle')}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {t('statistics.maps.legendBreakdownSubtitle', { map: mapName })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                <div style={legendBreakdownPanelStyle}>
                    {panelHeader(
                        t('statistics.maps.myLegendStats'),
                        t('statistics.maps.myLegendStatsHint', { map: mapName })
                    )}
                    {legendStats.length > 0 ? (
                        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                            <table style={mapBreakdownTableStyle}>
                                <colgroup>
                                    <col style={{ width: '28px' }} />
                                    <col />
                                    <col style={{ width: '58px' }} />
                                    <col style={{ width: '58px' }} />
                                    <col style={{ width: '58px' }} />
                                    <col style={{ width: '52px' }} />
                                    <col style={{ width: '52px' }} />
                                </colgroup>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <th style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>#</th>
                                        <SortableTh column="name" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'left' }}>
                                            {t('statistics.maps.legendColumn')}
                                        </SortableTh>
                                        <SortableTh column="games" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                            {t('statistics.maps.legendMatches')}
                                        </SortableTh>
                                        <SortableTh column="winRate" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                            {t('statistics.maps.legendWinPercent')}
                                        </SortableTh>
                                        <SortableTh column="avgPlacement" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }} title={t('statistics.common.avgPlacement')}>
                                            {t('statistics.common.avgPlacementShort')}
                                        </SortableTh>
                                        <SortableTh column="kd" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                            {t('statistics.maps.legendKd')}
                                        </SortableTh>
                                        <SortableTh column="avgDamage" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }} title={t('statistics.maps.legendAvgDamage')}>
                                            {t('statistics.maps.legendAvgDamageShort')}
                                        </SortableTh>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedLegendStats.map((leg, i) => (
                                        <tr key={leg.id} style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }}>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>{i + 1}</td>
                                            {renderMapBreakdownLegendCell(leg.id, leg.name)}
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-dim)' }}>{leg.games}</td>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: parseFloat(leg.winRate) >= 10 ? '#4ade80' : 'var(--color-text-muted)' }}>{leg.winRate}%</td>
                                            <AvgPlacementCell value={leg.avgPlacement} padding="10px 12px" />
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: 'var(--color-warning)' }}>{leg.kd}</td>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: '#e056fd' }}>{leg.avgDamage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px' }}>
                            {t('statistics.maps.noMyLegendData')}
                        </div>
                    )}
                </div>

                <div style={legendBreakdownPanelStyle}>
                    {panelHeader(
                        t('statistics.maps.teammateLegendPicks'),
                        t('statistics.maps.teammateLegendPicksHint', { map: mapName })
                    )}
                    {teammatePickStats.length > 0 ? (
                        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                            <table style={mapBreakdownTableStyle}>
                                <colgroup>
                                    <col style={{ width: '28px' }} />
                                    <col />
                                    <col style={{ width: '58px' }} />
                                    <col style={{ width: '58px' }} />
                                    <col style={{ width: '58px' }} />
                                    <col style={{ width: '58px' }} />
                                </colgroup>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <th style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>#</th>
                                        <SortableTh column="name" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'left' }}>
                                            {t('statistics.maps.legendColumn')}
                                        </SortableTh>
                                        <SortableTh column="picks" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                            {t('statistics.maps.teammatePicks')}
                                        </SortableTh>
                                        <SortableTh column="winRate" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                            {t('statistics.maps.legendWinPercent')}
                                        </SortableTh>
                                        <SortableTh column="avgPlacement" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }} title={t('statistics.common.avgPlacement')}>
                                            {t('statistics.common.avgPlacementShort')}
                                        </SortableTh>
                                        <SortableTh column="pickRate" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                            {t('statistics.maps.pickRate')}
                                        </SortableTh>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTeammatePickStats.map((leg, i) => (
                                        <tr key={leg.id} style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }}>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>{i + 1}</td>
                                            {renderMapBreakdownLegendCell(leg.id, leg.name)}
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-dim)' }}>{leg.picks}</td>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: parseFloat(leg.winRate) >= 10 ? '#4ade80' : 'var(--color-text-muted)' }}>{leg.winRate}%</td>
                                            <AvgPlacementCell value={leg.avgPlacement} padding="10px 12px" />
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: '#54a0ff' }}>{leg.pickRate}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px' }}>
                            {t('statistics.maps.noTeammatePickData')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
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
    const totalTime = matches.reduce(
        (sum, m: any) => sum + toGameElapsedMs((m.endTime || Date.now()) - m.startTime),
        0,
    );
    const totalPlacement = matches.reduce((sum, m) => sum + (m.placement ?? 20), 0);
    const maxKills = Math.max(...matches.map(m => m.kills || 0));
    const totalsquadKills = matches.reduce((sum, m: any) => sum + (m.squadKills || 0), 0);
    const legendCounts: Record<string, number> = {};
    matches.forEach(m => {
        if (!isKnownLegend(m.legend)) return;
        const l = normalizeLegendKey(m.legend);
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
        kda: totalDeaths === 0 ? (totalKills + totalAssists).toFixed(2) : ((totalKills + totalAssists) / totalDeaths).toFixed(2),
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

type MatchWithMeta = MatchHistory & {
    map?: string;
    startTime?: number;
    endTime?: number;
    squadKills?: number;
};

/** Linear 0–100; at/below floor → 0, at/above ceiling → 100. */
const linearScore = (value: number, floor: number, ceiling: number): number => {
    if (ceiling <= floor) return value >= ceiling ? 100 : 0;
    if (value <= floor) return 0;
    if (value >= ceiling) return 100;
    return ((value - floor) / (ceiling - floor)) * 100;
};

/** Compress mid/high scores — applied to non-combat axes. */
const strictify = (score: number, power = 1.32): number =>
    Math.pow(Math.max(0, Math.min(100, score)) / 100, power) * 100;

/** Log-scaled 0–100 for metrics whose floor is strictly positive (e.g. survival seconds). */
const logScore = (value: number, floor: number, ceiling: number): number => {
    if (ceiling <= floor) return value >= ceiling ? 100 : 0;
    if (value <= floor) return 0;
    if (value >= ceiling) return 100;
    const lf = Math.log(floor);
    const lc = Math.log(ceiling);
    const lv = Math.log(value);
    return ((lv - lf) / (lc - lf)) * 100;
};

const getMatchSurvivalSec = (m: MatchWithMeta): number => {
    if (!m.startTime) return 0;
    return Math.max(0, Math.round(toGameElapsedMs((m.endTime || Date.now()) - m.startTime) / 1000));
};

/** 1 kill ≈ 200 damage — 피크 대미지 ceiling 기준. */
const DMG_PER_KILL = 200;

/** 0 → 0, ceiling → 100; at ~66.7% of ceiling → ~85 (shared curve). */
const AVG_DAMAGE_CEILING = 1500;
const PEAK_KILLS_CEILING = 20;
const PEAK_DAMAGE_CEILING = PEAK_KILLS_CEILING * DMG_PER_KILL;
const SCORE_CURVE_POWER = Math.log(0.85) / Math.log(1000 / AVG_DAMAGE_CEILING);
/** 교전 전용 — 화력보다 가파른 곡선 (중간 스탯 점수 과다 방지). */
const COMBAT_CURVE_POWER = 0.45;
/** ~85 pt anchor (K/D 3.5, KA/D 5.25). */
const COMBAT_STRONG_KD = 3.5;
const COMBAT_STRONG_KAD = 5.25;
const COMBAT_SCORE_RATIO_AT_85 = Math.pow(0.85, 1 / COMBAT_CURVE_POWER);
const COMBAT_KD_CEILING = COMBAT_STRONG_KD / COMBAT_SCORE_RATIO_AT_85;
const COMBAT_KAD_CEILING = COMBAT_STRONG_KAD / COMBAT_SCORE_RATIO_AT_85;

const curvedMetricScore = (value: number, ceiling: number, power = SCORE_CURVE_POWER): number => {
    const ratio = Math.max(0, Math.min(1, value / ceiling));
    return Math.pow(ratio, power) * 100;
};

const avgDamageScore = (avgDamage: number): number =>
    curvedMetricScore(avgDamage, AVG_DAMAGE_CEILING);

/** Peak match score: 20 kills + 4000 damage = 100 (same curve as 화력, averaged). */
const computePeakMatchScore = (m: MatchWithMeta): number => {
    const kills = m.kills || 0;
    const damage = m.damage || 0;
    return (
        curvedMetricScore(kills, PEAK_KILLS_CEILING) * 0.5 +
        curvedMetricScore(damage, PEAK_DAMAGE_CEILING) * 0.5
    );
};

const findBestPeakMatch = (matches: MatchHistory[]): { match: MatchWithMeta | null; score: number } => {
    let best: MatchWithMeta | null = null;
    let bestScore = 0;
    for (const raw of matches) {
        const m = raw as MatchWithMeta;
        const score = computePeakMatchScore(m);
        if (score > bestScore) {
            bestScore = score;
            best = m;
        }
    }
    return { match: best, score: bestScore };
};

const SCORE_WEIGHTS = {
    combat: 0.25,
    damage: 0.20,
    macro: 0.24,
    team: 0.16,
    peak: 0.15,
} as const;

const computeOverviewAnalytics = (
    stats: NonNullable<ReturnType<typeof calculateStats>>,
    matches: MatchHistory[],
) => {
    const kd = parseFloat(String(stats.kd));
    const kda = parseFloat(String(stats.kda));
    const avgPlacement = parseFloat(String(stats.avgPlacement));
    const killContrib = parseFloat(String(stats.lograte));

    const scoreCombat =
        curvedMetricScore(kd, COMBAT_KD_CEILING, COMBAT_CURVE_POWER) * 0.55 +
        curvedMetricScore(kda, COMBAT_KAD_CEILING, COMBAT_CURVE_POWER) * 0.45;

    const scoreDamage = avgDamageScore(stats.avgDamage);

    const scorePlace = linearScore(20 - avgPlacement, 0, 19);
    const scoreSurvTime = logScore(stats.avgTimeSec, 180, 1020);
    const scoreMacro = strictify(scorePlace * 0.65 + scoreSurvTime * 0.35);

    const scoreTeam = Math.max(0, Math.min(100, killContrib));

    const { match: bestPeakMatch, score: scorePeak } = findBestPeakMatch(matches);

    const weightedScore = Math.max(0, Math.min(100,
        scoreCombat * SCORE_WEIGHTS.combat +
        scoreDamage * SCORE_WEIGHTS.damage +
        scoreMacro * SCORE_WEIGHTS.macro +
        scoreTeam * SCORE_WEIGHTS.team +
        scorePeak * SCORE_WEIGHTS.peak,
    ));

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
        radarScores: {
            combat: scoreCombat,
            damage: scoreDamage,
            macro: scoreMacro,
            team: scoreTeam,
            peak: scorePeak,
        },
        bestPeakMatch,
        totalTier: tier,
        totalScore: Math.round(weightedScore),
    };
};

interface EmptyStateProps {
    msg?: string;
}

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

const MapOverviewStat = ({ label, value, color = 'var(--color-text-primary)' }: { label: string; value: string | number; color?: string }) => (
    <div style={{
        textAlign: 'center',
        padding: '14px 10px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
    }}>
        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '6px', fontWeight: 600, lineHeight: 1.25 }}>{label}</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color, lineHeight: 1.2 }}>{value}</div>
    </div>
);

const MapOverviewTopCardStat = ({ label, value, color = 'var(--color-text-primary)' }: { label: string; value: string | number; color?: string }) => (
    <div style={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color }}>{value}</div>
    </div>
);

const OverviewSideStatRow = ({ label, value, color = 'var(--color-text-primary)', noBorder = false }: { label: string; value: string | number; color?: string; noBorder?: boolean }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        padding: '11px 0',
        borderBottom: noBorder ? 'none' : '1px solid var(--color-border)',
    }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, lineHeight: 1.3 }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: 'bold', color, flexShrink: 0 }}>{value}</span>
    </div>
);

const OVERVIEW_CHART_MARGIN = { top: 4, right: 12, left: 8, bottom: 18 };
const OVERVIEW_Y_AXIS_WIDTH = 44;

const overviewXAxisTick = { fill: 'var(--color-text-faint)', fontSize: 9 };

type RadarAxisKey = 'combat' | 'damage' | 'macro' | 'team' | 'peak';

const RADAR_OUTER_RADIUS_RATIO = 0.68;

const polarPointFromTopCw = (cx: number, cy: number, r: number, degFromTopCw: number) => {
    const rad = (degFromTopCw * Math.PI) / 180;
    return {
        x: cx + r * Math.sin(rad),
        y: cy - r * Math.cos(rad),
    };
};

const buildRadarWedgePath = (cx: number, cy: number, r: number, index: number, count: number) => {
    const slice = 360 / count;
    const startDeg = (index - 0.5) * slice;
    const endDeg = (index + 0.5) * slice;
    const start = polarPointFromTopCw(cx, cy, r, startDeg);
    const end = polarPointFromTopCw(cx, cy, r, endDeg);
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y} Z`;
};

const getMatchSurvivalLabel = (m: MatchWithMeta): string | null => {
    const sec = getMatchSurvivalSec(m);
    if (sec <= 0) return null;
    return formatDuration(sec * 1000);
};

const RadarTooltipRow = ({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', lineHeight: 1.45 }}>
        <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        <span style={{ color: color ?? 'var(--color-text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
);

const OverviewRadarChart = ({
    radarData,
    stats,
    radarScores,
    bestPeakMatch,
    isPremium,
}: {
    radarData: Array<{ subject: string; A: number; fullMark: number; key: RadarAxisKey }>;
    stats: NonNullable<ReturnType<typeof calculateStats>>;
    radarScores: ReturnType<typeof computeOverviewAnalytics>['radarScores'];
    bestPeakMatch: MatchWithMeta | null;
    isPremium: boolean;
}) => {
    const { t } = useTranslation();
    const [chartSize, setChartSize] = useState({ w: 0, h: 0 });
    const [hoveredKey, setHoveredKey] = useState<RadarAxisKey | null>(null);
    const hoverSubject = hoveredKey ? radarData.find(d => d.key === hoveredKey)?.subject : null;

    const wedgeLayers = useMemo(() => {
        if (chartSize.w <= 0 || chartSize.h <= 0) return [];
        const cx = chartSize.w / 2;
        const cy = chartSize.h / 2;
        const outerR = (Math.min(chartSize.w, chartSize.h) / 2) * RADAR_OUTER_RADIUS_RATIO;
        return radarData.map((entry, index) => ({
            key: entry.key,
            path: buildRadarWedgePath(cx, cy, outerR, index, radarData.length),
        }));
    }, [chartSize, radarData]);

    const renderAngleAxisTick = (props: {
        x?: string | number;
        y?: string | number;
        payload?: { value: string };
        textAnchor?: 'inherit' | 'end' | 'start' | 'middle';
    }) => {
        const x = Number(props.x ?? 0);
        const y = Number(props.y ?? 0);
        const { payload, textAnchor = 'middle' } = props;
        const point = radarData.find(d => d.subject === payload?.value);
        const isHovered = point?.key != null && point.key === hoveredKey;
        return (
            <text
                x={x}
                y={y}
                textAnchor={textAnchor}
                fill={isHovered ? COLORS.NEON_ORANGE : 'var(--color-text-dim)'}
                fontSize={10}
                fontWeight="bold"
            >
                {payload?.value}
            </text>
        );
    };

    const tooltipBody = useMemo(() => {
        if (!hoveredKey) return null;
        const score = Math.round(radarScores[hoveredKey]);
        const title = hoverSubject ?? '';
        const rows: React.ReactNode[] = [];

        const header = (
            <div key="header" style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.NEON_ORANGE }}>{title}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {t('statistics.overview.radarTooltipScore', { score })}
                </div>
            </div>
        );

        switch (hoveredKey) {
            case 'combat':
                rows.push(
                    <RadarTooltipRow key="kd" label={t('statistics.maps.kdRatio')} value={stats.kd} color="var(--color-warning)" />,
                    isPremium ? <RadarTooltipRow key="kad" label={t('statistics.weapons.kad')} value={stats.kda} color="#54a0ff" /> : null,
                );
                break;
            case 'damage':
                rows.push(
                    <RadarTooltipRow key="avg" label={t('statistics.maps.avgDamage')} value={stats.avgDamage.toLocaleString()} color="#e056fd" />,
                    <div key="total" style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginTop: '2px' }}>
                        {t('statistics.overview.totalDamage', { count: stats.totalDamage })}
                    </div>,
                );
                break;
            case 'macro':
                rows.push(
                    <RadarTooltipRow key="place" label={t('statistics.common.avgPlacementShort')} value={`#${stats.avgPlacement}`} color={getAvgPlacementColor(stats.avgPlacement)} />,
                    <RadarTooltipRow key="time" label={t('statistics.maps.avgSurvival')} value={stats.avgTime} color="#54a0ff" />,
                );
                break;
            case 'team':
                rows.push(
                    <RadarTooltipRow key="contrib" label={t('statistics.overview.killContributeShort')} value={`${stats.lograte}%`} color="#54a0ff" />,
                    <RadarTooltipRow key="kills" label={t('statistics.legends.totalKills')} value={stats.kills} color="var(--color-danger)" />,
                    <RadarTooltipRow key="ast" label={t('statistics.overview.radarTooltipCombatAssists')} value={stats.assists} />,
                );
                break;
            case 'peak':
                if (bestPeakMatch) {
                    const legendKey = isKnownLegend(bestPeakMatch.legend) ? normalizeLegendKey(bestPeakMatch.legend!) : 'unknown';
                    const legendName = isKnownLegend(bestPeakMatch.legend) ? formatLegendDisplayName(legendKey) : '-';
                    const mapName = resolveMapName(String(bestPeakMatch.map ?? ''));
                    const survival = getMatchSurvivalLabel(bestPeakMatch);
                    rows.push(
                        <RadarTooltipRow key="kills" label={t('statistics.overview.chartKills')} value={bestPeakMatch.kills ?? 0} color="var(--color-danger)" />,
                        <RadarTooltipRow key="place" label={t('statistics.overview.chartPlacement')} value={`#${getMatchPlacement(bestPeakMatch)}`} color={getAvgPlacementColor(getMatchPlacement(bestPeakMatch))} />,
                        <RadarTooltipRow key="dmg" label={t('statistics.overview.chartDamage')} value={(bestPeakMatch.damage ?? 0).toLocaleString()} color="#ffa502" />,
                        <RadarTooltipRow key="legend" label={t('statistics.maps.legendColumn')} value={legendName} />,
                        mapName ? <RadarTooltipRow key="map" label={t('statistics.overview.radarTooltipCarryMap')} value={mapName} /> : null,
                        survival ? <RadarTooltipRow key="surv" label={t('statistics.maps.avgSurvival')} value={survival} /> : null,
                    );
                } else {
                    rows.push(
                        <div key="empty" style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
                            {t('statistics.overview.radarTooltipCarryNoData')}
                        </div>,
                    );
                }
                break;
        }

        return (
            <>
                {header}
                {rows.filter(Boolean)}
            </>
        );
    }, [hoveredKey, hoverSubject, radarScores, stats, bestPeakMatch, isPremium, t]);

    return (
        <>
            {hoveredKey && (
                <div style={{
                    position: 'absolute',
                    top: 10,
                    left: 12,
                    zIndex: 5,
                    minWidth: '168px',
                    maxWidth: '220px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.85)',
                    border: '1px solid var(--color-border)',
                    backdropFilter: 'blur(6px)',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}>
                    {tooltipBody}
                </div>
            )}
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ChartContainer
                height="100%"
                minHeight={240}
                style={{ width: '100%', height: '100%' }}
                onSizeChange={({ width, height }) => setChartSize({ w: width, h: height })}
            >
                    <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="68%"
                        data={radarData}
                        onClick={() => {}}
                    >
                        <PolarGrid stroke="var(--color-border-light)" />
                        <PolarAngleAxis dataKey="subject" tick={renderAngleAxisTick} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                            name="Stats"
                            dataKey="A"
                            stroke={COLORS.NEON_ORANGE}
                            strokeWidth={2.5}
                            fill={COLORS.NEON_ORANGE}
                            fillOpacity={0.35}
                            isAnimationActive={false}
                            dot={false}
                        />
                    </RadarChart>
            </ChartContainer>
                {wedgeLayers.length > 0 && (
                    <svg
                        viewBox={`0 0 ${chartSize.w} ${chartSize.h}`}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                        }}
                        aria-hidden
                    >
                        <g style={{ pointerEvents: 'all' }}>
                            {wedgeLayers.map(wedge => (
                                <path
                                    key={wedge.key}
                                    d={wedge.path}
                                    fill="transparent"
                                    stroke="none"
                                    style={{ cursor: 'default' }}
                                    onMouseEnter={() => setHoveredKey(wedge.key)}
                                    onMouseLeave={() => setHoveredKey(null)}
                                />
                            ))}
                        </g>
                    </svg>
                )}
            </div>
        </>
    );
};

const OverviewTrendChart = ({
    data,
    valueKey,
    color,
    type,
    reversedY,
    hideXAxis = false,
    hoveredMatch,
    onHoverMatch,
    syncId,
}: {
    data: Array<{ idx: number; name: string; kills: number; damage: number; placement: number; legendId: string; legendName: string }>;
    valueKey: 'placement' | 'kills' | 'damage';
    color: string;
    type: 'bar' | 'line';
    reversedY?: boolean;
    hideXAxis?: boolean;
    hoveredMatch: string | null;
    onHoverMatch: (name: string | null) => void;
    syncId: string;
}) => {
    const isHighlighted = (name: string) => hoveredMatch === null || hoveredMatch === name;
    const hoveredIdx = hoveredMatch != null ? Number(hoveredMatch) - 1 : null;
    const xDomain: [number, number] = data.length <= 1 ? [-0.5, 0.5] : [-0.5, data.length - 0.5];
    const xTicks = data.map(d => d.idx);

    const chartHandlers = {
        syncId,
        onMouseMove: (state: { activeLabel?: string | number }) => {
            if (state?.activeLabel == null) return;
            const idx = typeof state.activeLabel === 'number'
                ? state.activeLabel
                : data.find(d => d.name === String(state.activeLabel))?.idx;
            if (idx != null) onHoverMatch(String(idx + 1));
        },
        onMouseLeave: () => onHoverMatch(null),
        onClick: () => {},
    };

    const yAxis = (
        <YAxis
            reversed={reversedY}
            domain={reversedY ? [1, 20] : [0, 'auto']}
            allowDecimals={!reversedY}
            tick={{ fill: 'var(--color-text-faint)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={OVERVIEW_Y_AXIS_WIDTH}
        />
    );

    const hoverLine = hoveredIdx != null ? (
        <ReferenceLine x={hoveredIdx} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} ifOverflow="extendDomain" />
    ) : null;

    const xAxis = (
        <XAxis
            dataKey="idx"
            type="number"
            domain={xDomain}
            ticks={xTicks}
            allowDecimals={false}
            tick={{ ...overviewXAxisTick, textAnchor: 'middle' }}
            tickFormatter={(tick) => String(Number(tick) + 1)}
            tickLine={false}
            axisLine={false}
            hide={hideXAxis}
        />
    );

    return (
        <ChartContainer
            className="overview-trend-chart"
            height={110}
            minHeight={110}
            style={{ minWidth: 0, cursor: 'default', userSelect: 'none' }}
            onMouseDown={(e) => e.preventDefault()}
        >
                    {type === 'bar' ? (
                        <BarChart data={data} margin={OVERVIEW_CHART_MARGIN} barGap={0} {...chartHandlers}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            {xAxis}
                            {yAxis}
                            <Tooltip content={() => null} cursor={false} />
                            {hoverLine}
                            <Bar dataKey={valueKey} radius={[2, 2, 0, 0]} barSize={14}>
                                {data.map(entry => (
                                    <Cell
                                        key={entry.name}
                                        fill={color}
                                        fillOpacity={isHighlighted(entry.name) ? 1 : 0.28}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    ) : (
                        <LineChart data={data} margin={OVERVIEW_CHART_MARGIN} {...chartHandlers}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            {xAxis}
                            {yAxis}
                            <Tooltip content={() => null} cursor={false} />
                            {hoverLine}
                            <Line
                                type="monotone"
                                dataKey={valueKey}
                                stroke={color}
                                strokeWidth={2.5}
                                strokeOpacity={hoveredMatch ? 0.45 : 1}
                                dot={(props) => {
                                    const { cx, cy, payload } = props;
                                    if (cx == null || cy == null || !payload) return null;
                                    const active = isHighlighted(String(payload.name));
                                    const selected = hoveredMatch === String(payload.name);
                                    return (
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={selected ? 5 : 3}
                                            fill={color}
                                            fillOpacity={active ? 1 : 0.28}
                                            stroke="var(--color-bg-sub-header)"
                                            strokeWidth={selected ? 2 : 1}
                                        />
                                    );
                                }}
                                activeDot={false}
                            />
                        </LineChart>
                    )}
        </ChartContainer>
    );
};

const OverviewPerformanceCharts = ({
    data,
}: {
    data: Array<{ idx: number; name: string; kills: number; damage: number; placement: number; legendId: string; legendName: string }>;
}) => {
    const { t } = useTranslation();
    const [hoveredMatch, setHoveredMatch] = useState<string | null>(null);
    const hovered = useMemo(() => data.find(d => d.name === hoveredMatch) ?? null, [data, hoveredMatch]);
    const syncId = 'overview-performance';

    const chartRows = [
        { title: t('statistics.overview.chartPlacement'), valueKey: 'placement' as const, color: '#54a0ff', type: 'line' as const, reversedY: true },
        { title: t('statistics.overview.chartKills'), valueKey: 'kills' as const, color: 'var(--color-danger)', type: 'bar' as const },
        { title: t('statistics.overview.chartDamage'), valueKey: 'damage' as const, color: '#ffa502', type: 'bar' as const },
    ];

    return (
        <>
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                height: '72px',
                position: 'relative',
                boxSizing: 'border-box',
                background: hovered ? 'var(--color-bg-card)' : 'transparent',
                transition: 'background 0.15s',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute',
                    inset: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    opacity: hovered ? 1 : 0,
                    pointerEvents: 'none',
                    transition: 'opacity 0.12s',
                }}>
                    {hovered && (
                        <>
                            <div style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                border: '2px solid var(--color-border)',
                                background: 'rgba(255,255,255,0.05)',
                                flexShrink: 0,
                            }}>
                                <img
                                    src={`${MAP_IMAGE_BASE}${hovered.legendId}.png`}
                                    alt={hovered.legendName}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    onError={(e) => { e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`; }}
                                />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t('statistics.overview.tooltipMatch', { n: hovered.name })}
                                    <span style={{ marginLeft: '8px', color: 'var(--color-text-dim)', fontWeight: 600 }}>{hovered.legendName}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <span style={{ color: getAvgPlacementColor(String(hovered.placement)) }}>#{hovered.placement}</span>
                                    <span style={{ color: 'var(--color-danger)' }}>{hovered.kills} {t('statistics.overview.chartKills')}</span>
                                    <span style={{ color: '#ffa502' }}>{hovered.damage.toLocaleString()} {t('statistics.overview.chartDamage')}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 16px',
                    fontSize: '11px',
                    color: 'var(--color-text-faint)',
                    textAlign: 'center',
                    opacity: hovered ? 0 : 1,
                    pointerEvents: 'none',
                    transition: 'opacity 0.12s',
                }}>
                    {t('statistics.overview.chartHoverHint')}
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: '8px', alignItems: 'center' }}>
                {chartRows.flatMap((row, i) => {
                    const rowEls: React.ReactNode[] = [
                        <div
                            key={`${row.valueKey}-label`}
                            style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: 'var(--color-text-secondary)',
                                lineHeight: 1.3,
                                whiteSpace: 'nowrap',
                                padding: '14px 0 14px 16px',
                                alignSelf: 'center',
                            }}
                        >
                            {row.title}
                        </div>,
                        <div key={`${row.valueKey}-plot`} style={{ minWidth: 0, padding: '14px 16px 14px 0' }}>
                            <OverviewTrendChart
                                data={data}
                                valueKey={row.valueKey}
                                color={row.color}
                                type={row.type}
                                reversedY={row.reversedY}
                                hideXAxis={i < chartRows.length - 1}
                                hoveredMatch={hoveredMatch}
                                onHoverMatch={setHoveredMatch}
                                syncId={syncId}
                            />
                        </div>,
                    ];
                    if (i < chartRows.length - 1) {
                        rowEls.push(
                            <div
                                key={`${row.valueKey}-sep`}
                                style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--color-border)' }}
                            />,
                        );
                    }
                    return rowEls;
                })}
            </div>
        </>
    );
};

const OverviewView = ({
    data,
    showRankProgress,
    profileUid,
    selectedSeasonId,
    seasons,
}: {
    data: MatchHistory[];
    showRankProgress: boolean;
    profileUid?: string | null;
    selectedSeasonId: number;
    seasons: Season[];
}) => {
    const { t } = useTranslation();
    const stats = calculateStats(data);
    const analytics = useMemo(() => (stats ? computeOverviewAnalytics(stats, data) : null), [stats, data]);
    const topMap = useMemo(() => aggregateMapStatsForMatches(data)[0], [data]);
    const headerBgUrl = getMapThumbnailUrl(topMap?.name ?? TARGET_MAPS[0]);

    const radarData = useMemo(() => {
        if (!analytics) return [];
        const { radarScores } = analytics;
        return [
            { subject: t('statistics.overview.radarCombat'), A: radarScores.combat, fullMark: 100, key: 'combat' as const },
            { subject: t('statistics.overview.radarDamage'), A: radarScores.damage, fullMark: 100, key: 'damage' as const },
            { subject: t('statistics.overview.radarMacro'), A: radarScores.macro, fullMark: 100, key: 'macro' as const },
            { subject: t('statistics.overview.radarTeam'), A: radarScores.team, fullMark: 100, key: 'team' as const },
            { subject: t('statistics.overview.radarPeak'), A: radarScores.peak, fullMark: 100, key: 'peak' as const },
        ];
    }, [analytics, t]);

    const trendData = useMemo(() => {
        return [...data].slice(0, 20).reverse().map((m: MatchHistory, i) => {
            const legendKey = isKnownLegend(m.legend) ? normalizeLegendKey(m.legend) : 'unknown';
            return {
                idx: i,
                name: `${i + 1}`,
                kills: m.kills || 0,
                damage: m.damage || 0,
                placement: m.placement != null ? Number(m.placement) : 20,
                legendId: legendKey,
                legendName: isKnownLegend(m.legend) ? formatLegendDisplayName(legendKey) : '-',
            };
        });
    }, [data]);

    if (!stats || !analytics) return <EmptyState />;

    const { totalTier, totalScore } = analytics;
    const tierColor = totalScore >= 80 ? 'var(--color-text-primary)' : (totalScore >= 50 ? 'var(--color-text-dim)' : 'var(--color-text-faint)');
    const mostLegendName = stats.mostLegend !== '-' ? formatLegendDisplayName(stats.mostLegend) : null;

    return (
        <div style={{ animation: 'fadeIn 0.5s' }}>
            <div style={{
                background: 'var(--color-bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
                marginBottom: '20px',
            }}>
                <div style={{ position: 'relative', padding: '20px 24px', borderBottom: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.82), rgba(0,0,0,0.55)), url(${headerBgUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        opacity: 0.5,
                    }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                            {t('statistics.overview.analytics')}
                        </div>
                        <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '20px', fontWeight: 900 }}>
                            {stats.matches} {t('statistics.legends.matches')}
                        </h3>
                        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-dim)' }}>
                            {t('statistics.maps.winRate')} {stats.winRate}%
                            {mostLegendName && (
                                <span style={{ marginLeft: '10px', color: 'var(--color-text-muted)' }}>
                                    · {t('statistics.overview.mainLegend', { legend: mostLegendName })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{
                    padding: '16px 24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
                    gap: '12px',
                    borderBottom: '1px solid var(--color-border)',
                }}>
                    <MapOverviewStat label={t('statistics.maps.totalMatches')} value={stats.matches} />
                    <MapOverviewStat label={t('statistics.maps.winRate')} value={`${stats.winRate}%`} color={parseFloat(stats.winRate) >= 10 ? '#4ade80' : 'var(--color-text-primary)'} />
                    <MapOverviewStat label={t('statistics.common.avgPlacementShort')} value={`#${stats.avgPlacement}`} color={getAvgPlacementColor(stats.avgPlacement)} />
                    <MapOverviewStat label={t('statistics.maps.kdRatio')} value={stats.kd} color="var(--color-warning)" />
                    <MapOverviewStat label={t('statistics.maps.avgDamage')} value={stats.avgDamage} color="#e056fd" />
                    <MapOverviewStat label={t('statistics.weapons.kad')} value={stats.kda} color="#54a0ff" />
                    <MapOverviewStat label={t('statistics.maps.avgSurvival')} value={stats.avgTime} color="#54a0ff" />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.45fr) minmax(168px, 0.55fr)',
                    alignItems: 'stretch',
                    minHeight: '268px',
                }}>
                    <div
                        className="overview-radar-chart"
                        style={{
                            position: 'relative',
                            minHeight: '268px',
                            padding: '10px 12px 14px',
                            borderRight: '1px solid var(--color-border)',
                            userSelect: 'none',
                            cursor: 'default',
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <OverviewRadarChart
                            radarData={radarData}
                            stats={stats}
                            radarScores={analytics.radarScores}
                            bestPeakMatch={analytics.bestPeakMatch}
                            isPremium
                        />
                        <div style={{
                            position: 'absolute',
                            right: 16,
                            bottom: 14,
                            pointerEvents: 'none',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            background: 'rgba(0,0,0,0.45)',
                            border: '1px solid var(--color-border)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '76px',
                            boxSizing: 'border-box',
                        }}>
                            <div style={{ fontSize: '10px', color: COLORS.NEON_RED, fontWeight: 'bold', letterSpacing: '0.06em', lineHeight: 1.2 }}>{t('statistics.overview.tier')}</div>
                            <div style={{ fontSize: '30px', fontWeight: 900, color: tierColor, letterSpacing: '-1px', lineHeight: 1.1, margin: '2px 0' }}>{totalTier}</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.2 }}>{totalScore}/100</div>
                        </div>
                    </div>

                    <div style={{
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        minWidth: 0,
                        gap: '0',
                    }}>
                        {mostLegendName && (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center',
                                paddingBottom: '14px',
                                marginBottom: '6px',
                                borderBottom: '1px solid var(--color-border)',
                            }}>
                                <div style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '2px solid #e17055',
                                    background: 'rgba(255,255,255,0.05)',
                                    marginBottom: '8px',
                                    flexShrink: 0,
                                }}>
                                    <img
                                        src={`${MAP_IMAGE_BASE}${stats.mostLegend}.png`}
                                        alt={mostLegendName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.12)' }}
                                        onError={(e) => { e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`; }}
                                    />
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '3px' }}>
                                    {t('statistics.maps.mostPlayedLegend')}
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-text-dim)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={mostLegendName}>
                                    {mostLegendName}
                                </div>
                            </div>
                        )}
                        <OverviewSideStatRow label={t('statistics.overview.peakKillsShort')} value={stats.maxKills} color="#ff9ff3" />
                        <OverviewSideStatRow label={t('statistics.legends.totalKills')} value={stats.kills} />
                        <OverviewSideStatRow label={t('statistics.overview.killContributeShort')} value={`${stats.lograte}%`} color="#54a0ff" noBorder />
                        <div style={{ paddingTop: '10px', fontSize: '10px', color: 'var(--color-text-faint)', lineHeight: 1.4, textAlign: 'center' }}>
                            {t('statistics.overview.totalDamage', { count: stats.totalDamage })}
                        </div>
                    </div>
                </div>
            </div>

            {showRankProgress && profileUid && (
                <div style={{ marginBottom: '20px' }}>
                    <RankProgressChart
                        uid={profileUid}
                        selectedSeasonId={selectedSeasonId}
                        seasons={seasons}
                    />
                </div>
            )}

            <div style={{ background: 'var(--color-bg-sub-header)', borderRadius: '12px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-table-header)' }}>
                    <h4 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '14px' }}>{t('statistics.overview.performanceChartTitle')}</h4>
                </div>
                <OverviewPerformanceCharts data={trendData} />
            </div>
        </div>
    );
};

const MapOverviewPanel = ({
    mapName,
    matches,
    stats,
}: {
    mapName: string;
    matches: MatchHistory[];
    stats: NonNullable<ReturnType<typeof calculateStats>>;
}) => {
    const { t } = useTranslation();
    const topLegends = useMemo(() => aggregateLegendStatsForMatches(matches).slice(0, 3), [matches]);
    const topWeapons = useMemo(() => aggregateWeaponStatsForMatches(matches).slice(0, 3), [matches]);
    const mapUrl = getMapThumbnailUrl(mapName);

    return (
        <div style={{
            background: 'var(--color-bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            marginBottom: '24px',
        }}>
            <div style={{
                position: 'relative',
                padding: '22px 24px',
                borderBottom: '1px solid var(--color-border)',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.82), rgba(0,0,0,0.55)), url(${mapUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.55,
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                        {t('statistics.maps.overview')}
                    </div>
                    <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '22px', fontWeight: 900 }}>{mapName}</h3>
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-dim)' }}>
                        {t('statistics.maps.totalMatches')}: {stats.matches}
                    </div>
                </div>
            </div>

            <div style={{
                padding: '20px 24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
                gap: '12px',
                borderBottom: '1px solid var(--color-border)',
            }}>
                <MapOverviewStat label={t('statistics.maps.totalMatches')} value={stats.matches} />
                <MapOverviewStat label={t('statistics.maps.winRate')} value={`${stats.winRate}%`} color={parseFloat(stats.winRate) >= 10 ? '#4ade80' : 'var(--color-text-primary)'} />
                <MapOverviewStat label={t('statistics.common.avgPlacementShort')} value={`#${stats.avgPlacement}`} color={getAvgPlacementColor(stats.avgPlacement)} />
                <MapOverviewStat label={t('statistics.maps.avgSurvival')} value={stats.avgTime} color="#54a0ff" />
                <MapOverviewStat label={t('statistics.maps.kdRatio')} value={stats.kd} color="var(--color-warning)" />
                <MapOverviewStat label={t('statistics.weapons.kad')} value={stats.kda} color="#54a0ff" />
                <MapOverviewStat label={t('statistics.maps.avgDamage')} value={stats.avgDamage} color="#e056fd" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '20px 24px 24px' }}>
                <div>
                    <h4 style={{ margin: '0 0 14px 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>{t('statistics.maps.topLegends')}</h4>
                    {topLegends.length > 0 ? (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {topLegends.map((leg, i) => (
                                <div key={leg.id} style={{
                                    flex: 1,
                                    minWidth: 0,
                                    background: 'var(--color-bg-sub-header)',
                                    borderRadius: '10px',
                                    border: `1px solid ${i === 0 ? 'var(--color-warning)' : 'var(--color-border)'}`,
                                    padding: '14px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: i === 0 ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <img
                                            src={`${MAP_IMAGE_BASE}${leg.id}.png`}
                                            alt={leg.name}
                                            style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                                            onError={(e) => { e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`; }}
                                        />
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-dim)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '10px' }} title={leg.name}>
                                        {leg.name}
                                    </div>
                                    <div style={{ display: 'flex', width: '100%', gap: '4px' }}>
                                        <MapOverviewTopCardStat label={t('statistics.maps.legendMatches')} value={leg.games} />
                                        <MapOverviewTopCardStat label={t('statistics.maps.legendWinPercent')} value={`${leg.winRate}%`} color={parseFloat(leg.winRate) >= 10 ? '#4ade80' : 'var(--color-text-primary)'} />
                                        <MapOverviewTopCardStat label={t('statistics.maps.legendKd')} value={leg.kd} color="var(--color-warning)" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px', background: 'var(--color-bg-sub-header)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                            {t('statistics.maps.noMyLegendData')}
                        </div>
                    )}
                </div>

                <div>
                    <h4 style={{ margin: '0 0 14px 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>{t('statistics.maps.topWeapons')}</h4>
                    {topWeapons.length > 0 ? (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {topWeapons.map((w, i) => (
                                <div key={w.id} style={{
                                    flex: 1,
                                    minWidth: 0,
                                    background: 'var(--color-bg-sub-header)',
                                    borderRadius: '10px',
                                    border: `1px solid ${i === 0 ? 'var(--color-warning)' : 'var(--color-border)'}`,
                                    padding: '14px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                }}>
                                    <div style={{
                                        width: '100%',
                                        height: '44px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: i === 0 ? '1px solid var(--color-warning)' : '1px solid var(--color-border)',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <img
                                            src={`${MAP_IMAGE_BASE}${w.id}.png`}
                                            alt={w.name}
                                            style={{ maxWidth: '90%', maxHeight: '36px', objectFit: 'contain' }}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-dim)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '10px' }} title={w.name}>
                                        {w.name}
                                    </div>
                                    <div style={{ display: 'flex', width: '100%', gap: '4px' }}>
                                        <MapOverviewTopCardStat label={t('statistics.weapons.matches')} value={w.games} />
                                        <MapOverviewTopCardStat label={t('statistics.weapons.winPercent')} value={`${w.winRate}%`} color={parseFloat(w.winRate) >= 10 ? '#4ade80' : 'var(--color-text-primary)'} />
                                        <MapOverviewTopCardStat label={t('statistics.weapons.kd')} value={w.kd} color="var(--color-warning)" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px', background: 'var(--color-bg-sub-header)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                            {t('statistics.legends.noWeaponRankData')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LegendOverviewPanel = ({
    legendId,
    legendName,
    matches,
    stats,
    profileUid,
    profileName,
}: {
    legendId: string;
    legendName: string;
    matches: MatchHistory[];
    stats: NonNullable<ReturnType<typeof calculateStats>>;
    profileUid?: string | null;
    profileName?: string | null;
}) => {
    const { t } = useTranslation();
    const topWeapons = useMemo(() => aggregateWeaponStatsForMatches(matches).slice(0, 3), [matches]);
    const topMap = useMemo(() => aggregateMapStatsForMatches(matches)[0], [matches]);
    const topTeammateLegends = useMemo(
        () => aggregateTeammateLegendPicksForMatches(matches, profileUid, profileName).slice(0, 3),
        [matches, profileUid, profileName],
    );
    const portraitUrl = `${MAP_IMAGE_BASE}${legendId}.png`;
    const headerBgUrl = getMapThumbnailUrl(topMap?.name ?? TARGET_MAPS[0]);

    return (
        <div style={{
            background: 'var(--color-bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            marginBottom: '24px',
        }}>
            <div style={{
                position: 'relative',
                padding: '22px 24px',
                borderBottom: '1px solid var(--color-border)',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.82), rgba(0,0,0,0.55)), url(${headerBgUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.55,
                }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '3px solid #e17055',
                        flexShrink: 0,
                        background: 'rgba(0,0,0,0.4)',
                    }}>
                        <img
                            src={portraitUrl}
                            alt={legendName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.15)' }}
                            onError={(e) => { e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`; }}
                        />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                            {t('statistics.legends.overview')}
                        </div>
                        <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '22px', fontWeight: 900, textTransform: 'capitalize' }}>{legendName}</h3>
                        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-dim)' }}>
                            {t('statistics.legends.matches')}: {stats.matches}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{
                padding: '20px 24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
                gap: '12px',
                borderBottom: '1px solid var(--color-border)',
            }}>
                <MapOverviewStat label={t('statistics.legends.matches')} value={stats.matches} />
                <MapOverviewStat label={t('statistics.legends.winRate')} value={`${stats.winRate}%`} color={parseFloat(stats.winRate) >= 10 ? '#4ade80' : 'var(--color-text-primary)'} />
                <MapOverviewStat label={t('statistics.common.avgPlacementShort')} value={`#${stats.avgPlacement}`} color={getAvgPlacementColor(stats.avgPlacement)} />
                <MapOverviewStat label={t('statistics.legends.avgSurvival')} value={stats.avgTime} color="#54a0ff" />
                <MapOverviewStat label={t('statistics.legends.kd')} value={stats.kd} color="var(--color-warning)" />
                <MapOverviewStat label={t('statistics.weapons.kad')} value={stats.kda} color="#54a0ff" />
                <MapOverviewStat label={t('statistics.legends.avgDamage')} value={stats.avgDamage} color="#e056fd" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '20px 24px 24px' }}>
                <div>
                    <h4 style={{ margin: '0 0 14px 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>{t('statistics.legends.topWeapons')}</h4>
                    {topWeapons.length > 0 ? (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {topWeapons.map((w, i) => (
                                <div key={w.id} style={{
                                    flex: 1,
                                    minWidth: 0,
                                    background: 'var(--color-bg-sub-header)',
                                    borderRadius: '10px',
                                    border: `1px solid ${i === 0 ? 'var(--color-warning)' : 'var(--color-border)'}`,
                                    padding: '14px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                }}>
                                    <div style={{
                                        width: '100%',
                                        height: '44px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: i === 0 ? '1px solid var(--color-warning)' : '1px solid var(--color-border)',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <img
                                            src={`${MAP_IMAGE_BASE}${w.id}.png`}
                                            alt={w.name}
                                            style={{ maxWidth: '90%', maxHeight: '36px', objectFit: 'contain' }}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-dim)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '10px' }} title={w.name}>
                                        {w.name}
                                    </div>
                                    <div style={{ display: 'flex', width: '100%', gap: '4px' }}>
                                        <MapOverviewTopCardStat label={t('statistics.weapons.matches')} value={w.games} />
                                        <MapOverviewTopCardStat label={t('statistics.weapons.winPercent')} value={`${w.winRate}%`} color={parseFloat(w.winRate) >= 10 ? '#4ade80' : 'var(--color-text-primary)'} />
                                        <MapOverviewTopCardStat label={t('statistics.weapons.kd')} value={w.kd} color="var(--color-warning)" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px', background: 'var(--color-bg-sub-header)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                            {t('statistics.legends.noWeaponRankData')}
                        </div>
                    )}
                </div>

                <div>
                    <h4 style={{ margin: '0 0 14px 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>{t('statistics.legends.topTeammateLegends')}</h4>
                    {topTeammateLegends.length > 0 ? (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {topTeammateLegends.map((leg, i) => (
                                <div key={leg.id} style={{
                                    flex: 1,
                                    minWidth: 0,
                                    background: 'var(--color-bg-sub-header)',
                                    borderRadius: '10px',
                                    border: `1px solid ${i === 0 ? 'var(--color-warning)' : 'var(--color-border)'}`,
                                    padding: '14px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: i === 0 ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <img
                                            src={`${MAP_IMAGE_BASE}${leg.id}.png`}
                                            alt={leg.name}
                                            style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                                            onError={(e) => { e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`; }}
                                        />
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-dim)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '10px' }} title={leg.name}>
                                        {leg.name}
                                    </div>
                                    <div style={{ display: 'flex', width: '100%', gap: '4px' }}>
                                        <MapOverviewTopCardStat label={t('statistics.maps.teammatePicks')} value={leg.picks} />
                                        <MapOverviewTopCardStat label={t('statistics.maps.pickRate')} value={`${leg.pickRate}%`} color="#54a0ff" />
                                        <MapOverviewTopCardStat label={t('statistics.maps.legendWinPercent')} value={`${leg.winRate}%`} color={parseFloat(leg.winRate) >= 10 ? '#4ade80' : 'var(--color-text-primary)'} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px', background: 'var(--color-bg-sub-header)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                            {t('statistics.maps.noTeammatePickData')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const MapsView = ({ data, profileUid, profileName }: { data: MatchHistory[]; profileUid?: string | null; profileName?: string | null }) => {
    const { t } = useTranslation();
    const [selectedMap, setSelectedMap] = useState<string>(TARGET_MAPS[0]);
    const mapMatches = useMemo(
        () => data.filter(m => ((m as any).map || '').toLowerCase() === selectedMap.toLowerCase()),
        [data, selectedMap]
    );
    const stats = useMemo(() => calculateStats(mapMatches), [mapMatches]);

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
                <>
                    <MapOverviewPanel mapName={selectedMap} matches={mapMatches} stats={stats} />
                    <MapLegendBreakdown matches={mapMatches} mapName={selectedMap} profileUid={profileUid} profileName={profileName} />
                </>
            ) : (
                <EmptyState msg={t('statistics.maps.noMatchesFound', { map: selectedMap })} />
            )}
        </div>
    );
};

const LegendsView = ({ data, profileUid, profileName }: { data: MatchHistory[]; profileUid?: string | null; profileName?: string | null }) => {
    const { t } = useTranslation();
    const [selectedLegend, setSelectedLegend] = useState<string>('wraith');
    const legendMatches = useMemo(
        () => data.filter(m => normalizeLegendKey(m.legend) === selectedLegend.toLowerCase()),
        [data, selectedLegend]
    );
    const stats = useMemo(() => calculateStats(legendMatches), [legendMatches]);
    const legendDisplayName = formatLegendDisplayName(selectedLegend);

    const pieData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const counts: Record<string, number> = {};
        data.forEach(m => {
            if (!isKnownLegend(m.legend)) return;
            const l = normalizeLegendKey(m.legend);
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
                            <ChartContainer height={200} minHeight={200}>
                                <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                                        {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS.CHART[index % COLORS.CHART.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-deep)', border: '1px solid var(--color-border-light)', fontSize: '12px' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <RechartsLegend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ChartContainer>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-faint)', fontSize: '12px' }}>{t('statistics.legends.noData')}</div>
                    )}
                </div>
            </div>

            {stats ? (
                <>
                    <LegendOverviewPanel legendId={selectedLegend} legendName={legendDisplayName} matches={legendMatches} stats={stats} profileUid={profileUid} profileName={profileName} />
                    <LegendWeaponMapBreakdown matches={legendMatches} legendName={legendDisplayName} />
                </>
            ) : <EmptyState msg={t('statistics.legends.noMatchesFound', { legend: selectedLegend })} />}
        </div>
    );
};

const WeaponsView = ({ data }: { data: MatchHistory[] }) => {
    const { t } = useTranslation();
    type WeaponSortCol = 'name' | 'games' | 'winRate' | 'kd' | 'kda' | 'avgPlacement';
    const [weaponSort, setWeaponSort] = useState<TableSortState<WeaponSortCol>>(createDefaultTableSort);
    const weaponStats = useMemo(() => aggregateWeaponStatsForMatches(data), [data]);
    const sortedWeaponStats = useMemo(
        () => applyTableSort(weaponStats, weaponSort, {
            name: (a, b) => compareWeaponDbOrder(a.id, b.id),
            games: (a, b) => compareNumbers(a.games, b.games),
            winRate: (a, b) => compareNumericStrings(a.winRate, b.winRate),
            kd: (a, b) => compareNumbers(a.kd, b.kd),
            kda: (a, b) => compareNumbers(a.kda, b.kda),
            avgPlacement: (a, b) => compareAvgPlacement(a.avgPlacement, b.avgPlacement),
        }),
        [weaponStats, weaponSort],
    );

    const top3 = weaponStats.slice(0, 3);

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
                        <div style={{ display: 'flex', alignItems: 'center', fontSize: '18px', fontWeight: '900', color: 'var(--color-text-primary)', marginBottom: '15px', minWidth: 0 }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={w.name}>{w.name}</span>
                            <WeaponTopLegends legendIds={w.topLegends} />
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
                <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-table-header)' }}>
                    <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '14px' }}>{t('statistics.weapons.detailedStatsTitle')}</h4>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg-table-header)', zIndex: 2 }}>
                            <tr style={{ color: 'var(--color-text-muted)', fontSize: '11px', borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ ...mainTableHeadCellStyle, width: '50px' }}>{t('statistics.weapons.rank')}</th>
                                <SortableTh column="name" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={mainTableHeadCellStyle}>
                                    {t('statistics.weapons.weapon')}
                                </SortableTh>
                                <SortableTh column="games" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.weapons.matches')}
                                </SortableTh>
                                <SortableTh column="winRate" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.weapons.winRate')}
                                </SortableTh>
                                <SortableTh column="kd" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.weapons.kd')}
                                </SortableTh>
                                <SortableTh column="kda" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.weapons.kad')}
                                    <span
                                        title={t('statistics.weapons.kadTooltip')}
                                        style={{ cursor: 'help', marginLeft: '4px', display: 'inline-block', verticalAlign: 'middle' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <FaInfoCircle size={12} color="var(--color-text-muted)" />
                                    </span>
                                </SortableTh>
                                <SortableTh column="avgPlacement" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }} title={t('statistics.common.avgPlacement')}>
                                    {t('statistics.common.avgPlacementShort')}
                                </SortableTh>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedWeaponStats.map((w, i) => (
                                <tr key={w.id} style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-card-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '12px 20px', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>#{i + 1}</td>
                                    <td style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', color: 'var(--color-text-dim)', fontWeight: 'bold', minWidth: 0 }}>
                                        <div style={{ width: '50px', height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginRight: '12px', flexShrink: 0 }}>
                                            <img
                                                src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${w.id}.png`}
                                                alt={w.name}
                                                style={{ maxWidth: '40px', maxHeight: '20px', objectFit: 'contain' }}
                                                onError={(e) => { e.currentTarget.style.opacity = '0'; }}
                                            />
                                        </div>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.name}>{w.name}</span>
                                        <WeaponTopLegends legendIds={w.topLegends} />
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', color: 'var(--color-text-dim)' }}>{w.games}</td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: parseFloat(w.winRate) >= 10 ? '#4ade80' : 'var(--color-text-muted)' }}>{w.winRate}%</td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: 'var(--color-warning)' }}>{w.kd}</td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#54a0ff' }}>{w.kda}</td>
                                    <AvgPlacementCell value={w.avgPlacement} padding="12px 20px" />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {weaponStats.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px' }}>{t('statistics.weapons.noWeaponData')}</div>}
                </div>
            </div>
        </div>
    );
};

type TeammateMatchStat = {
    uid: string | null;
    name: string;
    legend: string;
    games: number;
    wins: number;
    kills: number;
    assists: number;
    deaths: number;
    damage: number;
    placement: number;
};

const normalizeTeammateUid = (uid?: string | null): string | null => {
    const value = uid?.trim();
    return value && value !== 'null' ? value : null;
};

const resolveTeammateKey = (
    map: Record<string, TeammateMatchStat & { legendCounts: Record<string, number> }>,
    tm: { uid?: string | null; name?: string }
): string | null => {
    const uid = normalizeTeammateUid(tm.uid);
    const name = (tm.name || '').trim();
    if (!uid && !name) return null;

    for (const [key, entry] of Object.entries(map)) {
        const uidMatch = !!(uid && entry.uid && String(entry.uid) === uid);
        const nameMatch = !!(name && entry.name && isSamePlayer(name, entry.name));
        if (!uidMatch && !nameMatch) continue;

        if (uid && !entry.uid) entry.uid = uid;
        if (name) {
            if (!entry.name) entry.name = name;
            else if (name.includes('[') && !entry.name.includes('[')) entry.name = name;
        }
        return key;
    }

    if (uid) return `uid:${uid}`;
    const nameKey = name.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    return nameKey ? `name:${nameKey}` : null;
};

type PlayerPerformanceBaseline = {
    games: number;
    kd: number;
    kda: number;
    winRate: number;
    avgPlacement: number;
    avgDamage: number;
};

const MIN_GAMES_FOR_TEAMMATE_DELTA = 5;

const computePlayerPerformanceBaseline = (matches: MatchHistory[]): PlayerPerformanceBaseline | null => {
    if (matches.length === 0) return null;

    let wins = 0;
    let kills = 0;
    let assists = 0;
    let deaths = 0;
    let damage = 0;
    let placement = 0;

    matches.forEach((match) => {
        const isWin = match.placement === 1;
        wins += isWin ? 1 : 0;
        kills += match.kills || 0;
        assists += match.assists || 0;
        deaths += isWin ? 0 : 1;
        damage += match.damage || 0;
        placement += getMatchPlacement(match);
    });

    const games = matches.length;
    const kd = deaths === 0 ? kills : kills / deaths;
    const kda = deaths === 0 ? kills + assists : (kills + assists) / deaths;

    return {
        games,
        kd,
        kda,
        winRate: (wins / games) * 100,
        avgPlacement: placement / games,
        avgDamage: Math.round(damage / games),
    };
};

const formatSignedDelta = (delta: number, fractionDigits: number, suffix = ''): string => {
    const fixed = delta.toFixed(fractionDigits);
    if (delta > 0) return `+${fixed}${suffix}`;
    return `${fixed}${suffix}`;
};

const getPerformanceDeltaColor = (delta: number, higherIsBetter: boolean): string => {
    if (Math.abs(delta) < 0.001) return 'var(--color-text-faint)';
    const improved = higherIsBetter ? delta > 0 : delta < 0;
    return improved ? '#4ade80' : '#f87171';
};

const formatVsAverageBadge = (
    delta: number,
    fractionDigits: number,
    higherIsBetter: boolean,
    suffix = '',
): { label: string; color: string } => {
    const threshold = fractionDigits === 0 ? 0.5 : 0.05;
    if (Math.abs(delta) < threshold) {
        return { label: '-', color: 'var(--color-text-faint)' };
    }
    const improved = higherIsBetter ? delta > 0 : delta < 0;
    const magnitude = Math.abs(delta).toFixed(fractionDigits);
    return {
        label: `${improved ? '▲' : '▼'}${magnitude}${suffix}`,
        color: improved ? '#4ade80' : '#f87171',
    };
};

const TeammatesView = ({ data, profileUid, profileName }: { data: MatchHistory[]; profileUid?: string | null; profileName?: string | null }) => {
    const { t } = useTranslation();
    type TeammateSortCol = 'name' | 'games' | 'winRate' | 'kd' | 'kda' | 'avgPlacement' | 'avgDamage';
    const [teammateSort, setTeammateSort] = useState<TableSortState<TeammateSortCol>>(createDefaultTableSort);
    const isSelfTeammate = (
        tm: { uid?: string | null; name?: string },
        matchPlayerName?: string
    ) => {
        if (profileUid && tm.uid && String(tm.uid) === String(profileUid)) return true;
        if (profileName && tm.name && isSamePlayer(tm.name, profileName)) return true;
        if (matchPlayerName && tm.name && isSamePlayer(tm.name, matchPlayerName)) return true;
        return false;
    };

    const teammateStats = useMemo(() => {
        const map: Record<string, TeammateMatchStat & { legendCounts: Record<string, number> }> = {};

        data.forEach(m => {
            const teamStats = (m as any).teamStats as Array<{ name?: string; uid?: string | null; legend?: string }> | undefined;
            if (!teamStats?.length) return;

            const matchPlayerName = (m as any).playerName as string | undefined;
            const isWin = m.placement === 1;
            const matchKills = m.kills || 0;
            const matchAssists = m.assists || 0;
            const matchDeath = isWin ? 0 : 1;
            const matchDamage = m.damage || 0;
            const matchPlacement = getMatchPlacement(m);

            teamStats.forEach(tm => {
                if (isSelfTeammate(tm, matchPlayerName)) return;
                const key = resolveTeammateKey(map, tm);
                if (!key) return;

                const displayName = (tm.name || '').trim() || t('statistics.teammates.unknownTeammate');
                const legend = (tm.legend || 'unknown').toLowerCase();
                const uid = normalizeTeammateUid(tm.uid);

                if (!map[key]) {
                    map[key] = {
                        uid,
                        name: displayName,
                        legend,
                        games: 0,
                        wins: 0,
                        kills: 0,
                        assists: 0,
                        deaths: 0,
                        damage: 0,
                        placement: 0,
                        legendCounts: {},
                    };
                }

                const entry = map[key];
                if (displayName !== t('statistics.teammates.unknownTeammate')) {
                    if (!entry.name || entry.name === t('statistics.teammates.unknownTeammate')) entry.name = displayName;
                    else if (displayName.includes('[') && !entry.name.includes('[')) entry.name = displayName;
                }
                if (uid) entry.uid = uid;
                entry.legendCounts[legend] = (entry.legendCounts[legend] || 0) + 1;
                entry.games++;
                entry.kills += matchKills;
                entry.assists += matchAssists;
                entry.deaths += matchDeath;
                entry.damage += matchDamage;
                entry.placement += matchPlacement;
                if (isWin) entry.wins++;
            });
        });

        return Object.entries(map).map(([key, v]) => {
            const sortedLegends = Object.entries(v.legendCounts).sort((a, b) => b[1] - a[1]);
            const topLegend = sortedLegends[0]?.[0] || v.legend;
            const topLegends = sortedLegends.slice(0, 3).map(([legend]) => legend);
            const kd = v.deaths === 0 ? v.kills.toFixed(2) : (v.kills / v.deaths).toFixed(2);
            const kda = v.deaths === 0 ? (v.kills + v.assists).toFixed(2) : ((v.kills + v.assists) / v.deaths).toFixed(2);
            return {
                id: v.uid ? `uid:${v.uid}` : key,
                uid: v.uid,
                name: v.name,
                sortName: getTeammateSortKey(v.name),
                legend: topLegend,
                topLegends,
                games: v.games,
                winRate: ((v.wins / v.games) * 100).toFixed(1),
                avgPlacement: formatAvgPlacement(v.placement, v.games),
                avgDamage: Math.round(v.damage / v.games),
                kd: parseFloat(kd),
                kda: parseFloat(kda),
            };
        }).sort((a, b) => {
            if (b.games !== a.games) return b.games - a.games;
            const winDiff = parseFloat(b.winRate) - parseFloat(a.winRate);
            if (winDiff !== 0) return winDiff;
            if (b.kd !== a.kd) return b.kd - a.kd;
            return b.avgDamage - a.avgDamage;
        })
            .filter(tm => {
                if (profileUid && tm.uid && String(tm.uid) === String(profileUid)) return false;
                if (profileName && isSamePlayer(tm.name, profileName)) return false;
                return true;
            });
    }, [data, profileUid, profileName, t]);

    const sortedTeammateStats = useMemo(
        () => applyTableSort(teammateStats, teammateSort, {
            name: (a, b) => a.sortName.localeCompare(b.sortName, 'en', { sensitivity: 'base', numeric: true }),
            games: (a, b) => compareNumbers(a.games, b.games),
            winRate: (a, b) => compareNumericStrings(a.winRate, b.winRate),
            kd: (a, b) => compareNumbers(a.kd, b.kd),
            kda: (a, b) => compareNumbers(a.kda, b.kda),
            avgPlacement: (a, b) => compareAvgPlacement(a.avgPlacement, b.avgPlacement),
            avgDamage: (a, b) => compareNumbers(a.avgDamage, b.avgDamage),
        }),
        [teammateStats, teammateSort],
    );

    const top3 = teammateStats.slice(0, 3);
    const overallBaseline = useMemo(() => computePlayerPerformanceBaseline(data), [data]);
    const deltaTooltip = t('statistics.teammates.deltaVsAverage');

    const renderAvatar = (legend: string, size: number) => (
        <img
            src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${legend}.png`}
            alt={legend}
            style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%' }}
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span style="font-size:30px">👤</span>';
            }}
        />
    );

    const statLabelStyle: React.CSSProperties = {
        color: 'var(--color-text-muted)',
        fontSize: '9px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: 1.2,
    };

    const renderStatLabel = (label: string, title?: string) => (
        <div style={statLabelStyle} title={title ?? label}>{label}</div>
    );

    const renderStatCell = (
        label: string,
        value: React.ReactNode,
        options?: {
            valueStyle?: React.CSSProperties;
            labelTitle?: string;
            delta?: number;
            deltaDigits?: number;
            deltaSuffix?: string;
            higherIsBetter?: boolean;
            showDelta?: boolean;
        },
    ) => {
        const {
            valueStyle,
            labelTitle,
            delta,
            deltaDigits = 1,
            deltaSuffix = '',
            higherIsBetter = true,
            showDelta = false,
        } = options ?? {};

        return (
            <div style={{ textAlign: 'center', minWidth: 0 }}>
                {renderStatLabel(label, labelTitle)}
                <div style={{ fontWeight: 'bold', ...valueStyle }}>{value}</div>
                {showDelta && overallBaseline && delta != null && Number.isFinite(delta) && (
                    <div
                        title={deltaTooltip}
                        style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            color: getPerformanceDeltaColor(delta, higherIsBetter),
                            marginTop: '2px',
                            lineHeight: 1.2,
                        }}
                    >
                        {formatSignedDelta(delta, deltaDigits, deltaSuffix)}
                    </div>
                )}
            </div>
        );
    };

    const renderLegendPodium = (legends: string[]) => {
        if (!legends.length) return null;

        const podiumSlots = legends.length >= 3
            ? [
                { legend: legends[1], avatarSize: 42, stepHeight: 14, medal: 2 },
                { legend: legends[0], avatarSize: 56, stepHeight: 24, medal: 1 },
                { legend: legends[2], avatarSize: 36, stepHeight: 10, medal: 3 },
            ]
            : legends.length === 2
                ? [
                    { legend: legends[1], avatarSize: 42, stepHeight: 14, medal: 2 },
                    { legend: legends[0], avatarSize: 56, stepHeight: 24, medal: 1 },
                ]
                : [{ legend: legends[0], avatarSize: 56, stepHeight: 24, medal: 1 }];

        const stepColors: Record<number, string> = {
            1: 'rgba(230, 126, 34, 0.55)',
            2: 'rgba(192, 192, 192, 0.45)',
            3: 'rgba(205, 127, 50, 0.45)',
        };

        return (
            <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: legends.length === 1 ? 0 : 8,
                height: '88px',
                width: '100%',
                padding: '0 6px',
            }}>
                {podiumSlots.map(({ legend, avatarSize, stepHeight, medal }) => (
                    <div key={legend} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: legends.length === 1 ? undefined : 1, minWidth: 0, maxWidth: 76 }}>
                        <div style={{
                            width: avatarSize,
                            height: avatarSize,
                            marginBottom: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: '50%',
                            border: medal === 1 ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
                            overflow: 'hidden',
                            flexShrink: 0,
                        }}>
                            {renderAvatar(legend, avatarSize - 6)}
                        </div>
                        <div style={{
                            width: '100%',
                            height: stepHeight,
                            borderRadius: '4px 4px 0 0',
                            background: stepColors[medal],
                            boxShadow: medal === 1 ? '0 0 8px rgba(230, 126, 34, 0.25)' : 'none',
                        }} />
                    </div>
                ))}
            </div>
        );
    };

    const renderTableStatWithComparison = (
        value: React.ReactNode,
        options: {
            padding?: string;
            valueStyle?: React.CSSProperties;
            showDelta: boolean;
            delta?: number;
            deltaDigits: number;
            higherIsBetter?: boolean;
            deltaSuffix?: string;
            borderLeft?: boolean;
        },
    ) => {
        const {
            padding = '12px 20px',
            valueStyle,
            showDelta,
            delta,
            deltaDigits,
            higherIsBetter = true,
            deltaSuffix = '',
            borderLeft = false,
        } = options;

        const badge = showDelta && overallBaseline && delta != null && Number.isFinite(delta)
            ? formatVsAverageBadge(delta, deltaDigits, higherIsBetter, deltaSuffix)
            : null;

        return (
            <td style={{
                padding,
                textAlign: 'center',
                borderLeft: borderLeft ? '2px solid var(--color-border)' : undefined,
            }}>
                <div style={{ fontWeight: 'bold', ...valueStyle }}>{value}</div>
                {badge && (
                    <div
                        title={deltaTooltip}
                        style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            marginTop: '2px',
                            lineHeight: 1.2,
                            color: badge.color,
                        }}
                    >
                        {badge.label}
                    </div>
                )}
            </td>
        );
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s' }}>
            <style>{MARQUEE_OVERFLOW_KEYFRAMES}</style>
            <div style={{ marginBottom: '20px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {t('statistics.teammates.statsDisclaimer')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px', marginBottom: '30px', alignItems: 'stretch' }}>
                {top3.map((tm, i) => {
                    const showDelta = tm.games >= MIN_GAMES_FOR_TEAMMATE_DELTA;
                    const tmWinRate = parseFloat(tm.winRate);

                    return (
                    <div key={tm.id} style={{
                        background: i === 0 ? `linear-gradient(135deg, var(--color-warning-hover) 0%, var(--color-bg-card) 100%)` : 'var(--color-bg-card)',
                        borderRadius: '12px', border: `1px solid ${i === 0 ? 'var(--color-warning)' : 'var(--color-border)'}`,
                        padding: '20px', position: 'relative', minWidth: 0, overflow: 'hidden',
                        boxShadow: i === 0 ? '0 0 15px rgba(230, 126, 34, 0.3)' : 'none'
                    }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '5px', lineHeight: 1.35, wordBreak: 'keep-all', minHeight: '32px' }}>
                            {i === 0 ? t('statistics.teammates.mostPlayed') : t('statistics.teammates.pick', { rank: i + 1 })}
                        </div>
                        <div style={{ height: '24px', marginBottom: '4px', minWidth: 0 }}>
                            <MarqueeOverflowText
                                text={tm.name}
                                textStyle={{
                                    fontSize: '18px',
                                    fontWeight: 900,
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        </div>
                        {tm.uid && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginBottom: '8px', fontFamily: 'monospace' }} title={tm.uid}>
                                {tm.uid.length > 16 ? `${tm.uid.slice(0, 16)}…` : tm.uid}
                            </div>
                        )}
                        <div style={{ fontSize: '10px', color: 'var(--color-text-primary)', textAlign: 'center', marginBottom: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {t('statistics.teammates.teammatePicks')}
                        </div>
                        <div style={{ height: '88px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                            {renderLegendPodium(tm.topLegends)}
                        </div>
                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '10px' }}>
                                {t('statistics.teammates.myStatsWhenTogether')}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '4px', fontSize: '12px' }}>
                            {renderStatCell(t('statistics.teammates.matches'), tm.games)}
                            {renderStatCell(t('statistics.teammates.kd'), tm.kd, {
                                valueStyle: { color: 'var(--color-warning)' },
                                showDelta,
                                delta: overallBaseline ? tm.kd - overallBaseline.kd : undefined,
                                deltaDigits: 2,
                            })}
                            {renderStatCell(t('statistics.teammates.kad'), tm.kda, {
                                valueStyle: { color: '#54a0ff' },
                                showDelta,
                                delta: overallBaseline ? tm.kda - overallBaseline.kda : undefined,
                                deltaDigits: 2,
                            })}
                            {renderStatCell(t('statistics.teammates.winPercent'), `${tm.winRate}%`, {
                                valueStyle: { color: 'var(--color-text-primary)' },
                                showDelta,
                                delta: overallBaseline ? tmWinRate - overallBaseline.winRate : undefined,
                                deltaDigits: 1,
                                deltaSuffix: '%p',
                            })}
                            {renderStatCell(t('statistics.teammates.avgDamageShort'), tm.avgDamage, {
                                valueStyle: { color: '#e056fd' },
                                labelTitle: t('statistics.teammates.avgDamage'),
                                showDelta,
                                delta: overallBaseline ? tm.avgDamage - overallBaseline.avgDamage : undefined,
                                deltaDigits: 0,
                            })}
                            </div>
                        </div>
                    </div>
                    );
                })}
                {top3.length === 0 && <div style={{ gridColumn: 'span 3' }}><EmptyState msg={t('statistics.teammates.noTeammateData')} /></div>}
            </div>

            <div style={{ background: 'var(--color-bg-sub-header)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-table-header)' }}>
                    <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '14px' }}>{t('statistics.teammates.detailedStatsTitle')}</h4>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginTop: '4px' }}>{t('statistics.teammates.teammatePicksHint')}</div>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg-table-header)', zIndex: 1 }}>
                            <tr style={{ color: 'var(--color-text-primary)', fontSize: '10px', borderBottom: '1px solid var(--color-border)' }}>
                                <th
                                    colSpan={2}
                                    style={{
                                        padding: '8px 20px',
                                        fontWeight: 'bold',
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        textAlign: 'center',
                                    }}
                                >
                                    {t('statistics.teammates.teammateColumnGroup')}
                                </th>
                                <th
                                    colSpan={6}
                                    style={{
                                        padding: '8px 20px',
                                        fontWeight: 'bold',
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        textAlign: 'center',
                                        borderLeft: '2px solid var(--color-border)',
                                        background: 'rgba(255,255,255,0.02)',
                                    }}
                                >
                                    {t('statistics.teammates.myStatsColumnGroup')}
                                </th>
                            </tr>
                            <tr style={{ color: 'var(--color-text-muted)', fontSize: '11px', borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ ...mainTableHeadCellStyle, width: '50px' }}>{t('statistics.teammates.rank')}</th>
                                <SortableTh column="name" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleTableSort(prev, col))} style={mainTableHeadCellStyle}>
                                    {t('statistics.teammates.teammate')}
                                </SortableTh>
                                <SortableTh column="games" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center', borderLeft: '2px solid var(--color-border)' }}>
                                    {t('statistics.teammates.matches')}
                                </SortableTh>
                                <SortableTh column="winRate" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.teammates.winRate')}
                                </SortableTh>
                                <SortableTh column="kd" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.teammates.kd')}
                                </SortableTh>
                                <SortableTh column="kda" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.teammates.kad')}
                                    <span
                                        title={t('statistics.teammates.kadTooltip')}
                                        style={{ cursor: 'help', marginLeft: '4px', display: 'inline-block', verticalAlign: 'middle' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <FaInfoCircle size={12} color="var(--color-text-muted)" />
                                    </span>
                                </SortableTh>
                                <SortableTh column="avgPlacement" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }} title={t('statistics.common.avgPlacement')}>
                                    {t('statistics.common.avgPlacementShort')}
                                </SortableTh>
                                <SortableTh column="avgDamage" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center', whiteSpace: 'nowrap' }} title={t('statistics.teammates.avgDamage')}>
                                    {t('statistics.teammates.avgDamageShort')}
                                </SortableTh>
                            </tr>
                        </thead>
                        <tbody>
                            {overallBaseline && (
                                <tr style={{ background: 'rgba(84, 160, 255, 0.06)', borderBottom: '2px solid var(--color-border)' }}>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>—</td>
                                    <td style={{ padding: '12px 20px', fontWeight: 'bold', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                                        {t('statistics.teammates.overallBaselineRowLabel')}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', color: 'var(--color-text-dim)', fontWeight: 'bold', borderLeft: '2px solid var(--color-border)' }}>
                                        {overallBaseline.games}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>
                                        {overallBaseline.winRate.toFixed(1)}%
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: 'var(--color-warning)' }}>
                                        {overallBaseline.kd.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#54a0ff' }}>
                                        {overallBaseline.kda.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: getAvgPlacementColor(overallBaseline.avgPlacement) }}>
                                        #{overallBaseline.avgPlacement.toFixed(1)}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#e056fd' }}>
                                        {overallBaseline.avgDamage}
                                    </td>
                                </tr>
                            )}
                            {sortedTeammateStats.map((tm, i) => {
                                const showDelta = tm.games >= MIN_GAMES_FOR_TEAMMATE_DELTA;
                                const tmWinRate = parseFloat(tm.winRate);
                                const tmKd = parseFloat(String(tm.kd));
                                const tmKda = parseFloat(String(tm.kda));
                                const tmAvgPlacement = parseFloat(tm.avgPlacement);

                                return (
                                <tr key={tm.id} style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-card-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '12px 20px', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>#{i + 1}</td>
                                    <td style={{ padding: '12px 20px', maxWidth: '200px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                            <div style={{ width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', overflow: 'hidden' }}>
                                                {renderAvatar(tm.legend, 32)}
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ height: '18px' }}>
                                                    <MarqueeOverflowText
                                                        text={tm.name}
                                                        textStyle={{ fontWeight: 'bold', color: 'var(--color-text-dim)' }}
                                                    />
                                                </div>
                                                {tm.uid && (
                                                    <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', fontWeight: 'normal', fontFamily: 'monospace' }}>
                                                        {tm.uid.length > 20 ? `${tm.uid.slice(0, 20)}…` : tm.uid}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    {renderTableStatWithComparison(tm.games, {
                                        showDelta: false,
                                        deltaDigits: 0,
                                        borderLeft: true,
                                        valueStyle: { color: 'var(--color-text-dim)' },
                                    })}
                                    {renderTableStatWithComparison(`${tm.winRate}%`, {
                                        showDelta,
                                        delta: overallBaseline ? tmWinRate - overallBaseline.winRate : undefined,
                                        deltaDigits: 1,
                                        valueStyle: { color: tmWinRate >= 10 ? '#4ade80' : 'var(--color-text-muted)' },
                                    })}
                                    {renderTableStatWithComparison(tm.kd, {
                                        showDelta,
                                        delta: overallBaseline ? tmKd - overallBaseline.kd : undefined,
                                        deltaDigits: 2,
                                        valueStyle: { color: 'var(--color-warning)' },
                                    })}
                                    {renderTableStatWithComparison(tm.kda, {
                                        showDelta,
                                        delta: overallBaseline ? tmKda - overallBaseline.kda : undefined,
                                        deltaDigits: 2,
                                        valueStyle: { color: '#54a0ff' },
                                    })}
                                    {renderTableStatWithComparison(`#${tm.avgPlacement}`, {
                                        showDelta,
                                        delta: overallBaseline ? tmAvgPlacement - overallBaseline.avgPlacement : undefined,
                                        deltaDigits: 1,
                                        higherIsBetter: false,
                                        valueStyle: { color: getAvgPlacementColor(tm.avgPlacement) },
                                    })}
                                    {renderTableStatWithComparison(tm.avgDamage, {
                                        showDelta,
                                        delta: overallBaseline ? tm.avgDamage - overallBaseline.avgDamage : undefined,
                                        deltaDigits: 0,
                                        valueStyle: { color: '#e056fd' },
                                    })}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {teammateStats.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px' }}>{t('statistics.teammates.noTeammateData')}</div>}
                </div>
            </div>
        </div>
    );
};

interface StatisticsTabProps {
    isPremium: boolean;
    selectedSeasonId: number;
    seasons: Season[];
    profileUid?: string | null;
    profileName?: string | null;
    statsRefreshToken?: number;
}

const StatisticsTab: React.FC<StatisticsTabProps> = ({
    isPremium,
    selectedSeasonId,
    seasons,
    profileUid,
    profileName,
    statsRefreshToken = 0,
}) => {
    const { t } = useTranslation();
    const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'MAPS' | 'LEGENDS' | 'WEAPONS' | 'TEAMMATES'>('OVERVIEW');
    const [selectedMode, setSelectedMode] = useState<StatisticsMode>('ALL');
    const [serverMatches, setServerMatches] = useState<MatchHistory[]>([]);
    const [serverMatchCount, setServerMatchCount] = useState(0);
    const [serverStatsLoading, setServerStatsLoading] = useState(false);

    // ✅ 객체 맵으로 정리
    const TAB_LABELS: Record<string, string> = {
        OVERVIEW: t('statistics.tabs.overview'),
        MAPS: t('statistics.tabs.maps'),
        LEGENDS: t('statistics.tabs.legends'),
        WEAPONS: t('statistics.tabs.weapons'),
        TEAMMATES: t('statistics.tabs.teammates'),
    };

    const MODE_LABELS: Record<string, string> = {
        ALL: t('statistics.modes.all'),
        RANKED: t('statistics.modes.ranked'),
        TRIO: t('statistics.modes.trio'),
        DUO: t('statistics.modes.duo'),
    };

    useEffect(() => {
        if (!profileUid) {
            setServerMatches([]);
            setServerMatchCount(0);
            return;
        }

        let cancelled = false;
        setServerStatsLoading(true);
        fetchPlayerStats(profileUid, selectedSeasonId, selectedMode)
            .then((response) => {
                if (cancelled) return;
                if (!response) {
                    setServerMatchCount(0);
                    setServerMatches([]);
                    return;
                }
                setServerMatchCount(response.match_count ?? 0);
                setServerMatches(normalizeHistoryForFrontend(response.payload?.matches ?? []) as MatchHistory[]);
            })
            .finally(() => {
                if (!cancelled) setServerStatsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [profileUid, selectedSeasonId, selectedMode, statsRefreshToken]);

    const statsHistory = useMemo(
        () => serverMatches.filter(m => isKnownLegend(m.legend)),
        [serverMatches],
    );

    const renderContent = () => {
        if (serverStatsLoading) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--color-text-muted)', gap: '12px' }}>
                    <FaSync className="spin-animation" size={22} />
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{t('statistics.loadingServerStats', { defaultValue: 'Loading season statistics…' })}</span>
                </div>
            );
        }

        if (statsHistory.length === 0) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--color-text-faint)', gap: '8px', border: '2px dashed var(--color-border)', borderRadius: '10px' }}>
                    <FaInfoCircle size={18} />
                    <span style={{ fontSize: '13px' }}>{t('statistics.noServerStats', { defaultValue: 'No ranked statistics for this season yet.' })}</span>
                </div>
            );
        }

        const isContentLocked = !isPremium && activeSubTab !== 'OVERVIEW';

        const lockTitles: Record<string, string> = {
            MAPS: t('statistics.tabs.maps'),
            LEGENDS: t('statistics.tabs.legends'),
            WEAPONS: t('statistics.tabs.weapons'),
            TEAMMATES: t('statistics.tabs.teammates'),
        };

        let content: React.ReactNode;
        switch (activeSubTab) {
            case 'OVERVIEW': content = (
                <OverviewView
                    data={statsHistory}
                    showRankProgress={selectedMode === 'ALL' || selectedMode === 'RANKED'}
                    profileUid={profileUid}
                    selectedSeasonId={selectedSeasonId}
                    seasons={seasons}
                />
            ); break;
            case 'MAPS': content = <MapsView data={statsHistory} profileUid={profileUid} profileName={profileName} />; break;
            case 'LEGENDS': content = <LegendsView data={statsHistory} profileUid={profileUid} profileName={profileName} />; break;
            case 'WEAPONS': content = <WeaponsView data={statsHistory} />; break;
            case 'TEAMMATES': content = <TeammatesView data={statsHistory} profileUid={profileUid} profileName={profileName} />; break;
            default: content = null;
        }

        return (
            <PremiumBlurGate locked={isContentLocked} title={lockTitles[activeSubTab] ?? ''}>
                {content}
            </PremiumBlurGate>
        );
    };

    return (
        <div style={{ paddingBottom: '40px', color: 'var(--color-text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '2px solid var(--color-border)', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                    {(['OVERVIEW', 'MAPS', 'LEGENDS', 'WEAPONS', 'TEAMMATES'] as const).map(tab => {
                        const isActive = activeSubTab === tab;
                        const isLocked = !isPremium && tab !== 'OVERVIEW';
                        return (
                            <button
                                key={tab}
                                className="btn-tab"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setActiveSubTab(tab)}
                                style={{
                                    padding: '8px 16px',
                                    background: isActive ? 'var(--color-accent)' : 'transparent',
                                    color: isActive ? 'var(--color-text-primary)' : (isLocked ? 'var(--color-text-subtle)' : 'var(--color-text-muted)'),
                                    border: 'none', borderRadius: '4px',
                                    fontWeight: 'bold', cursor: 'pointer', transition: '0.2s',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    outline: 'none', boxShadow: 'none',
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
                        {(['ALL', 'RANKED', 'TRIO', 'DUO'] as const).map(mode => (
                            <button
                                key={mode}
                                className="btn-tab"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setSelectedMode(mode)}
                                style={{
                                    padding: '6px 12px', fontSize: '11px', fontWeight: 'bold',
                                    border: 'none', borderRadius: '4px', cursor: 'pointer',
                                    background: selectedMode === mode ? 'var(--color-bg-card-hover)' : 'transparent',
                                    color: selectedMode === mode ? 'var(--color-text-primary)' : 'var(--color-text-faint)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    outline: 'none', boxShadow: 'none',
                                }}
                            >
                                {MODE_LABELS[mode]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px', color: 'var(--color-text-faint)', fontSize: '11px', fontStyle: 'italic', gap: '5px', alignItems: 'center' }}>
                <FaHistory /> {t('statistics.showingStatsFor')} <span style={{ color: COLORS.NEON_ORANGE, fontWeight: 'bold' }}>{seasons.find(s => s.id === selectedSeasonId)?.name}</span> ({selectedMode === 'ALL' ? t('statistics.allBrModes') : selectedMode})
                {serverStatsLoading && <FaSync className="spin-animation" size={10} />}
                {!serverStatsLoading && serverMatchCount > 0 && (
                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'normal' }}>
                        · {serverMatchCount.toLocaleString()} {t('statistics.serverMatchCount', { defaultValue: 'matches' })}
                    </span>
                )}
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
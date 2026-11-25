import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    CartesianGrid, Tooltip, Cell,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Line, Bar, BarChart, LineChart, XAxis, YAxis, ReferenceLine
} from 'recharts';
import ChartContainer from './ChartContainer';
import { FaHistory, FaInfoCircle, FaSync, FaChevronDown } from 'react-icons/fa';
import { COLORS, TARGET_MAPS, MAP_THUMBNAILS, LEGENDS_LIST } from '../utils/gameData';
import { useLocalImage } from '../utils/imageSource';
import { useTranslation } from 'react-i18next';
import { hasUsableMatchStats, type MatchHistory, type Season } from '../utils/match';
import { useAccountStats, parseSeasonNumber } from '../hooks/useAccountStats';
import { normalizeHistoryForFrontend } from '../utils/matchNormalizer';
import { fetchPlayerStats, type StatisticsMode } from '../utils/playerStatsApi';
import { filterDemoMatchesByMode } from '../utils/demoMode';
import { getSelectableSeasons, resolveSeasonEndMs } from '../utils/seasons';
import type { Match } from '../types';
import { isSamePlayer, isKnownLegend, normalizeLegendKey, getTeammateSortKey, getAvgPlacementColor, getWinRateColor, getKdColor, getKadColor, getAvgDamageColor, getAvgKnocksColor, getWinRateChipStyle, getMatchDeaths, normalizeMapDisplayName } from '../utils/helpers';
import {
    formatDuration,
    formatLegendDisplayName,
    getMatchPlacement,
    formatAvgPlacement,
    resolveMapName,
    aggregateLegendStatsForMatches,
    aggregateWeaponStatsForMatches,
    aggregateThreatWeaponStatsForMatches,
    aggregatePairedWeaponsForWeapon,
    aggregateLegendsForWeapon,
    aggregateMapStatsForMatches,
    calculateStats,
} from '../utils/statsAggregation';
import { buildWeaponItems } from '../utils/tierTableData';
import { getSessionCatalogId, setSessionCatalogId } from '../utils/statsCatalogSelection';
import { getWeaponDisplayName, findWeaponByLoadoutId, getWeaponAmmoSilhouetteStyle, getWeaponImageUrl, getWeaponSilhouetteUrl, getWeaponSilhouetteScale, getWeaponTagTheme, WHITE_SILHOUETTE_FILTER } from '../utils/weaponTheme';
import {
    type TeammateMatchStat,
    MIN_GAMES_FOR_TEAMMATE_DELTA,
    normalizeTeammateUid,
    resolveTeammateKey,
    aggregateTeammateLegendPicksForMatches,
    computePlayerPerformanceBaseline,
    formatSignedDelta,
    getPerformanceDeltaColor,
    formatVsAverageBadge,
} from '../utils/teammateStats';
import {
    type TableSortState,
    createDefaultTableSort,
    toggleCatalogNameTableSort,
    applyTableSort,
    compareStrings,
    compareNumbers,
    compareNumericStrings,
    compareAvgPlacement,
} from '../utils/tableSort';
import {
    type MatchWithMeta,
    getMatchSurvivalSec,
    computeOverviewAnalytics,
} from '../utils/statsScoring';
import { WEAPONS_DB, type WeaponCategory } from '../utils/WeaponsData';
import RankProgressChart from './RankProgressChart';
import PremiumBlurGate, { type PremiumTeaser } from './PremiumBlurGate';

const AvgPlacementCell = ({ value, padding = '10px 12px' }: { value: string; padding?: string }) => (
    <td style={{ padding, textAlign: 'center', fontWeight: 'bold', color: value === '-' ? 'var(--color-text-faint)' : getAvgPlacementColor(value) }}>
        {value === '-' ? '-' : `#${value}`}
    </td>
);

const formatWeaponWinRate = (winRate: string, hasWinRate?: boolean) => {
    if (hasWinRate === false || winRate === '-') return '-';
    return `${winRate}%`;
};

const formatKdNumber = (value: number) => value.toFixed(2);

const formatWeaponKd = (
    value: number | null | undefined,
    hasKd: boolean | undefined,
    naLabel: string,
) => {
    if (hasKd === false || value == null) {
        // Fallback if locale pack/cache is missing the key (i18n returns the key path).
        return naLabel.includes('.') ? 'N/A' : naLabel;
    }
    return formatKdNumber(value);
};

const MAP_IMAGE_BASE = '/images/';

/** Quoted CSS url(). Unquoted url() drops the declaration when the path has a space ("mad maggie"). */
const toCssUrl = (url: string) => `url("${encodeURI(url)}")`;

const getMapThumbnailUrl = (mapName: string) =>
    `${MAP_IMAGE_BASE}${MAP_THUMBNAILS[mapName] || 'thumbnail-kings_canyon.png'}`;

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

/** Chart/accent blue shared by sort headers, map share labels and the placement trend line. */
const STATS_INFO_BLUE = '#54a0ff';
/** Theme-safe subtle tile fill (works on dark and light backgrounds). */
const STATS_SUBTLE_TILE_BG = 'color-mix(in srgb, var(--color-text-primary) 4%, transparent)';

const SORT_HEADER_COLOR_DESC = 'var(--color-accent-hover)';
const SORT_HEADER_COLOR_ASC = STATS_INFO_BLUE;

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

/** Shared column widths for paired-weapon / weapon-legend detail tables (same x positions). */
const catalogPairTableStyle: React.CSSProperties = {
    ...mapBreakdownTableStyle,
    tableLayout: 'fixed',
};

const CatalogPairColgroup = () => (
    <colgroup>
        <col style={{ width: '36px' }} />
        <col />
        <col style={{ width: '68px' }} />
        <col style={{ width: '72px' }} />
        <col style={{ width: '64px' }} />
        <col style={{ width: '56px' }} />
        <col style={{ width: '56px' }} />
    </colgroup>
);

const catalogPairMediaSlotStyle: React.CSSProperties = {
    width: '44px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: STATS_SUBTLE_TILE_BG,
    borderRadius: '6px',
    flexShrink: 0,
    overflow: 'hidden',
};

/** Ammo-tinted weapon silhouette for breakdown / pair tables. */
const WeaponTableIcon = ({
    weaponId,
    name,
    width = 40,
    height = 20,
}: {
    weaponId: string;
    name: string;
    width?: number;
    height?: number;
}) => {
    const src = useLocalImage(getWeaponSilhouetteUrl(weaponId));
    const style = getWeaponAmmoSilhouetteStyle(weaponId, { width, height });
    return (
        <span
            role="img"
            aria-label={name}
            title={name}
            style={{ ...style, WebkitMaskImage: `url("${src}")`, maskImage: `url("${src}")` }}
        />
    );
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

/* ── Shared building blocks: every sub-tab composes these so spacing, type and states match. ── */

const STATS_VIEW_ANIMATION = 'fadeIn 0.3s';
const BREAKDOWN_TABLE_MAX_HEIGHT = 360;
const CATALOG_HERO_SCRIM = 'linear-gradient(135deg, rgba(0,0,0,0.82), rgba(0,0,0,0.55))';

/** Rendered once at the Statistics root: row hover, clickable-card hover and keyboard focus rings. */
const STATS_SHARED_CSS = `
    .stats-root button:focus-visible,
    .stats-root [role="button"]:focus-visible {
        outline: 2px solid var(--color-accent) !important;
        outline-offset: 2px;
    }
    .stats-root .stats-table-row { transition: background 0.15s; }
    .stats-root .stats-table-row:hover { background: var(--color-bg-card-hover); }
    .stats-root .stats-rank-card.is-clickable { transition: transform 0.15s, background 0.15s; }
    .stats-root .stats-rank-card.is-clickable:hover {
        background: var(--color-bg-card-hover) !important;
        transform: translateY(-1px);
    }
    .stats-root .stats-map-chip { transition: border-color 0.15s, box-shadow 0.15s; }
    .stats-root .stats-map-chip:hover { border-color: var(--color-text-muted) !important; }
`;

/** Cross-tab jumps from rank cards (e.g. a legend card on Maps opens that legend on Legends). */
type StatsNavigation = {
    openLegend: (legendId: string) => void;
    openWeapon: (weaponId: string) => void;
};
const StatsNavContext = React.createContext<StatsNavigation | null>(null);
const useStatsNav = () => React.useContext(StatsNavContext);

const PanelEmpty = ({ msg }: { msg: string }) => (
    <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '12px', lineHeight: 1.5 }}>
        {msg}
    </div>
);

/** Card shell for the Overview / Map / Legend / Weapon hero panels. */
const StatsCard = ({ children }: { children: React.ReactNode }) => (
    <div style={{
        background: 'var(--color-bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        marginBottom: '24px',
    }}>
        {children}
    </div>
);

/** Image-backed header used by every catalog tab. `renderTrigger` wraps the content in a picker. */
const CatalogHero = ({
    eyebrow,
    title,
    subtitle,
    imageUrl,
    background,
    media,
    titleTransform,
    renderTrigger,
}: {
    eyebrow: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    imageUrl?: string;
    /** Full CSS `background` override (e.g. weapon accent gradient) instead of an image. */
    background?: string;
    media?: React.ReactNode;
    titleTransform?: React.CSSProperties['textTransform'];
    renderTrigger?: (content: React.ReactNode) => React.ReactNode;
}) => {
    const text = (
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {eyebrow}
            </div>
            <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '22px', fontWeight: 900, textTransform: titleTransform }}>
                {title}
            </h3>
            {subtitle ? (
                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-dim)' }}>{subtitle}</div>
            ) : null}
        </div>
    );
    const content = media ? <>{media}{text}</> : text;
    return (
        <div style={{ position: 'relative', padding: '22px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                borderRadius: '12px 12px 0 0',
                background: background ?? (imageUrl ? `${CATALOG_HERO_SCRIM}, url(${imageUrl}) center / cover no-repeat` : CATALOG_HERO_SCRIM),
                opacity: 0.55,
            }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {renderTrigger ? renderTrigger(content) : content}
            </div>
        </div>
    );
};

/** 72px portrait / weapon tile shown in the hero picker trigger. */
const CatalogHeroMedia = ({ kind, src, alt }: { kind: 'legend' | 'weapon'; src: string | null; alt: string }) => (
    <div style={{
        width: '72px',
        height: '72px',
        borderRadius: kind === 'legend' ? '50%' : '12px',
        overflow: 'hidden',
        border: src ? '3px solid var(--color-accent)' : '2px dashed rgba(255,255,255,0.35)',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    }}>
        {src ? (
            <img
                src={src}
                alt={alt}
                style={kind === 'legend'
                    ? { width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.15)' }
                    : { maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
                onError={(e) => {
                    if (kind === 'legend') e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`;
                    else e.currentTarget.style.display = 'none';
                }}
            />
        ) : (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>?</span>
        )}
    </div>
);

/** Two equal columns that collapse to one when the Statistics pane is narrow. */
const StatsTwoColumnGrid = ({ children, padding, marginTop, marginBottom, alignItems = 'stretch' }: {
    children: React.ReactNode;
    padding?: string;
    marginTop?: string;
    marginBottom?: string;
    alignItems?: React.CSSProperties['alignItems'];
}) => {
    const compact = useStatsCompact();
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
            gap: '20px',
            padding,
            marginTop,
            marginBottom,
            alignItems,
        }}>
            {children}
        </div>
    );
};

/** Titled, scrollable table/list panel used for every breakdown on Maps / Legends / Weapons / Teammates. */
const BreakdownPanel = ({
    title,
    subtitle,
    emptyMsg,
    isEmpty,
    bodyPadding,
    children,
}: {
    title: string;
    subtitle?: React.ReactNode;
    emptyMsg: string;
    isEmpty: boolean;
    bodyPadding?: string;
    children: React.ReactNode;
}) => (
    <div style={legendBreakdownPanelStyle}>
        <div style={mapBreakdownPanelHeaderStyle}>
            <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: '18px' }}>{title}</h4>
            {subtitle ? (
                <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginTop: '2px', lineHeight: '15px' }}>{subtitle}</div>
            ) : null}
        </div>
        {isEmpty ? (
            <PanelEmpty msg={emptyMsg} />
        ) : (
            <div style={{ maxHeight: `${BREAKDOWN_TABLE_MAX_HEIGHT}px`, overflowY: 'auto', padding: bodyPadding }}>
                {children}
            </div>
        )}
    </div>
);

const pickMostPlayed = <T extends { games: number }>(rows: readonly T[]): T | undefined =>
    rows.reduce<T | undefined>((best, row) => (!best || row.games > best.games ? row : best), undefined);

const LegendWeaponMapBreakdown = ({ matches, legendName }: { matches: MatchHistory[]; legendName: string }) => {
    const { t } = useTranslation();
    type WeaponSortCol = 'name' | 'usageGames' | 'winRate' | 'avgPlacement' | 'kd' | 'kda';
    const [weaponSort, setWeaponSort] = useState<TableSortState<WeaponSortCol>>(createDefaultTableSort);
    const weaponStats = useMemo(() => aggregateWeaponStatsForMatches(matches), [matches]);
    const sortedWeaponStats = useMemo(
        () => applyTableSort(weaponStats, weaponSort, {
            name: (a, b) => compareWeaponDbOrder(a.id, b.id),
            usageGames: (a, b) => compareNumbers(a.usageGames, b.usageGames),
            winRate: (a, b) => compareNumericStrings(a.winRate, b.winRate),
            avgPlacement: (a, b) => compareAvgPlacement(a.avgPlacement, b.avgPlacement),
            kd: (a, b) => compareNumbers(a.kd ?? -1, b.kd ?? -1),
            kda: (a, b) => compareNumbers(a.kda ?? -1, b.kda ?? -1),
        }, {
            isMissing: {
                winRate: (w) => !w.hasWinRate,
                avgPlacement: (w) => !w.hasWinRate,
                kd: (w) => !w.hasKd,
                kda: (w) => !w.hasKd,
            },
        }),
        [weaponStats, weaponSort],
    );
    const mapStats = useMemo(
        () => [...aggregateMapStatsForMatches(matches)].sort((a, b) => {
            if (b.games !== a.games) return b.games - a.games;
            return a.name.localeCompare(b.name);
        }),
        [matches],
    );

    const breakdownSubtitle = t('statistics.legends.breakdownSubtitle', { legend: legendName });

    return (
        <StatsTwoColumnGrid alignItems="start">
            <BreakdownPanel
                title={t('statistics.legends.topWeapons')}
                subtitle={breakdownSubtitle}
                isEmpty={weaponStats.length === 0}
                emptyMsg={t('statistics.legends.noWeaponRankData')}
            >
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
                            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>#</th>
                                    <SortableTh column="name" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'left' }}>
                                        {t('statistics.weapons.weapon')}
                                    </SortableTh>
                                    <SortableTh column="usageGames" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }} title={t('statistics.weapons.usageHint')}>
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
                                    <SortableTh column="kda" sortState={weaponSort} onSort={(col) => setWeaponSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.kad')}
                                    </SortableTh>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedWeaponStats.map((w, i) => (
                                    <tr key={w.id} className="stats-table-row" style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }}>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>{i + 1}</td>
                                        <td style={mapBreakdownLegendBodyCellStyle}>
                                            <div style={mapBreakdownLegendInnerStyle}>
                                                <div style={{ width: '40px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: STATS_SUBTLE_TILE_BG, borderRadius: '4px', flexShrink: 0 }}>
                                                    <WeaponTableIcon weaponId={w.id} name={w.name} width={34} height={16} />
                                                </div>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={w.name}>{w.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }} title={w.holdTime}>{w.usageLabel}</td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getWinRateColor(w.winRate, { hasValue: w.hasWinRate }) }}>{formatWeaponWinRate(w.winRate, w.hasWinRate)}</td>
                                        <AvgPlacementCell value={w.avgPlacement} padding="10px 12px" />
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getKdColor(w.hasKd ? w.kd : null) }}>{formatWeaponKd(w.kd, w.hasKd, t('statistics.common.na'))}</td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getKadColor(w.hasKd ? w.kda : null) }}>{formatWeaponKd(w.kda, w.hasKd, t('statistics.common.na'))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
            </BreakdownPanel>

            <BreakdownPanel
                title={t('statistics.legends.mapDistribution')}
                subtitle={breakdownSubtitle}
                isEmpty={mapStats.length === 0}
                emptyMsg={t('statistics.legends.noMapRankData')}
                bodyPadding="8px 12px 12px"
            >
                        {mapStats.map((m, i) => (
                            <LegendMapShare
                                key={m.name}
                                name={m.name}
                                share={m.share}
                                games={m.games}
                                winRate={m.winRate}
                                last={i === mapStats.length - 1}
                                index={i}
                            />
                        ))}
            </BreakdownPanel>
        </StatsTwoColumnGrid>
    );
};

function LegendMapShare({
    name,
    share,
    games,
    winRate,
    last,
    index,
}: {
    name: string;
    share: number | string;
    games: number | string;
    winRate: number | string;
    last: boolean;
    index: number;
}) {
    const { t } = useTranslation();
    const mapUrl = useLocalImage(getMapThumbnailUrl(name));
    const shareNum = Number(share) || 0;
    const winRateNum = Number(winRate) || 0;
    return (
        <div style={{ marginBottom: last ? 0 : 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ color: 'var(--color-text-faint)', fontSize: '11px', fontWeight: 'bold', width: '16px' }}>{index + 1}</span>
                    <span style={{ color: 'var(--color-text-dim)', fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', color: STATS_INFO_BLUE, whiteSpace: 'nowrap', fontWeight: '600' }}>
                        {t('statistics.legends.mapShareLabel', { count: Number(games) || 0, percent: shareNum.toFixed(1) })}
                    </div>
                    <div style={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        ...getWinRateChipStyle(winRateNum),
                    }}>
                        {t('statistics.legends.winRate')} {winRateNum}%
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
                    width: `${shareNum}%`,
                    minWidth: shareNum > 0 ? '4px' : 0,
                    backgroundImage: `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.35)), url(${mapUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                }} />
            </div>
        </div>
    );
}

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
            style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%', flexShrink: 0 }}
            onError={(e) => {
                e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`;
            }}
        />
    );

    const renderMapBreakdownLegendCell = (legendId: string, name: string) => (
        <td style={mapBreakdownLegendBodyCellStyle}>
            <div style={mapBreakdownLegendInnerStyle}>
                {renderLegendAvatar(legendId, 24)}
                <MarqueeLegendName name={name} />
            </div>
        </td>
    );

    if (legendStats.length === 0 && teammatePickStats.length === 0) return null;

    return (
        <>
            <style>{MARQUEE_OVERFLOW_KEYFRAMES}</style>
            <StatsTwoColumnGrid alignItems="start">
                <BreakdownPanel
                    title={t('statistics.maps.myLegendStats')}
                    subtitle={t('statistics.maps.myLegendStatsHint', { map: mapName })}
                    isEmpty={legendStats.length === 0}
                    emptyMsg={t('statistics.maps.noMyLegendData')}
                >
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
                                        <tr key={leg.id} className="stats-table-row" style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }}>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>{i + 1}</td>
                                            {renderMapBreakdownLegendCell(leg.id, leg.name)}
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-dim)' }}>{leg.games}</td>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getWinRateColor(leg.winRate) }}>{leg.winRate}%</td>
                                            <AvgPlacementCell value={leg.avgPlacement} padding="10px 12px" />
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getKdColor(leg.kd) }}>{formatKdNumber(leg.kd)}</td>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getAvgDamageColor(leg.avgDamage) }}>{leg.avgDamage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                </BreakdownPanel>

                <BreakdownPanel
                    title={t('statistics.maps.teammateLegendPicks')}
                    subtitle={t('statistics.maps.teammateLegendPicksHint', { map: mapName })}
                    isEmpty={teammatePickStats.length === 0}
                    emptyMsg={t('statistics.maps.noTeammatePickData')}
                >
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
                                        <tr key={leg.id} className="stats-table-row" style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }}>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>{i + 1}</td>
                                            {renderMapBreakdownLegendCell(leg.id, leg.name)}
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-dim)' }}>{leg.picks}</td>
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getWinRateColor(leg.winRate) }}>{leg.winRate}%</td>
                                            <AvgPlacementCell value={leg.avgPlacement} padding="10px 12px" />
                                            <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{leg.pickRate}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                </BreakdownPanel>
            </StatsTwoColumnGrid>
        </>
    );
};

interface EmptyStateProps {
    msg?: string;
}

const EmptyState = ({ msg }: EmptyStateProps) => {
    const { t } = useTranslation();
    return (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-faint)', border: '2px dashed var(--color-border)', borderRadius: '10px' }}>
            <h3>{t('statistics.emptyState.title')}</h3>
            <p>{msg || t('statistics.emptyState.noData')}</p>
        </div>
    );
};

type CatalogPickerItem = { id: string; label: string; imageUrl: string };

const CATALOG_PICKER_MARGIN = 12;
const CATALOG_PICKER_NAV_SAFE = 70;

const getCatalogPickerBounds = (anchor: HTMLElement | null) => {
    const viewport = {
        left: CATALOG_PICKER_NAV_SAFE + CATALOG_PICKER_MARGIN,
        right: window.innerWidth - CATALOG_PICKER_MARGIN,
        top: CATALOG_PICKER_MARGIN,
        bottom: window.innerHeight - CATALOG_PICKER_MARGIN,
    };

    const content = (anchor?.closest('[data-catalog-bounds="content"]')
        ?? document.querySelector('[data-catalog-bounds="content"]')) as HTMLElement | null;
    if (!content) return viewport;

    const box = content.getBoundingClientRect();
    return {
        left: Math.max(viewport.left, box.left + CATALOG_PICKER_MARGIN),
        right: Math.min(viewport.right, box.right - CATALOG_PICKER_MARGIN),
        top: viewport.top,
        bottom: viewport.bottom,
    };
};

/** Click trigger → icon grid dropdown for legend/weapon catalog selection. */
const CatalogPickerDropdown = ({
    items,
    selectedId,
    onSelect,
    media,
    children,
}: {
    items: CatalogPickerItem[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    media: 'legend' | 'weapon';
    children: React.ReactNode;
}) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelPos, setPanelPos] = useState<{
        left: number;
        width: number;
        maxHeight: number;
        top?: number;
        bottom?: number;
    } | null>(null);
    // Closed: drop the old position during render (no measuring needed).
    if (!open && panelPos !== null) setPanelPos(null);

    useLayoutEffect(() => {
        if (!open) return;
        const update = () => {
            const el = rootRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const bounds = getCatalogPickerBounds(el);
            const availableW = Math.max(0, bounds.right - bounds.left);
            const width = Math.min(760, availableW);
            if (width <= 0) return;

            const centerX = rect.left + rect.width / 2;
            const left = Math.min(
                Math.max(bounds.left, centerX - width / 2),
                Math.max(bounds.left, bounds.right - width),
            );

            const gap = 8;
            const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - gap - CATALOG_PICKER_MARGIN);
            const spaceAbove = Math.max(0, rect.top - gap - CATALOG_PICKER_MARGIN);
            const preferBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
            const rawMax = Math.min(440, preferBelow ? spaceBelow : spaceAbove);
            const maxHeight = Math.max(0, rawMax);

            if (preferBelow) {
                const top = Math.min(rect.bottom + gap, window.innerHeight - CATALOG_PICKER_MARGIN);
                const capped = Math.min(maxHeight, Math.max(0, window.innerHeight - CATALOG_PICKER_MARGIN - top));
                setPanelPos({ top, left, width, maxHeight: capped });
            } else {
                const bottom = Math.max(CATALOG_PICKER_MARGIN, window.innerHeight - rect.top + gap);
                const capped = Math.min(maxHeight, Math.max(0, window.innerHeight - CATALOG_PICKER_MARGIN - bottom));
                setPanelPos({ bottom, left, width, maxHeight: capped });
            }
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open]);

    // Second pass: clamp after paint if the panel still overflows the viewport.
    useLayoutEffect(() => {
        if (!open || !panelPos) return;
        const panel = panelRef.current;
        const anchor = rootRef.current;
        if (!panel) return;
        const box = panel.getBoundingClientRect();
        const bounds = getCatalogPickerBounds(anchor);
        let left = panelPos.left;
        let width = panelPos.width;
        let maxHeight = panelPos.maxHeight;
        let changed = false;

        const maxWidth = Math.max(0, bounds.right - bounds.left);
        if (width > maxWidth) {
            width = maxWidth;
            changed = true;
        }
        if (box.right > bounds.right + 0.5) {
            left = Math.max(bounds.left, bounds.right - (width || box.width));
            changed = true;
        }
        if (box.left < bounds.left - 0.5) {
            left = bounds.left;
            changed = true;
        }
        if (left + width > bounds.right + 0.5) {
            left = Math.max(bounds.left, bounds.right - width);
            changed = true;
        }
        if (box.bottom > window.innerHeight - CATALOG_PICKER_MARGIN + 0.5) {
            maxHeight = Math.max(80, maxHeight - (box.bottom - (window.innerHeight - CATALOG_PICKER_MARGIN)));
            changed = true;
        }
        if (box.top < CATALOG_PICKER_MARGIN - 0.5) {
            maxHeight = Math.max(80, maxHeight - (CATALOG_PICKER_MARGIN - box.top));
            changed = true;
        }

        if (
            changed
            && (left !== panelPos.left || width !== panelPos.width || maxHeight !== panelPos.maxHeight)
        ) {
            // Second measuring pass (panel's own box) before paint; converges because it only shrinks.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPanelPos({ ...panelPos, left, width, maxHeight });
        }
    }, [open, panelPos]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            const target = e.target as Node;
            if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const cellW = media === 'legend' ? 56 : 72;
    const cellH = media === 'legend' ? 56 : 48;

    return (
        <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex', maxWidth: '100%', zIndex: open ? 30 : undefined }}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 0,
                    margin: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'inherit',
                    textAlign: 'left',
                    maxWidth: '100%',
                }}
            >
                {children}
                <FaChevronDown
                    size={12}
                    style={{
                        flexShrink: 0,
                        opacity: 0.75,
                        transform: open ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s',
                    }}
                />
            </button>
            {open && panelPos
                ? createPortal(
                    <div
                        ref={panelRef}
                        role="listbox"
                        style={{
                            position: 'fixed',
                            top: panelPos.top,
                            bottom: panelPos.bottom,
                            left: panelPos.left,
                            zIndex: 10000,
                            width: panelPos.width,
                            maxWidth: panelPos.width,
                            maxHeight: panelPos.maxHeight,
                            overflowX: 'hidden',
                            overflowY: 'auto',
                            boxSizing: 'border-box',
                            padding: 14,
                            borderRadius: 12,
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-card)',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 10,
                            alignContent: 'flex-start',
                        }}
                    >
                        {items.map((item) => {
                            const selected = item.id === selectedId;
                            const weaponTheme = media === 'weapon' ? getWeaponTagTheme(item.id, 'master') : null;
                            const weaponBg = weaponTheme
                                ? `linear-gradient(rgba(0,0,0,0.58), rgba(0,0,0,0.52)), ${weaponTheme.bgGradient ?? weaponTheme.themeColor}`
                                : undefined;
                            const weaponScale = media === 'weapon' ? getWeaponSilhouetteScale(item.id) * 0.9 : 1;
                            const outlineShadow = selected
                                ? 'inset 0 0 0 2px var(--color-accent)'
                                : weaponTheme
                                    ? `inset 0 0 0 1px color-mix(in srgb, ${weaponTheme.themeColor} 45%, var(--color-border))`
                                    : 'inset 0 0 0 1px var(--color-border)';
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    title={item.label}
                                    onClick={() => {
                                        onSelect(item.id);
                                        setOpen(false);
                                    }}
                                    style={{
                                        position: 'relative',
                                        width: cellW,
                                        height: cellH,
                                        borderRadius: 8,
                                        border: 'none',
                                        padding: 0,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        // Legends stay grayscale when unselected; weapons use white silhouette on the img
                                        filter: media === 'legend'
                                            ? (selected ? 'grayscale(0%)' : 'grayscale(80%)')
                                            : undefined,
                                        opacity: selected ? 1 : media === 'weapon' ? 0.88 : 0.65,
                                        background: weaponBg ?? 'rgba(0,0,0,0.28)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <img
                                        src={item.imageUrl}
                                        alt={item.label}
                                        style={media === 'legend'
                                            ? { width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.12)' }
                                            : {
                                                maxWidth: '92%',
                                                maxHeight: '88%',
                                                objectFit: 'contain',
                                                filter: WHITE_SILHOUETTE_FILTER,
                                                transform: `scale(${weaponScale})`,
                                                transformOrigin: 'center',
                                            }}
                                        onError={(e) => {
                                            if (media === 'legend') {
                                                (e.target as HTMLImageElement).src = `${MAP_IMAGE_BASE}unknown.png`;
                                            } else {
                                                (e.target as HTMLImageElement).style.opacity = '0';
                                            }
                                        }}
                                    />
                                    <span
                                        aria-hidden
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            borderRadius: 8,
                                            boxShadow: outlineShadow,
                                            pointerEvents: 'none',
                                            zIndex: 1,
                                        }}
                                    />
                                </button>
                            );
                        })}
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
};

/** Content-box width where 7-stat strip + 4-col radar/cards start clipping (Free ads rail). */
const STATS_COMPACT_ENTER = 880;
const STATS_COMPACT_EXIT = 940;

const StatsCompactContext = React.createContext(false);
const useStatsCompact = () => React.useContext(StatsCompactContext);

/** Single-row stat strip: centered group; compact density instead of ellipsis-clipping. */
const overviewStatStripStyle = (padding: string, compact = false, borderless = false): React.CSSProperties => ({
    padding: compact ? '10px 10px' : padding,
    display: 'flex',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: compact ? 6 : 12,
    borderBottom: borderless ? undefined : '1px solid var(--color-border)',
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
});

const OverviewStatStrip = ({ padding, children, borderless = false }: { padding: string; children: React.ReactNode; borderless?: boolean }) => {
    const compact = useStatsCompact();
    return <div style={overviewStatStripStyle(padding, compact, borderless)}>{children}</div>;
};

/** Radar + Best Legend/Map/Weapon. Compact: radar full-width, then 3 cards (avoids side clipping). */
const overviewBestPicksGridStyle = (compact: boolean): React.CSSProperties => (
    compact
        ? {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 10,
            padding: 10,
            alignItems: 'stretch',
            boxSizing: 'border-box',
            minWidth: 0,
            width: '100%',
        }
        : {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) repeat(3, minmax(0, 1fr))',
            gap: 10,
            minHeight: 280,
            padding: 12,
            alignItems: 'stretch',
            justifyContent: 'center',
            boxSizing: 'border-box',
            minWidth: 0,
            width: '100%',
        }
);

const MapOverviewStat = ({ label, value, color = 'var(--color-text-primary)' }: { label: string; value: string | number; color?: string }) => {
    const compact = useStatsCompact();
    return (
    <div style={{
        flex: '1 1 0',
        minWidth: 0,
        maxWidth: compact ? 120 : 160,
        width: '100%',
        textAlign: 'center',
        padding: compact ? '8px 4px' : '14px 8px',
        background: STATS_SUBTLE_TILE_BG,
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        boxSizing: 'border-box',
    }}>
        <div style={{
            fontSize: compact ? '8px' : '10px',
            color: 'var(--color-text-muted)',
            marginBottom: compact ? '4px' : '6px',
            fontWeight: 600,
            lineHeight: 1.2,
            whiteSpace: compact ? 'normal' : 'nowrap',
            wordBreak: 'keep-all',
            overflow: compact ? 'visible' : 'hidden',
            textOverflow: compact ? undefined : 'ellipsis',
            minHeight: compact ? '1.8em' : undefined,
        }}>
            {label}
        </div>
        <div style={{
            fontSize: compact ? '13px' : '18px',
            fontWeight: 'bold',
            color,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        }}>
            {value}
        </div>
    </div>
    );
};

const MapOverviewTopCardStat = ({ label, value, color = 'var(--color-text-primary)' }: { label: string; value: string | number; color?: string }) => (
    <div style={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color }}>{value}</div>
    </div>
);

type SeasonStatsSummary = NonNullable<ReturnType<typeof calculateStats>>;

/** Thin vertical rule between stat groups (match results | personal) inside one strip. */
const StatStripDivider = () => (
    <div aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border)', margin: '6px 4px', flexShrink: 0 }} />
);

/** Box-less "label value" pair for secondary metrics. */
const InlineStat = ({ label, value, color, size = 'sm' }: {
    label: string;
    value: React.ReactNode;
    color?: string;
    size?: 'sm' | 'md';
}) => (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{
            fontSize: size === 'md' ? 15 : 13,
            fontWeight: 700,
            color: color ?? 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
        }}>
            {value}
        </span>
    </span>
);

/** One wrapping line of InlineStats (secondary metrics, account summary). */
const InlineStatLine = ({ children, padding, align = 'center', bordered = true }: {
    children: React.ReactNode;
    padding: string;
    align?: 'center' | 'flex-start';
    bordered?: boolean;
}) => {
    const compact = useStatsCompact();
    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: align,
            alignItems: 'baseline',
            columnGap: compact ? 14 : 24,
            rowGap: 6,
            // Left-aligned lines keep the card's 24px gutter so they line up with the title.
            padding: compact ? (align === 'center' ? '8px 12px 10px' : '8px 24px 10px') : padding,
            borderBottom: bordered ? '1px solid var(--color-border)' : undefined,
            boxSizing: 'border-box',
            minWidth: 0,
        }}>
            {children}
        </div>
    );
};

/**
 * Maps / Legends: all 7 season metrics on one row, match results | personal stats split by a rule.
 * Overview: 5 headline tiles, then the supporting metrics as one box-less line.
 */
const SeasonStatStrip = ({ stats, overview = false }: { stats: SeasonStatsSummary; overview?: boolean }) => {
    const { t } = useTranslation();
    const na = t('statistics.common.na');
    const winRate = <MapOverviewStat label={t('statistics.maps.winRate')} value={`${stats.winRate}%`} color={getWinRateColor(stats.winRate)} />;
    const avgPlacement = <MapOverviewStat label={t('statistics.common.avgPlacementShort')} value={`#${stats.avgPlacement}`} color={getAvgPlacementColor(stats.avgPlacement)} />;
    const kd = <MapOverviewStat label={t('statistics.legends.kd')} value={stats.kd} color={getKdColor(stats.kd)} />;
    const avgDamage = <MapOverviewStat label={t('statistics.maps.avgDamage')} value={stats.avgDamage} color={getAvgDamageColor(stats.avgDamage)} />;

    if (!overview) {
        return (
            <OverviewStatStrip padding="20px 24px">
                <MapOverviewStat label={t('statistics.legends.matches')} value={stats.matches} />
                {winRate}
                {avgPlacement}
                <MapOverviewStat label={t('statistics.maps.avgSurvival')} value={stats.avgTime} />
                <StatStripDivider />
                {kd}
                <MapOverviewStat label={t('statistics.weapons.kad')} value={stats.kda} color={getKadColor(stats.kda)} />
                {avgDamage}
            </OverviewStatStrip>
        );
    }

    return (
        <>
            <OverviewStatStrip padding="20px 24px 12px" borderless>
                {winRate}
                {avgPlacement}
                <MapOverviewStat label={t('statistics.overview.accountTop5', { defaultValue: 'Top 5' })} value={`${stats.top5Rate}%`} />
                <StatStripDivider />
                {kd}
                {avgDamage}
            </OverviewStatStrip>
            <InlineStatLine padding="4px 24px 16px">
                <InlineStat label={t('statistics.weapons.kad')} value={stats.kda} color={getKadColor(stats.kda)} />
                <InlineStat
                    label={t('sidebarStats.avgKnocks')}
                    value={stats.avgKnocks ?? na}
                    color={stats.avgKnocks != null ? getAvgKnocksColor(stats.avgKnocks) : undefined}
                />
                <InlineStat label={t('matchStats.knockToKill')} value={stats.knockToKillRate != null ? `${stats.knockToKillRate}%` : na} />
                <InlineStat label={t('statistics.maps.avgSurvival')} value={stats.avgTime} />
            </InlineStatLine>
        </>
    );
};

const OVERVIEW_RANK_MEDIA_SIZE = 48;

/** Shared Top Legends / Weapons / Teammate-legend rank card — equal height across side-by-side rows. */
const OverviewRankCard = ({
    rank,
    id,
    name,
    media,
    children,
    onClick,
}: {
    rank: number;
    id: string;
    name: string;
    media: 'legend' | 'weapon';
    children: React.ReactNode;
    onClick?: () => void;
}) => {
    const isFirst = rank === 0;
    const isLegend = media === 'legend';
    const imageSrc = isLegend ? `${MAP_IMAGE_BASE}${id}.png` : getWeaponImageUrl(id);
    return (
        <div
            className={onClick ? 'stats-rank-card is-clickable' : 'stats-rank-card'}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            } : undefined}
            style={{
            flex: 1,
            minWidth: 0,
            alignSelf: 'stretch',
            background: 'var(--color-bg-sub-header)',
            borderRadius: '10px',
            border: `1px solid ${isFirst ? 'var(--color-warning)' : 'var(--color-border)'}`,
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: onClick ? 'pointer' : undefined,
        }}>
            <div style={{
                width: isLegend ? OVERVIEW_RANK_MEDIA_SIZE : '100%',
                height: OVERVIEW_RANK_MEDIA_SIZE,
                boxSizing: 'border-box',
                borderRadius: isLegend ? '50%' : '8px',
                overflow: 'hidden',
                background: isLegend ? STATS_SUBTLE_TILE_BG : 'color-mix(in srgb, var(--color-bg-deep) 60%, transparent)',
                border: isFirst ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}>
                <img
                    src={imageSrc}
                    alt={name}
                    style={isLegend
                        ? { width: '42px', height: '42px', objectFit: 'contain' }
                        : { maxWidth: '90%', maxHeight: '36px', objectFit: 'contain' }}
                    onError={(e) => {
                        if (isLegend) e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`;
                        else e.currentTarget.style.display = 'none';
                    }}
                />
            </div>
            <div style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--color-text-dim)',
                textAlign: 'center',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: '10px',
                flexShrink: 0,
            }} title={name}>
                {name}
            </div>
            <div style={{ display: 'flex', width: '100%', gap: '4px', marginTop: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

const OverviewRankCardRow = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: '12px', flex: 1, alignItems: 'stretch', minHeight: 0 }}>
        {children}
    </div>
);

const OverviewRankSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        <h4 style={{ margin: '0 0 14px 0', color: 'var(--color-text-secondary)', fontSize: '13px', flexShrink: 0 }}>{title}</h4>
        {children}
    </div>
);

const OverviewRankEmpty = ({ msg }: { msg: string }) => (
    <div style={{
        flex: 1,
        padding: '24px 12px',
        textAlign: 'center',
        color: 'var(--color-text-faint)',
        fontSize: '12px',
        background: 'var(--color-bg-sub-header)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    }}>
        {msg}
    </div>
);

const OVERVIEW_BEST_PICK_SCRIM =
    'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.45) 42%, rgba(0,0,0,0.88) 100%)';

type OverviewBestPickStat = {
    label: string;
    value: string | number;
    color?: string;
};

const OverviewBestPickCard = ({
    label,
    title,
    stats,
    style,
    children,
}: {
    label: string;
    title: string;
    stats: OverviewBestPickStat[];
    style?: React.CSSProperties;
    children?: React.ReactNode;
}) => {
    const compact = useStatsCompact();
    return (
    <div
        style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: compact ? 168 : 152,
            minWidth: 0,
            borderRadius: 12,
            border: '1px solid color-mix(in srgb, var(--color-border-light) 70%, transparent)',
            overflow: 'hidden',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: compact ? '10px 10px' : '12px 14px',
            background: 'var(--color-bg-sub-header)',
            ...style,
        }}
        title={label}
    >
        {children}
        <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
            <div style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.72)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 4,
                textShadow: '0 1px 3px rgba(0,0,0,0.7)',
            }}>
                {label}
            </div>
            <div style={{
                fontSize: compact ? 14 : 15,
                fontWeight: 800,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                marginBottom: stats.length > 0 ? (compact ? 8 : 10) : 0,
            }}>
                {title}
            </div>
            {stats.length > 0 ? (
                <div style={{
                    display: 'flex',
                    flexDirection: compact ? 'column' : 'row',
                    gap: compact ? 4 : 6,
                    width: '100%',
                }}>
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            style={{
                                flex: compact ? '0 0 auto' : 1,
                                minWidth: 0,
                                display: compact ? 'flex' : undefined,
                                flexDirection: compact ? 'row' : undefined,
                                alignItems: compact ? 'center' : undefined,
                                justifyContent: compact ? 'space-between' : undefined,
                                gap: compact ? 8 : undefined,
                                textAlign: compact ? 'left' : 'center',
                                padding: compact ? '4px 8px' : '6px 4px',
                                borderRadius: 8,
                                background: 'rgba(0,0,0,0.35)',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}
                        >
                            <div style={{
                                fontSize: 9,
                                color: 'rgba(255,255,255,0.62)',
                                fontWeight: 600,
                                marginBottom: compact ? 0 : 2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}>
                                {stat.label}
                            </div>
                            <div style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: stat.color || '#fff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                                flexShrink: 0,
                            }}>
                                {stat.value}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    </div>
    );
};

const OVERVIEW_CHART_MARGIN = { top: 4, right: 12, left: 8, bottom: 18 };
const OVERVIEW_Y_AXIS_WIDTH = 44;

const overviewXAxisTick = { fill: 'var(--color-text-faint)', fontSize: 9 };

type RadarAxisKey = 'combat' | 'damage' | 'macro' | 'team' | 'peak';

const RADAR_OUTER_RADIUS_RATIO = 0.78;

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
}: {
    radarData: Array<{ subject: string; A: number; fullMark: number; key: RadarAxisKey }>;
    stats: NonNullable<ReturnType<typeof calculateStats>>;
    radarScores: ReturnType<typeof computeOverviewAnalytics>['radarScores'];
    bestPeakMatch: MatchWithMeta | null;
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
                    <RadarTooltipRow key="kd" label={t('statistics.legends.kd')} value={stats.kd} color={getKdColor(stats.kd)} />,
                    <RadarTooltipRow key="kad" label={t('statistics.weapons.kad')} value={stats.kda} color={getKadColor(stats.kda)} />,
                );
                break;
            case 'damage':
                rows.push(
                    <RadarTooltipRow key="avg" label={t('statistics.maps.avgDamage')} value={stats.avgDamage.toLocaleString()} color={getAvgDamageColor(stats.avgDamage)} />,
                    <div key="total" style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginTop: '2px' }}>
                        {t('statistics.overview.totalDamage', { count: stats.totalDamage })}
                    </div>,
                );
                break;
            case 'macro':
                rows.push(
                    <RadarTooltipRow key="place" label={t('statistics.common.avgPlacementShort')} value={`#${stats.avgPlacement}`} color={getAvgPlacementColor(stats.avgPlacement)} />,
                    <RadarTooltipRow key="time" label={t('statistics.maps.avgSurvival')} value={stats.avgTime} color="var(--color-text-primary)" />,
                );
                break;
            case 'team':
                rows.push(
                    <RadarTooltipRow key="contrib" label={t('statistics.overview.killContributeShort')} value={stats.lograte === null ? t('statistics.common.na') : `${stats.lograte}%`} color="var(--color-text-primary)" />,
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
    }, [hoveredKey, hoverSubject, radarScores, stats, bestPeakMatch, t]);

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
                        outerRadius="78%"
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
    data: Array<{ idx: number; name: string; kills: number; assists: number; damage: number; placement: number; legendId: string; legendName: string }>;
    valueKey: 'placement' | 'kills' | 'assists' | 'damage';
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
    data: Array<{ idx: number; name: string; kills: number; assists: number; damage: number; placement: number; legendId: string; legendName: string }>;
}) => {
    const { t } = useTranslation();
    const [hoveredMatch, setHoveredMatch] = useState<string | null>(null);
    const hovered = useMemo(() => data.find(d => d.name === hoveredMatch) ?? null, [data, hoveredMatch]);
    const syncId = 'overview-performance';

    const chartRows = [
        { title: t('statistics.overview.chartPlacement'), valueKey: 'placement' as const, color: STATS_INFO_BLUE, type: 'line' as const, reversedY: true },
        { title: t('statistics.overview.chartKills'), valueKey: 'kills' as const, color: 'var(--color-danger)', type: 'bar' as const },
        { title: t('statistics.overview.chartAssists'), valueKey: 'assists' as const, color: '#f1c40f', type: 'bar' as const },
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
                                    <span style={{ color: '#f1c40f' }}>{hovered.assists} {t('statistics.overview.chartAssists')}</span>
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

/**
 * Ranked season totals straight from the account (GEP player_stats, incl. games played
 * without the app). Follows the season picker: the current season comes from
 * br_ranked_latest, past seasons (premium) from br_ranked_history.
 * GEP seasons have no split, so every split of that season shows the same numbers.
 */
const AccountSeasonCard = ({
    profileUid,
    selectedSeasonId,
    seasons,
    trackedMatches,
    isPremium,
}: {
    profileUid: string;
    selectedSeasonId: number;
    seasons: Season[];
    trackedMatches: MatchHistory[];
    isPremium: boolean;
}) => {
    const { t } = useTranslation();
    const account = useAccountStats(profileUid);

    const seasonNumber = parseSeasonNumber(seasons.find((s) => s.id === selectedSeasonId)?.name);
    const latest = account?.br_ranked_latest ?? null;
    const ranked = seasonNumber === null
        ? null
        : latest && Number(latest.season) === seasonNumber
            ? latest
            : isPremium
                ? (account?.br_ranked_history ?? []).find((s) => s && Number(s.season) === seasonNumber) ?? null
                : null;
    if (!ranked || !(ranked.games > 0)) {
        return null;
    }

    const kd = Number.isFinite(ranked.kill_death_ratio) ? ranked.kill_death_ratio.toFixed(2) : '-';
    const winRate = Number.isFinite(ranked.win_rate) ? ranked.win_rate.toFixed(1) : '0.0';
    const avgDamage = Math.round(ranked.average_damage || 0);
    const top5Rate = ranked.games > 0 ? ((ranked.top_5s / ranked.games) * 100).toFixed(1) : '0.0';

    // Premium: tracking coverage. The card only renders with "Season" picked, so trackedMatches
    // already span every split — same scope as GEP's season totals.
    const trackedRanked = trackedMatches.filter(
        (m) => String((m as { mode?: string }).mode ?? '').toLowerCase().includes('ranked'),
    ).length;
    const coverage = isPremium
        ? { tracked: Math.min(trackedRanked, ranked.games), total: ranked.games }
        : null;
    const coveragePct = coverage && coverage.total > 0 ? Math.round((coverage.tracked / coverage.total) * 100) : 0;

    return (
        <div style={{
            background: 'var(--color-bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            marginBottom: '20px',
        }}>
            {/* Official account-wide numbers: one compact line, so the tracked stats below stay the focus. */}
            <div style={{ padding: '14px 24px 0' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                    {t('statistics.overview.accountSeasonTitle', { season: ranked.season, defaultValue: 'Account · Ranked Season {{season}}' })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
                    {t('statistics.overview.accountSeasonHint', { defaultValue: 'All ranked games on this account this season, including ones played without ApexTrace.' })}                </div>
            </div>
            <InlineStatLine padding="10px 24px 14px" align="flex-start">
                <InlineStat size="md" label={t('statistics.maps.totalMatches')} value={ranked.games.toLocaleString()} />
                <InlineStat size="md" label={t('statistics.maps.winRate')} value={`${winRate}%`} color={getWinRateColor(winRate)} />
                <InlineStat size="md" label={t('statistics.overview.accountTop5', { defaultValue: 'Top 5' })} value={`${top5Rate}%`} />
                <InlineStat size="md" label={t('statistics.legends.kd')} value={kd} color={getKdColor(kd)} />
                <InlineStat size="md" label={t('statistics.maps.avgDamage')} value={avgDamage} color={getAvgDamageColor(avgDamage)} />
                {typeof ranked.rank_score === 'number' && (
                    <InlineStat size="md" label="RP" value={ranked.rank_score.toLocaleString()} color="var(--color-warning)" />
                )}
            </InlineStatLine>

            {coverage && (
                <div style={{ padding: '12px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                        <span>{t('statistics.overview.accountCoverage', { defaultValue: 'Tracked by ApexTrace' })}</span>
                        <span style={{ color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                            {t('statistics.overview.accountCoverageValue', {
                                tracked: coverage.tracked,
                                total: coverage.total,
                                pct: coveragePct,
                                defaultValue: '{{tracked}} / {{total}} games ({{pct}}%)',
                            })}
                        </span>
                    </div>
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={coverage.total}
                        aria-valuenow={coverage.tracked}
                        style={{ height: 4, borderRadius: 999, background: 'var(--color-bg-sub-header)', overflow: 'hidden' }}
                    >
                        <div style={{ width: `${coveragePct}%`, height: '100%', background: 'var(--color-accent)' }} />
                    </div>
                </div>
            )}

        </div>
    );
};

const OverviewView = ({
    data,
    isPremium = false,
    showRankProgress,
    profileUid,
    selectedSeasonId,
    seasons,
    wholeSeason = false,
}: {
    data: MatchHistory[];
    isPremium?: boolean;
    showRankProgress: boolean;
    profileUid?: string | null;
    selectedSeasonId: number;
    seasons: Season[];
    /** Account (GEP) numbers are whole-season only, so the card shows only with "Season" picked. */
    wholeSeason?: boolean;
}) => {
    const accountCard = wholeSeason && showRankProgress && profileUid ? (
        <AccountSeasonCard
            profileUid={profileUid}
            selectedSeasonId={selectedSeasonId}
            seasons={seasons}
            trackedMatches={data}
            isPremium={isPremium}
        />
    ) : null;
    return (
        <TrackedOverviewView
            data={data}
            showRankProgress={showRankProgress}
            profileUid={profileUid}
            selectedSeasonId={selectedSeasonId}
            seasons={seasons}
            afterAnalytics={accountCard}
        />
    );
};

const TrackedOverviewView = ({
    data,
    showRankProgress,
    profileUid,
    selectedSeasonId,
    seasons,
    afterAnalytics = null,
}: {
    data: MatchHistory[];
    showRankProgress: boolean;
    profileUid?: string | null;
    selectedSeasonId: number;
    seasons: Season[];
    /** Account (GEP) season card + tracking coverage — sits right under the ANALYTICS card. */
    afterAnalytics?: React.ReactNode;
}) => {
    const { t } = useTranslation();
    const compact = useStatsCompact();
    const stats = calculateStats(data);
    const analytics = useMemo(() => (stats ? computeOverviewAnalytics(stats, data) : null), [stats, data]);
    const topMap = useMemo(() => {
        const maps = aggregateMapStatsForMatches(data);
        return [...maps].sort((a, b) => (b.games !== a.games ? b.games - a.games : a.name.localeCompare(b.name)))[0];
    }, [data]);
    const headerBgUrl = useLocalImage(getMapThumbnailUrl(topMap?.name ?? TARGET_MAPS[0]));

    const bestPicks = useMemo(() => {
        const usable = data.filter((m) => isKnownLegend(m.legend) && hasUsableMatchStats(m));
        // Aggregators already sort by hybrid rankScore (volume × KD with prior).
        const legends = aggregateLegendStatsForMatches(usable);
        const maps = aggregateMapStatsForMatches(usable);
        const weapons = aggregateWeaponStatsForMatches(usable);
        return {
            legend: legends[0] ?? null,
            map: maps[0] ?? null,
            weapon: weapons[0] ?? null,
        };
    }, [data]);

    const bestLegendBg = useLocalImage(bestPicks.legend ? `${MAP_IMAGE_BASE}${bestPicks.legend.id}.png` : '');
    const bestMapBg = useLocalImage(bestPicks.map ? getMapThumbnailUrl(bestPicks.map.name) : '');

    const radarPanelRef = useRef<HTMLDivElement>(null);
    const [compactRadarTier, setCompactRadarTier] = useState(false);

    useEffect(() => {
        const el = radarPanelRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;

        const ENTER_W = 280;
        const EXIT_W = 310;
        const ENTER_H = 250;
        const EXIT_H = 285;

        const update = (width: number, height: number) => {
            setCompactRadarTier((prev) => {
                // Hysteresis: footer/padding must not flip the measured box across the threshold.
                if (prev) return width < EXIT_W || height < EXIT_H;
                return width < ENTER_W || height < ENTER_H;
            });
        };

        const readSize = () => {
            // Prefer border box — contentRect changes when padding toggles and causes flicker.
            update(el.clientWidth, el.clientHeight);
        };
        readSize();

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const box = entry.borderBoxSize?.[0];
            if (box) {
                update(box.inlineSize, box.blockSize);
                return;
            }
            update(el.clientWidth, el.clientHeight);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

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
        return [...data]
            .filter((m: MatchHistory) => hasUsableMatchStats(m))
            .slice(0, 20)
            .reverse()
            .map((m: MatchHistory, i) => {
                const legendKey = isKnownLegend(m.legend) ? normalizeLegendKey(m.legend) : 'unknown';
                return {
                    idx: i,
                    name: `${i + 1}`,
                    kills: m.kills || 0,
                    assists: m.assists || 0,
                    damage: m.damage || 0,
                    placement: Number(m.placement),
                    legendId: legendKey,
                    legendName: isKnownLegend(m.legend) ? formatLegendDisplayName(legendKey) : '-',
                };
            });
    }, [data]);

    if (!stats || !analytics) return <EmptyState />;

    const { totalTier, totalScore } = analytics;
    const tierColor = totalScore >= 80 ? 'var(--color-text-primary)' : (totalScore >= 50 ? 'var(--color-text-dim)' : 'var(--color-text-faint)');

    return (
        <div style={{ animation: STATS_VIEW_ANIMATION }}>
            <div style={{
                background: 'var(--color-bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
                marginBottom: '20px',
            }}>
                <CatalogHero
                    eyebrow={t('statistics.overview.analytics')}
                    title={`${stats.matches} ${t('statistics.legends.matches')}`}
                    imageUrl={headerBgUrl}
                />

                <SeasonStatStrip stats={stats} overview />

                <div style={overviewBestPicksGridStyle(compact)}>
                    <div
                        ref={radarPanelRef}
                        className="overview-radar-chart"
                        style={{
                            position: 'relative',
                            minWidth: 0,
                            minHeight: compact ? 280 : 260,
                            height: compact ? 280 : '100%',
                            padding: 0,
                            borderRadius: 12,
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-sub-header)',
                            boxSizing: 'border-box',
                            userSelect: 'none',
                            cursor: 'default',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <div style={{
                            flex: 1,
                            minHeight: 0,
                            position: 'relative',
                            padding: '8px 8px 12px',
                            boxSizing: 'border-box',
                        }}>
                            <OverviewRadarChart
                                radarData={radarData}
                                stats={stats}
                                radarScores={analytics.radarScores}
                                bestPeakMatch={analytics.bestPeakMatch}
                            />
                            {!compactRadarTier ? (
                                <div style={{
                                    position: 'absolute',
                                    right: 10,
                                    bottom: 10,
                                    zIndex: 3,
                                    pointerEvents: 'none',
                                    padding: '8px 12px',
                                    borderRadius: '10px',
                                    background: 'rgba(0,0,0,0.55)',
                                    border: '1px solid var(--color-border)',
                                    backdropFilter: 'blur(4px)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '68px',
                                    boxSizing: 'border-box',
                                }}>
                                    <div style={{ fontSize: '10px', color: COLORS.NEON_RED, fontWeight: 'bold', letterSpacing: '0.06em', lineHeight: 1.2 }}>{t('statistics.overview.tier')}</div>
                                    <div style={{ fontSize: '28px', fontWeight: 900, color: tierColor, letterSpacing: '-1px', lineHeight: 1.1, margin: '2px 0' }}>{totalTier}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.2 }}>{totalScore}/100</div>
                                </div>
                            ) : null}
                        </div>
                        {compactRadarTier ? (
                            <div style={{
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 10,
                                width: '100%',
                                margin: 0,
                                padding: '8px 12px',
                                boxSizing: 'border-box',
                                borderTop: '1px solid var(--color-border)',
                                background: 'rgba(0,0,0,0.22)',
                            }}>
                                <div style={{ fontSize: '10px', color: COLORS.NEON_RED, fontWeight: 'bold', letterSpacing: '0.06em' }}>
                                    {t('statistics.overview.tier')}
                                </div>
                                <div style={{ fontSize: '22px', fontWeight: 900, color: tierColor, letterSpacing: '-1px', lineHeight: 1 }}>
                                    {totalTier}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                    {totalScore}/100
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {(() => {
                            const legend = bestPicks.legend;
                            const map = bestPicks.map;
                            const weapon = bestPicks.weapon;
                            const weaponTheme = weapon ? getWeaponTagTheme(weapon.id, 'user') : null;
                            const weaponAccent = weaponTheme?.themeColor || weaponTheme?.color || '#8899aa';
                            const weaponUrl = weapon ? getWeaponImageUrl(weapon.id) : '';
                            const na = t('statistics.common.na');

                            const cards = (
                                <>
                                    <OverviewBestPickCard
                                        label={t('statistics.overview.bestLegend', { defaultValue: 'Best Legend' })}
                                        title={legend ? formatLegendDisplayName(legend.id) : '—'}
                                        stats={legend ? [
                                            { label: t('statistics.legends.matches'), value: legend.games },
                                            { label: t('statistics.legends.winRate'), value: `${legend.winRate}%`, color: getWinRateColor(legend.winRate) },
                                            { label: t('statistics.legends.kd'), value: formatKdNumber(legend.kd), color: getKdColor(legend.kd) },
                                        ] : []}
                                        style={legend ? {
                                            backgroundColor: '#0a0a0a',
                                            backgroundImage: `${OVERVIEW_BEST_PICK_SCRIM}, ${toCssUrl(bestLegendBg)}`,
                                            // Height-fit (not cover): wide maximized cards otherwise crop to a center strip
                                            backgroundSize: 'auto 100%',
                                            backgroundPosition: 'center top',
                                            backgroundRepeat: 'no-repeat',
                                        } : undefined}
                                    />
                                    <OverviewBestPickCard
                                        label={t('statistics.overview.bestMap', { defaultValue: 'Best Map' })}
                                        title={map ? normalizeMapDisplayName(map.name) : '—'}
                                        stats={map ? [
                                            { label: t('statistics.legends.matches'), value: map.games },
                                            { label: t('statistics.maps.winRate'), value: `${map.winRate}%`, color: getWinRateColor(map.winRate) },
                                            { label: t('statistics.legends.kd'), value: formatKdNumber(map.kd), color: getKdColor(map.kd) },
                                        ] : []}
                                        style={map ? {
                                            backgroundImage: `${OVERVIEW_BEST_PICK_SCRIM}, url(${bestMapBg})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat',
                                        } : undefined}
                                    />
                                    <OverviewBestPickCard
                                        label={t('statistics.overview.bestWeapon', { defaultValue: 'Best Weapon' })}
                                        title={weapon ? (getWeaponDisplayName(weapon.id) || weapon.name) : '—'}
                                        stats={weapon ? [
                                            { label: t('statistics.weapons.matches'), value: weapon.usageLabel },
                                            { label: t('statistics.weapons.winRate'), value: formatWeaponWinRate(weapon.winRate, weapon.hasWinRate), color: getWinRateColor(weapon.winRate, { hasValue: weapon.hasWinRate }) },
                                            { label: t('statistics.weapons.kd'), value: formatWeaponKd(weapon.kd, weapon.hasKd, na), color: getKdColor(weapon.hasKd ? weapon.kd : null) },
                                        ] : []}
                                        style={weapon ? {
                                            background: `linear-gradient(160deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.72) 48%, color-mix(in srgb, ${weaponAccent} 26%, rgba(0,0,0,0.88)) 100%)`,
                                        } : undefined}
                                    >
                                        {weaponUrl ? (
                                            <>
                                                <img
                                                    src={weaponUrl}
                                                    alt=""
                                                    aria-hidden
                                                    style={{
                                                        position: 'absolute',
                                                        left: '50%',
                                                        top: '36%',
                                                        transform: 'translate(-50%, -50%) scale(1.75)',
                                                        width: 'min(64%, 168px)',
                                                        maxHeight: 'min(72%, 108px)',
                                                        objectFit: 'contain',
                                                        opacity: 0.28,
                                                        filter: 'blur(6px) saturate(1.15)',
                                                        pointerEvents: 'none',
                                                        zIndex: 0,
                                                    }}
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                                <img
                                                    src={weaponUrl}
                                                    alt=""
                                                    aria-hidden
                                                    style={{
                                                        position: 'absolute',
                                                        left: '50%',
                                                        top: '36%',
                                                        transform: 'translate(-50%, -50%)',
                                                        width: 'min(64%, 168px)',
                                                        maxHeight: 'min(70%, 104px)',
                                                        objectFit: 'contain',
                                                        opacity: 0.92,
                                                        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.55))',
                                                        pointerEvents: 'none',
                                                        zIndex: 1,
                                                    }}
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            </>
                                        ) : null}
                                    </OverviewBestPickCard>
                                </>
                            );
                            return compact ? (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                    gap: 10,
                                    minWidth: 0,
                                }}>
                                    {cards}
                                </div>
                            ) : cards;
                        })()}
                </div>
            </div>

            {afterAnalytics}

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
    stats: SeasonStatsSummary | null;
}) => {
    const { t } = useTranslation();
    const nav = useStatsNav();
    const topLegends = useMemo(() => aggregateLegendStatsForMatches(matches).slice(0, 3), [matches]);
    const topWeapons = useMemo(() => aggregateWeaponStatsForMatches(matches).slice(0, 3), [matches]);
    const mapUrl = useLocalImage(getMapThumbnailUrl(mapName));

    return (
        <StatsCard>
            <CatalogHero eyebrow={t('statistics.maps.overview')} title={mapName} imageUrl={mapUrl} />

            {stats ? (
                <>
                    <SeasonStatStrip stats={stats} />

                    <StatsTwoColumnGrid padding="20px 24px 24px">
                        <OverviewRankSection title={t('statistics.maps.topLegends')}>
                            {topLegends.length > 0 ? (
                                <OverviewRankCardRow>
                                    {topLegends.map((leg, i) => (
                                        <OverviewRankCard key={leg.id} rank={i} id={leg.id} name={leg.name} media="legend" onClick={nav ? () => nav.openLegend(leg.id) : undefined}>
                                            <MapOverviewTopCardStat label={t('statistics.maps.legendMatches')} value={leg.games} />
                                            <MapOverviewTopCardStat label={t('statistics.maps.legendWinPercent')} value={`${leg.winRate}%`} color={getWinRateColor(leg.winRate)} />
                                            <MapOverviewTopCardStat label={t('statistics.maps.legendKd')} value={formatKdNumber(leg.kd)} color={getKdColor(leg.kd)} />
                                        </OverviewRankCard>
                                    ))}
                                </OverviewRankCardRow>
                            ) : (
                                <OverviewRankEmpty msg={t('statistics.maps.noMyLegendData')} />
                            )}
                        </OverviewRankSection>

                        <OverviewRankSection title={t('statistics.maps.topWeapons')}>
                            {topWeapons.length > 0 ? (
                                <OverviewRankCardRow>
                                    {topWeapons.map((w, i) => (
                                        <OverviewRankCard key={w.id} rank={i} id={w.id} name={w.name} media="weapon" onClick={nav ? () => nav.openWeapon(w.id) : undefined}>
                                            <MapOverviewTopCardStat label={t('statistics.weapons.matches')} value={w.usageLabel} />
                                            <MapOverviewTopCardStat label={t('statistics.weapons.kd')} value={formatWeaponKd(w.kd, w.hasKd, t('statistics.common.na'))} color={getKdColor(w.hasKd ? w.kd : null)} />
                                        </OverviewRankCard>
                                    ))}
                                </OverviewRankCardRow>
                            ) : (
                                <OverviewRankEmpty msg={t('statistics.legends.noWeaponRankData')} />
                            )}
                        </OverviewRankSection>
                    </StatsTwoColumnGrid>
                </>
            ) : (
                <PanelEmpty msg={t('statistics.maps.noMatchesFound', { map: mapName })} />
            )}
        </StatsCard>
    );
};

const LegendOverviewPanel = ({
    legendId,
    legendName,
    matches,
    stats,
    profileUid,
    profileName,
    catalogItems,
    onSelectLegend,
}: {
    legendId: string | null;
    legendName: string;
    matches: MatchHistory[];
    stats: SeasonStatsSummary | null;
    profileUid?: string | null;
    profileName?: string | null;
    catalogItems: CatalogPickerItem[];
    onSelectLegend: (id: string) => void;
}) => {
    const { t } = useTranslation();
    const nav = useStatsNav();
    const topWeapons = useMemo(() => aggregateWeaponStatsForMatches(matches).slice(0, 3), [matches]);
    const topMap = useMemo(() => {
        const maps = aggregateMapStatsForMatches(matches);
        return [...maps].sort((a, b) => (b.games !== a.games ? b.games - a.games : a.name.localeCompare(b.name)))[0];
    }, [matches]);
    const topTeammateLegends = useMemo(
        () => aggregateTeammateLegendPicksForMatches(matches, profileUid, profileName).slice(0, 3),
        [matches, profileUid, profileName],
    );
    const hasSelection = Boolean(legendId);
    const headerBgUrl = useLocalImage(getMapThumbnailUrl(topMap?.name ?? TARGET_MAPS[0]));
    const selectPrompt = t('statistics.legends.selectPrompt', { defaultValue: 'Select a legend' });

    return (
        <StatsCard>
            <CatalogHero
                eyebrow={t('statistics.legends.overview')}
                title={hasSelection ? legendName : selectPrompt}
                titleTransform={hasSelection ? 'capitalize' : 'none'}
                imageUrl={headerBgUrl}
                media={<CatalogHeroMedia kind="legend" src={legendId ? `${MAP_IMAGE_BASE}${legendId}.png` : null} alt={legendName} />}
                renderTrigger={(content) => (
                    <CatalogPickerDropdown items={catalogItems} selectedId={legendId} onSelect={onSelectLegend} media="legend">
                        {content}
                    </CatalogPickerDropdown>
                )}
            />

            {!hasSelection ? (
                <PanelEmpty msg={selectPrompt} />
            ) : stats ? (
                <>
                    <SeasonStatStrip stats={stats} />

                    <StatsTwoColumnGrid padding="20px 24px 24px">
                        <OverviewRankSection title={t('statistics.legends.topWeapons')}>
                            {topWeapons.length > 0 ? (
                                <OverviewRankCardRow>
                                    {topWeapons.map((w, i) => (
                                        <OverviewRankCard key={w.id} rank={i} id={w.id} name={w.name} media="weapon" onClick={nav ? () => nav.openWeapon(w.id) : undefined}>
                                            <MapOverviewTopCardStat label={t('statistics.weapons.matches')} value={w.usageLabel} />
                                            <MapOverviewTopCardStat label={t('statistics.weapons.kd')} value={formatWeaponKd(w.kd, w.hasKd, t('statistics.common.na'))} color={getKdColor(w.hasKd ? w.kd : null)} />
                                        </OverviewRankCard>
                                    ))}
                                </OverviewRankCardRow>
                            ) : (
                                <OverviewRankEmpty msg={t('statistics.legends.noWeaponRankData')} />
                            )}
                        </OverviewRankSection>

                        <OverviewRankSection title={t('statistics.legends.topTeammateLegends')}>
                            {topTeammateLegends.length > 0 ? (
                                <OverviewRankCardRow>
                                    {topTeammateLegends.map((leg, i) => (
                                        <OverviewRankCard key={leg.id} rank={i} id={leg.id} name={leg.name} media="legend" onClick={() => onSelectLegend(leg.id)}>
                                            <MapOverviewTopCardStat label={t('statistics.maps.teammatePicks')} value={leg.picks} />
                                            <MapOverviewTopCardStat label={t('statistics.maps.legendWinPercent')} value={`${leg.winRate}%`} color={getWinRateColor(leg.winRate)} />
                                        </OverviewRankCard>
                                    ))}
                                </OverviewRankCardRow>
                            ) : (
                                <OverviewRankEmpty msg={t('statistics.maps.noTeammatePickData')} />
                            )}
                        </OverviewRankSection>
                    </StatsTwoColumnGrid>
                </>
            ) : (
                <PanelEmpty msg={t('statistics.legends.noMatchesFound', { legend: legendName })} />
            )}
        </StatsCard>
    );
};

function MapSelectChip({ mapName, selected, onSelect }: { mapName: string; selected: boolean; onSelect: () => void }) {
    const bg = useLocalImage(`${MAP_IMAGE_BASE}${MAP_THUMBNAILS[mapName] || 'thumbnail-kings_canyon.png'}`);
    return (
        <button
            type="button"
            className="stats-map-chip"
            aria-pressed={selected}
            onClick={onSelect}
            style={{
                minWidth: '140px', height: '80px', borderRadius: '8px', padding: 0, flexShrink: 0,
                border: selected ? '2px solid var(--color-accent)' : '2px solid var(--color-border-light)',
                backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${bg})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative',
                boxShadow: selected ? '0 0 10px color-mix(in srgb, var(--color-accent) 35%, transparent)' : 'none',
            }}
        >
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px', textAlign: 'center', padding: '0 5px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                {mapName}
            </span>
        </button>
    );
}

const filterMatchesForMap = (data: MatchHistory[], mapName: string) =>
    data.filter(m => (m.map || '').toLowerCase() === mapName.toLowerCase());

const MapsView = ({ data, profileUid, profileName }: { data: MatchHistory[]; profileUid?: string | null; profileName?: string | null }) => {
    // Default to the map with the most matches so the tab never opens on an empty map.
    const defaultMap = useMemo(() => {
        const counts = TARGET_MAPS.map((name) => ({ name, games: filterMatchesForMap(data, name).length }));
        const best = pickMostPlayed(counts);
        return best && best.games > 0 ? best.name : TARGET_MAPS[0];
    }, [data]);
    const [pickedMap, setPickedMap] = useState<string | null>(() => {
        const stored = getSessionCatalogId('map');
        return stored && TARGET_MAPS.includes(stored) ? stored : null;
    });
    const selectedMap = pickedMap ?? defaultMap;
    const selectMap = (name: string) => {
        setSessionCatalogId('map', name);
        setPickedMap(name);
    };
    const mapMatches = useMemo(() => filterMatchesForMap(data, selectedMap), [data, selectedMap]);
    const stats = useMemo(() => calculateStats(mapMatches), [mapMatches]);

    return (
        <div style={{ animation: STATS_VIEW_ANIMATION }}>
            <div className="stats-subtab-scroll" style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '2px 2px 12px', marginBottom: '12px' }}>
                {TARGET_MAPS.map(mapName => (
                    <MapSelectChip
                        key={mapName}
                        mapName={mapName}
                        selected={selectedMap === mapName}
                        onSelect={() => selectMap(mapName)}
                    />
                ))}
            </div>

            <MapOverviewPanel mapName={selectedMap} matches={mapMatches} stats={stats} />
            {stats ? (
                <MapLegendBreakdown matches={mapMatches} mapName={selectedMap} profileUid={profileUid} profileName={profileName} />
            ) : null}
        </div>
    );
};

const LegendsView = ({ data, profileUid, profileName }: { data: MatchHistory[]; profileUid?: string | null; profileName?: string | null }) => {
    const catalogItems = useMemo<CatalogPickerItem[]>(
        () => LEGENDS_LIST.map((id) => ({
            id,
            label: formatLegendDisplayName(id),
            imageUrl: `${MAP_IMAGE_BASE}${id}.png`,
        })),
        [],
    );
    // No stored pick yet → open on the user's most-played legend instead of an empty prompt.
    const defaultLegend = useMemo(() => pickMostPlayed(aggregateLegendStatsForMatches(data))?.id ?? null, [data]);
    const [pickedLegend, setPickedLegend] = useState<string | null>(() => getSessionCatalogId('legend'));
    const selectedLegend = pickedLegend ?? defaultLegend;
    const setSelectedLegend = (id: string) => {
        setSessionCatalogId('legend', id);
        setPickedLegend(id);
    };

    const legendMatches = useMemo(
        () => selectedLegend
            ? data.filter(m => normalizeLegendKey(m.legend) === selectedLegend.toLowerCase())
            : [],
        [data, selectedLegend]
    );
    const stats = useMemo(() => calculateStats(legendMatches), [legendMatches]);
    const legendDisplayName = selectedLegend ? formatLegendDisplayName(selectedLegend) : '';

    return (
        <div style={{ animation: STATS_VIEW_ANIMATION }}>
            <LegendOverviewPanel
                legendId={selectedLegend}
                legendName={legendDisplayName}
                matches={legendMatches}
                stats={stats}
                profileUid={profileUid}
                profileName={profileName}
                catalogItems={catalogItems}
                onSelectLegend={setSelectedLegend}
            />
            {stats ? (
                <LegendWeaponMapBreakdown matches={legendMatches} legendName={legendDisplayName} />
            ) : null}
        </div>
    );
};

const WeaponsView = ({ data }: { data: MatchHistory[] }) => {
    const { t } = useTranslation();
    const nav = useStatsNav();
    const weaponCatalog = useMemo(() => buildWeaponItems(), []);
    const weaponPickerItems = useMemo<CatalogPickerItem[]>(
        () => weaponCatalog.map((w) => ({
            id: w.id,
            label: w.label,
            // Picker shows white silhouettes (game HUD art), not the colour renders.
            imageUrl: getWeaponSilhouetteUrl(w.id),
        })),
        [weaponCatalog],
    );
    const weaponStats = useMemo(() => aggregateWeaponStatsForMatches(data), [data]);
    const threatWeapons = useMemo(() => aggregateThreatWeaponStatsForMatches(data).slice(0, 3), [data]);
    const topWeapons = useMemo(() => weaponStats.slice(0, 3), [weaponStats]);

    // No stored pick yet → open on the most-used weapon instead of an empty prompt.
    const defaultWeaponId = useMemo(
        () => weaponStats.reduce<(typeof weaponStats)[number] | undefined>(
            (best, w) => (!best || w.usageGames > best.usageGames ? w : best),
            undefined,
        )?.id ?? null,
        [weaponStats],
    );
    const [pickedWeaponId, setPickedWeaponId] = useState<string | null>(() => getSessionCatalogId('weapon'));
    const selectedWeaponId = pickedWeaponId ?? defaultWeaponId;
    const setSelectedWeaponId = (id: string) => {
        setSessionCatalogId('weapon', id);
        setPickedWeaponId(id);
    };

    const selectedStat = useMemo(
        () => selectedWeaponId ? (weaponStats.find(w => w.id === selectedWeaponId) ?? null) : null,
        [weaponStats, selectedWeaponId],
    );
    const pairedWeapons = useMemo(
        () => selectedWeaponId ? aggregatePairedWeaponsForWeapon(data, selectedWeaponId) : [],
        [data, selectedWeaponId],
    );
    const weaponLegends = useMemo(
        () => selectedWeaponId ? aggregateLegendsForWeapon(data, selectedWeaponId) : [],
        [data, selectedWeaponId],
    );
    const topPaired = pairedWeapons.slice(0, 3);
    const topWeaponLegends = weaponLegends.slice(0, 3);
    const selectWeaponPrompt = t('statistics.weapons.selectPrompt', { defaultValue: 'Select a weapon' });
    const selectedName = selectedWeaponId
        ? (selectedStat?.name ?? getWeaponDisplayName(selectedWeaponId))
        : selectWeaponPrompt;
    // Hero tint follows the selected weapon's ammo colour instead of an unrelated map image.
    const heroTheme = selectedWeaponId ? getWeaponTagTheme(selectedWeaponId, 'user') : null;
    const heroAccent = heroTheme?.themeColor || heroTheme?.color || '#8899aa';
    const heroBackground = `linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 55%, color-mix(in srgb, ${heroAccent} 55%, rgba(0,0,0,0.6)) 100%)`;

    type PairSortCol = 'name' | 'games' | 'winRate' | 'avgPlacement' | 'kd' | 'kda';
    type LegendSortCol = 'name' | 'games' | 'winRate' | 'avgPlacement' | 'kd' | 'kda';
    const [pairSort, setPairSort] = useState<TableSortState<PairSortCol>>(createDefaultTableSort);
    const [legendSort, setLegendSort] = useState<TableSortState<LegendSortCol>>(createDefaultTableSort);
    const sortedPairs = useMemo(
        () => applyTableSort(pairedWeapons, pairSort, {
            name: (a, b) => compareWeaponDbOrder(a.id, b.id),
            games: (a, b) => compareNumbers(a.games, b.games),
            winRate: (a, b) => compareNumericStrings(a.winRate, b.winRate),
            avgPlacement: (a, b) => compareAvgPlacement(a.avgPlacement, b.avgPlacement),
            kd: (a, b) => compareNumbers(a.kd ?? -1, b.kd ?? -1),
            kda: (a, b) => compareNumbers(a.kda ?? -1, b.kda ?? -1),
        }, {
            isMissing: {
                winRate: (w) => !w.hasWinRate,
                avgPlacement: (w) => !w.hasWinRate,
                kd: (w) => !w.hasKd,
                kda: (w) => !w.hasKd,
            },
        }),
        [pairedWeapons, pairSort],
    );
    const sortedLegends = useMemo(
        () => applyTableSort(weaponLegends, legendSort, {
            name: (a, b) => compareStrings(a.name, b.name),
            games: (a, b) => compareNumbers(a.games, b.games),
            winRate: (a, b) => compareNumericStrings(a.winRate, b.winRate),
            avgPlacement: (a, b) => compareAvgPlacement(a.avgPlacement, b.avgPlacement),
            kd: (a, b) => compareNumbers(a.kd ?? -1, b.kd ?? -1),
            kda: (a, b) => compareNumbers(a.kda ?? -1, b.kda ?? -1),
        }, {
            isMissing: {
                kd: (leg) => !leg.hasKd,
                kda: (leg) => !leg.hasKd,
            },
        }),
        [weaponLegends, legendSort],
    );
    const breakdownSubtitle = t('statistics.weapons.breakdownSubtitle', { weapon: selectedName });

    return (
        <div style={{ animation: STATS_VIEW_ANIMATION }}>
            {/* Season-wide quick picks — the selector row, like the map chips on Maps. */}
            <StatsTwoColumnGrid marginBottom="20px">
                <OverviewRankSection title={t('statistics.weapons.topWeapons')}>
                    {topWeapons.length > 0 ? (
                        <OverviewRankCardRow>
                            {topWeapons.map((w, i) => (
                                <OverviewRankCard key={w.id} rank={i} id={w.id} name={w.name} media="weapon" onClick={() => setSelectedWeaponId(w.id)}>
                                    <MapOverviewTopCardStat label={t('statistics.weapons.matches')} value={w.usageLabel} />
                                    <MapOverviewTopCardStat label={t('statistics.weapons.kd')} value={formatWeaponKd(w.kd, w.hasKd, t('statistics.common.na'))} color={getKdColor(w.hasKd ? w.kd : null)} />
                                    <MapOverviewTopCardStat label={t('statistics.weapons.winPercent')} value={formatWeaponWinRate(w.winRate, w.hasWinRate)} color={getWinRateColor(w.winRate, { hasValue: w.hasWinRate })} />
                                </OverviewRankCard>
                            ))}
                        </OverviewRankCardRow>
                    ) : (
                        <OverviewRankEmpty msg={t('statistics.weapons.noWeaponData')} />
                    )}
                </OverviewRankSection>

                <OverviewRankSection title={t('statistics.weapons.topThreats')}>
                    {threatWeapons.length > 0 ? (
                        <OverviewRankCardRow>
                            {threatWeapons.map((w, i) => (
                                <OverviewRankCard key={w.id} rank={i} id={w.id} name={w.name} media="weapon" onClick={() => setSelectedWeaponId(w.id)}>
                                    <MapOverviewTopCardStat label={t('statistics.weapons.threatKills')} value={w.kills} color="var(--color-danger)" />
                                    <MapOverviewTopCardStat label={t('statistics.weapons.threatKnockdowns')} value={w.knockdowns} color="var(--color-rank-first)" />
                                </OverviewRankCard>
                            ))}
                        </OverviewRankCardRow>
                    ) : (
                        <OverviewRankEmpty msg={t('statistics.weapons.noThreatData')} />
                    )}
                </OverviewRankSection>
            </StatsTwoColumnGrid>

            <StatsCard>
                <CatalogHero
                    eyebrow={t('statistics.weapons.overview')}
                    title={selectedName}
                    background={heroBackground}
                    media={<CatalogHeroMedia kind="weapon" src={selectedWeaponId ? getWeaponImageUrl(selectedWeaponId) : null} alt={selectedName} />}
                    renderTrigger={(content) => (
                        <CatalogPickerDropdown items={weaponPickerItems} selectedId={selectedWeaponId} onSelect={setSelectedWeaponId} media="weapon">
                            {content}
                        </CatalogPickerDropdown>
                    )}
                />

                {selectedStat ? (
                    <>
                        <OverviewStatStrip padding="20px 24px">
                            <MapOverviewStat label={t('statistics.weapons.matches')} value={selectedStat.usageLabel} />
                            <MapOverviewStat label={t('statistics.weapons.winRate')} value={formatWeaponWinRate(selectedStat.winRate, selectedStat.hasWinRate)} color={getWinRateColor(selectedStat.winRate, { hasValue: selectedStat.hasWinRate })} />
                            <MapOverviewStat label={t('statistics.common.avgPlacementShort')} value={selectedStat.hasWinRate ? `#${selectedStat.avgPlacement}` : '-'} color={selectedStat.hasWinRate ? getAvgPlacementColor(selectedStat.avgPlacement) : undefined} />
                            <StatStripDivider />
                            <MapOverviewStat label={t('statistics.weapons.kd')} value={formatWeaponKd(selectedStat.kd, selectedStat.hasKd, t('statistics.common.na'))} color={getKdColor(selectedStat.hasKd ? selectedStat.kd : null)} />
                            <MapOverviewStat label={t('statistics.weapons.kad')} value={formatWeaponKd(selectedStat.kda, selectedStat.hasKd, t('statistics.common.na'))} color={getKadColor(selectedStat.hasKd ? selectedStat.kda : null)} />
                        </OverviewStatStrip>

                        <StatsTwoColumnGrid padding="20px 24px 24px">
                            <OverviewRankSection title={t('statistics.weapons.pairedWeapons')}>
                                {topPaired.length > 0 ? (
                                    <OverviewRankCardRow>
                                        {topPaired.map((w, i) => (
                                            <OverviewRankCard key={w.id} rank={i} id={w.id} name={w.name} media="weapon" onClick={() => setSelectedWeaponId(w.id)}>
                                                <MapOverviewTopCardStat label={t('statistics.weapons.matches')} value={w.games} />
                                                <MapOverviewTopCardStat label={t('statistics.weapons.kd')} value={formatWeaponKd(w.kd, w.hasKd, t('statistics.common.na'))} color={getKdColor(w.hasKd ? w.kd : null)} />
                                            </OverviewRankCard>
                                        ))}
                                    </OverviewRankCardRow>
                                ) : (
                                    <OverviewRankEmpty msg={t('statistics.weapons.noPairedData')} />
                                )}
                            </OverviewRankSection>

                            <OverviewRankSection title={t('statistics.weapons.weaponLegends')}>
                                {topWeaponLegends.length > 0 ? (
                                    <OverviewRankCardRow>
                                        {topWeaponLegends.map((leg, i) => (
                                            <OverviewRankCard key={leg.id} rank={i} id={leg.id} name={leg.name} media="legend" onClick={nav ? () => nav.openLegend(leg.id) : undefined}>
                                                <MapOverviewTopCardStat label={t('statistics.weapons.matches')} value={leg.games} />
                                                <MapOverviewTopCardStat label={t('statistics.weapons.kd')} value={formatWeaponKd(leg.kd, leg.hasKd, t('statistics.common.na'))} color={getKdColor(leg.hasKd ? leg.kd : null)} />
                                            </OverviewRankCard>
                                        ))}
                                    </OverviewRankCardRow>
                                ) : (
                                    <OverviewRankEmpty msg={t('statistics.weapons.noLegendData')} />
                                )}
                            </OverviewRankSection>
                        </StatsTwoColumnGrid>
                    </>
                ) : (
                    <PanelEmpty
                        msg={selectedWeaponId
                            ? t('statistics.weapons.noMatchesFound', { weapon: selectedName })
                            : selectWeaponPrompt}
                    />
                )}
            </StatsCard>

            {selectedStat ? (
                <StatsTwoColumnGrid alignItems="start">
                    <BreakdownPanel
                        title={t('statistics.weapons.pairedWeapons')}
                        subtitle={breakdownSubtitle}
                        isEmpty={pairedWeapons.length === 0}
                        emptyMsg={t('statistics.weapons.noPairedData')}
                    >
                        <table style={catalogPairTableStyle}>
                            <CatalogPairColgroup />
                            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>#</th>
                                    <SortableTh column="name" sortState={pairSort} onSort={(col) => setPairSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'left' }}>
                                        {t('statistics.weapons.weapon')}
                                    </SortableTh>
                                    <SortableTh column="games" sortState={pairSort} onSort={(col) => setPairSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.matches')}
                                    </SortableTh>
                                    <SortableTh column="winRate" sortState={pairSort} onSort={(col) => setPairSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.winPercent')}
                                    </SortableTh>
                                    <SortableTh column="avgPlacement" sortState={pairSort} onSort={(col) => setPairSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }} title={t('statistics.common.avgPlacement')}>
                                        {t('statistics.common.avgPlacementShort')}
                                    </SortableTh>
                                    <SortableTh column="kd" sortState={pairSort} onSort={(col) => setPairSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.kd')}
                                    </SortableTh>
                                    <SortableTh column="kda" sortState={pairSort} onSort={(col) => setPairSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.kad')}
                                    </SortableTh>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPairs.map((w, i) => (
                                    <tr key={w.id} className="stats-table-row" style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }}>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>{i + 1}</td>
                                        <td style={mapBreakdownLegendBodyCellStyle}>
                                            <div style={{ ...mapBreakdownLegendInnerStyle, alignItems: 'center' }}>
                                                <div style={catalogPairMediaSlotStyle}>
                                                    <WeaponTableIcon weaponId={w.id} name={w.name} width={40} height={20} />
                                                </div>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={w.name}>{w.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-dim)' }}>{w.games}</td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getWinRateColor(w.winRate, { hasValue: w.hasWinRate }) }}>{formatWeaponWinRate(w.winRate, w.hasWinRate)}</td>
                                        <AvgPlacementCell value={w.avgPlacement} padding="10px 12px" />
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getKdColor(w.hasKd ? w.kd : null) }}>{formatWeaponKd(w.kd, w.hasKd, t('statistics.common.na'))}</td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getKadColor(w.hasKd ? w.kda : null) }}>{formatWeaponKd(w.kda, w.hasKd, t('statistics.common.na'))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </BreakdownPanel>

                    <BreakdownPanel
                        title={t('statistics.weapons.weaponLegends')}
                        subtitle={breakdownSubtitle}
                        isEmpty={weaponLegends.length === 0}
                        emptyMsg={t('statistics.weapons.noLegendData')}
                    >
                        <table style={catalogPairTableStyle}>
                            <CatalogPairColgroup />
                            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>#</th>
                                    <SortableTh column="name" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'left' }}>
                                        {t('statistics.maps.legendColumn')}
                                    </SortableTh>
                                    <SortableTh column="games" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.matches')}
                                    </SortableTh>
                                    <SortableTh column="winRate" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.winPercent')}
                                    </SortableTh>
                                    <SortableTh column="avgPlacement" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }} title={t('statistics.common.avgPlacement')}>
                                        {t('statistics.common.avgPlacementShort')}
                                    </SortableTh>
                                    <SortableTh column="kd" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.kd')}
                                    </SortableTh>
                                    <SortableTh column="kda" sortState={legendSort} onSort={(col) => setLegendSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mapBreakdownHeadCellStyle, textAlign: 'center' }}>
                                        {t('statistics.weapons.kad')}
                                    </SortableTh>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedLegends.map((leg, i) => (
                                    <tr key={leg.id} className="stats-table-row" style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }}>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>{i + 1}</td>
                                        <td style={mapBreakdownLegendBodyCellStyle}>
                                            <div style={{ ...mapBreakdownLegendInnerStyle, alignItems: 'center' }}>
                                                <img
                                                    src={`${MAP_IMAGE_BASE}${leg.id}.png`}
                                                    alt={leg.name}
                                                    style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                                    onError={(e) => { e.currentTarget.src = `${MAP_IMAGE_BASE}unknown.png`; }}
                                                />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={leg.name}>{leg.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', color: 'var(--color-text-dim)' }}>{leg.games}</td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getWinRateColor(leg.winRate) }}>{leg.winRate}%</td>
                                        <AvgPlacementCell value={leg.avgPlacement} padding="10px 12px" />
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getKdColor(leg.hasKd ? leg.kd : null) }}>{formatWeaponKd(leg.kd, leg.hasKd, t('statistics.common.na'))}</td>
                                        <td style={{ ...mapBreakdownBodyCellStyle, textAlign: 'center', fontWeight: 'bold', color: getKadColor(leg.hasKd ? leg.kda : null) }}>{formatWeaponKd(leg.kda, leg.hasKd, t('statistics.common.na'))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </BreakdownPanel>
                </StatsTwoColumnGrid>
            ) : null}
        </div>
    );
};

const TeammatesView = ({ data, profileUid, profileName }: { data: MatchHistory[]; profileUid?: string | null; profileName?: string | null }) => {
    const { t } = useTranslation();
    const compact = useStatsCompact();
    type TeammateSortCol = 'name' | 'games' | 'winRate' | 'kd' | 'kda' | 'avgPlacement' | 'avgDamage';
    const [teammateSort, setTeammateSort] = useState<TableSortState<TeammateSortCol>>(createDefaultTableSort);
    const teammateStats = useMemo(() => {
        const isSelfTeammate = (
            tm: { uid?: string | null; name?: string },
            matchPlayerName?: string
        ) => {
            if (profileUid && tm.uid && String(tm.uid) === String(profileUid)) return true;
            if (profileName && tm.name && isSamePlayer(tm.name, profileName)) return true;
            if (matchPlayerName && tm.name && isSamePlayer(tm.name, matchPlayerName)) return true;
            return false;
        };
        const map: Record<string, TeammateMatchStat & { legendCounts: Record<string, number> }> = {};

        data.forEach(m => {
            if (!hasUsableMatchStats(m)) return;
            const teamStats = m.teamStats;
            if (!teamStats?.length) return;

            const matchPlayerName = m.playerName;
            const isWin = m.placement === 1;
            const matchKills = m.kills || 0;
            const matchAssists = m.assists || 0;
            const matchDeath = getMatchDeaths(m);
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
                // Keep name-only rows in aggregation above; hide them from the list.
                if (!tm.uid) return false;
                return true;
            })
            .slice(0, 30);
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
            src={`/images/${legend}.png`}
            alt={legend}
            style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%', flexShrink: 0 }}
            onError={(e) => {
                e.currentTarget.src = '/images/unknown.png';
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
                            background: STATS_SUBTLE_TILE_BG,
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

    const disclaimer = (
        <div style={{ marginBottom: '20px', padding: '10px 14px', borderRadius: '8px', background: STATS_SUBTLE_TILE_BG, border: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {t('statistics.teammates.statsDisclaimer')}
        </div>
    );

    // One empty state for the whole tab (cards + table would otherwise both say "no data").
    if (teammateStats.length === 0) {
        return (
            <div style={{ animation: STATS_VIEW_ANIMATION }}>
                {disclaimer}
                <EmptyState msg={t('statistics.teammates.noTeammateData')} />
            </div>
        );
    }

    return (
        <div style={{ animation: STATS_VIEW_ANIMATION }}>
            <style>{MARQUEE_OVERFLOW_KEYFRAMES}</style>
            {disclaimer}
            <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))', gap: '20px', marginBottom: '24px', alignItems: 'stretch' }}>
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
                        <div style={{ height: '24px', marginBottom: '10px', minWidth: 0 }} title={tm.uid ?? undefined}>
                            <MarqueeOverflowText
                                text={tm.name}
                                textStyle={{
                                    fontSize: '18px',
                                    fontWeight: 900,
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-primary)', textAlign: 'center', marginBottom: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {t('statistics.teammates.teammatePicks')}
                        </div>
                        <div style={{ height: '88px', background: 'color-mix(in srgb, var(--color-bg-deep) 70%, transparent)', borderRadius: '8px', marginBottom: '14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                            {renderLegendPodium(tm.topLegends)}
                        </div>
                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '10px' }}>
                                {t('statistics.teammates.myStatsWhenTogether')}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '4px', fontSize: '12px' }}>
                            {renderStatCell(t('statistics.teammates.matches'), tm.games)}
                            {renderStatCell(t('statistics.teammates.kd'), tm.kd, {
                                valueStyle: { color: getKdColor(tm.kd) },
                                showDelta,
                                delta: overallBaseline ? tm.kd - overallBaseline.kd : undefined,
                                deltaDigits: 2,
                            })}
                            {renderStatCell(t('statistics.teammates.kad'), tm.kda, {
                                valueStyle: { color: getKadColor(tm.kda) },
                                showDelta,
                                delta: overallBaseline ? tm.kda - overallBaseline.kda : undefined,
                                deltaDigits: 2,
                            })}
                            {renderStatCell(t('statistics.teammates.winPercent'), `${tm.winRate}%`, {
                                valueStyle: { color: getWinRateColor(tmWinRate) },
                                showDelta,
                                delta: overallBaseline ? tmWinRate - overallBaseline.winRate : undefined,
                                deltaDigits: 1,
                                deltaSuffix: '%p',
                            })}
                            {renderStatCell(t('statistics.teammates.avgDamageShort'), tm.avgDamage, {
                                valueStyle: { color: getAvgDamageColor(tm.avgDamage) },
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
            </div>

            <BreakdownPanel
                title={t('statistics.teammates.detailedStatsTitle')}
                subtitle={t('statistics.teammates.teammatePicksHint')}
                isEmpty={false}
                emptyMsg={t('statistics.teammates.noTeammateData')}
            >
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
                                <th style={{ ...mainTableHeadCellStyle, width: '50px', textAlign: 'center' }}>{t('statistics.teammates.rank')}</th>
                                <SortableTh column="name" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={mainTableHeadCellStyle}>
                                    {t('statistics.teammates.teammate')}
                                </SortableTh>
                                <SortableTh column="games" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center', borderLeft: '2px solid var(--color-border)' }}>
                                    {t('statistics.teammates.matches')}
                                </SortableTh>
                                <SortableTh column="winRate" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.teammates.winRate')}
                                </SortableTh>
                                <SortableTh column="kd" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.teammates.kd')}
                                </SortableTh>
                                <SortableTh column="kda" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }}>
                                    {t('statistics.teammates.kad')}
                                    <span
                                        title={t('statistics.teammates.kadTooltip')}
                                        style={{ cursor: 'help', marginLeft: '4px', display: 'inline-block', verticalAlign: 'middle' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <FaInfoCircle size={12} color="var(--color-text-muted)" />
                                    </span>
                                </SortableTh>
                                <SortableTh column="avgPlacement" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center' }} title={t('statistics.common.avgPlacement')}>
                                    {t('statistics.common.avgPlacementShort')}
                                </SortableTh>
                                <SortableTh column="avgDamage" sortState={teammateSort} onSort={(col) => setTeammateSort((prev) => toggleCatalogNameTableSort(prev, col))} style={{ ...mainTableHeadCellStyle, textAlign: 'center', whiteSpace: 'nowrap' }} title={t('statistics.teammates.avgDamage')}>
                                    {t('statistics.teammates.avgDamageShort')}
                                </SortableTh>
                            </tr>
                        </thead>
                        <tbody>
                            {overallBaseline && (
                                <tr style={{ background: `color-mix(in srgb, ${STATS_INFO_BLUE} 8%, transparent)`, borderBottom: '2px solid var(--color-border)' }}>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>—</td>
                                    <td style={{ padding: '12px 20px', fontWeight: 'bold', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                                        {t('statistics.teammates.overallBaselineRowLabel')}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', color: 'var(--color-text-dim)', fontWeight: 'bold', borderLeft: '2px solid var(--color-border)' }}>
                                        {overallBaseline.games}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: getWinRateColor(overallBaseline.winRate) }}>
                                        {overallBaseline.winRate.toFixed(1)}%
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: getKdColor(overallBaseline.kd) }}>
                                        {overallBaseline.kd.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: getKadColor(overallBaseline.kda) }}>
                                        {overallBaseline.kda.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: getAvgPlacementColor(overallBaseline.avgPlacement) }}>
                                        #{overallBaseline.avgPlacement.toFixed(1)}
                                    </td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: getAvgDamageColor(overallBaseline.avgDamage) }}>
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
                                <tr key={tm.id} className="stats-table-row" style={{ borderBottom: '1px solid var(--color-bg-card-hover)' }}>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', color: 'var(--color-text-faint)', fontWeight: 'bold' }}>{i + 1}</td>
                                    <td style={{ padding: '12px 20px', maxWidth: '200px' }} title={tm.uid ?? undefined}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                            {renderAvatar(tm.legend, 32)}
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ height: '18px' }}>
                                                    <MarqueeOverflowText
                                                        text={tm.name}
                                                        textStyle={{ fontWeight: 'bold', color: 'var(--color-text-dim)' }}
                                                    />
                                                </div>
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
                                        valueStyle: { color: getWinRateColor(tmWinRate) },
                                    })}
                                    {renderTableStatWithComparison(tm.kd, {
                                        showDelta,
                                        delta: overallBaseline ? tmKd - overallBaseline.kd : undefined,
                                        deltaDigits: 2,
                                        valueStyle: { color: getKdColor(tm.kd) },
                                    })}
                                    {renderTableStatWithComparison(tm.kda, {
                                        showDelta,
                                        delta: overallBaseline ? tmKda - overallBaseline.kda : undefined,
                                        deltaDigits: 2,
                                        valueStyle: { color: getKadColor(tm.kda) },
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
                                        valueStyle: { color: getAvgDamageColor(tm.avgDamage) },
                                    })}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
            </BreakdownPanel>
        </div>
    );
};

/**
 * Whole-season view: player_season_stats stays one row per split, so the client fetches
 * every started split of the selected season and merges the match lists (no DB change).
 */
const mergeSplitMatches = (lists: MatchHistory[][]): MatchHistory[] => {
    const seen = new Set<string>();
    const out: MatchHistory[] = [];
    for (const list of lists) {
        for (const m of list) {
            const id = (m as { matchId?: string }).matchId;
            if (id) {
                if (seen.has(String(id))) continue;
                seen.add(String(id));
            }
            out.push(m);
        }
    }
    const time = (m: MatchHistory) => m.startTime || m.endTime || 0;
    return out.sort((a, b) => time(b) - time(a));
};

interface StatisticsTabProps {
    isPremium: boolean;
    selectedSeasonId: number;
    seasons: Season[];
    profileUid?: string | null;
    profileName?: string | null;
    statsRefreshToken?: number;
    /** Web: Overview content only — no MAPS/LEGENDS/… tabs or premium locks. */
    overviewOnly?: boolean;
    /** First-run sample profile: use these instead of the server season stats. */
    demoMatches?: Match[] | null;
    /** Controlled BR mode (desktop shares it with Match History); hides the in-tab mode filter. */
    mode?: StatisticsMode;
    /** Season picker "Whole season": merge every started split of the selected season. */
    wholeSeason?: boolean;
}

const StatisticsTab: React.FC<StatisticsTabProps> = ({
    isPremium,
    selectedSeasonId,
    seasons,
    profileUid,
    profileName,
    statsRefreshToken = 0,
    overviewOnly = false,
    demoMatches = null,
    mode,
    wholeSeason = false,
}) => {
    const { t } = useTranslation();
    const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'MAPS' | 'LEGENDS' | 'WEAPONS' | 'TEAMMATES'>('OVERVIEW');
    const [internalMode, setSelectedMode] = useState<StatisticsMode>('ALL');
    const isModeControlled = mode !== undefined;
    const selectedMode = mode ?? internalMode;
    const [serverMatches, setServerMatches] = useState<MatchHistory[]>([]);
    const [serverMatchCount, setServerMatchCount] = useState(0);
    const [serverStatsLoading, setServerStatsLoading] = useState(false);
    const statsRootRef = useRef<HTMLDivElement>(null);
    const [compactStats, setCompactStats] = useState(false);

    useLayoutEffect(() => {
        const el = statsRootRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;

        const update = (width: number) => {
            setCompactStats((prev) => (prev ? width < STATS_COMPACT_EXIT : width < STATS_COMPACT_ENTER));
        };
        update(el.clientWidth);

        const observer = new ResizeObserver((entries) => {
            const box = entries[0]?.borderBoxSize?.[0];
            update(box ? box.inlineSize : el.clientWidth);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const TAB_LABELS: Record<string, string> = {
        OVERVIEW: t('statistics.tabs.overview'),
        MAPS: t('statistics.tabs.maps'),
        LEGENDS: t('statistics.tabs.legends'),
        WEAPONS: t('statistics.tabs.weapons'),
        TEAMMATES: t('statistics.tabs.teammates'),
    };

    const statsNav = useMemo<StatsNavigation>(() => ({
        openLegend: (legendId: string) => {
            setSessionCatalogId('legend', legendId);
            setActiveSubTab('LEGENDS');
            statsRootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        },
        openWeapon: (weaponId: string) => {
            setSessionCatalogId('weapon', weaponId);
            setActiveSubTab('WEAPONS');
            statsRootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        },
    }), []);

    const MODE_LABELS: Record<string, string> = {
        ALL: t('statistics.modes.all'),
        RANKED: t('statistics.modes.ranked'),
        TRIO: t('statistics.modes.trio'),
        DUO: t('statistics.modes.duo'),
    };

    const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
    const seasonNumber = parseSeasonNumber(selectedSeason?.name);
    /** Started splits of the selected season, oldest first. */
    const seasonSplits = useMemo(() => (
        seasonNumber == null
            ? []
            : getSelectableSeasons(seasons)
                .filter((s) => parseSeasonNumber(s.name) === seasonNumber)
                .reverse()
    ), [seasons, seasonNumber]);
    const canMergeSeason = seasonSplits.length > 1 && !demoMatches;
    const mergeActive = wholeSeason && canMergeSeason;
    const fetchSeasonKey = (mergeActive ? seasonSplits.map((s) => s.id) : [selectedSeasonId]).join(',');
    const wholeSeasonName = t('statistics.wholeSeasonName', { season: seasonNumber ?? '', defaultValue: 'Season {{season}} · All splits' });

    /** Seasons as the Overview sees them: in whole-season mode the splits collapse into one entry. */
    const viewSeasons = useMemo<Season[]>(() => {
        if (!mergeActive || !selectedSeason) return seasons;
        const ids = new Set(seasonSplits.map((s) => s.id));
        const last = seasonSplits[seasonSplits.length - 1];
        const merged: Season = {
            ...selectedSeason,
            name: wholeSeasonName,
            startTime: seasonSplits[0].startTime,
            endTime: resolveSeasonEndMs(seasons, last.id),
        };
        return seasons
            .filter((s) => !ids.has(s.id) || s.id === selectedSeasonId)
            .map((s) => (s.id === selectedSeasonId ? merged : s));
    }, [mergeActive, selectedSeason, seasons, seasonSplits, selectedSeasonId, wholeSeasonName]);

    // Request inputs changed: reset / start the spinner during render; the effect below only fetches.
    // `undefined` first so the initial render applies it too (as the effect used to on mount).
    const statsRequestKey = demoMatches
        ? 'demo'
        : profileUid ? `${profileUid}|${fetchSeasonKey}|${selectedMode}|${statsRefreshToken}` : null;
    const [shownStatsKey, setShownStatsKey] = useState<string | null | undefined>(undefined);
    if (shownStatsKey !== statsRequestKey) {
        setShownStatsKey(statsRequestKey);
        if (statsRequestKey === null) {
            setServerMatches([]);
            setServerMatchCount(0);
        } else if (statsRequestKey !== 'demo') {
            setServerStatsLoading(true);
        }
    }

    useEffect(() => {
        if (demoMatches || !profileUid) return;

        let cancelled = false;
        const ids = fetchSeasonKey.split(',').map(Number);
        Promise.all(ids.map((id) => fetchPlayerStats(profileUid, id, selectedMode)))
            .then((responses) => {
                if (cancelled) return;
                const ok = responses.filter((r): r is NonNullable<typeof r> => Boolean(r));
                if (ok.length === 0) {
                    setServerMatchCount(0);
                    setServerMatches([]);
                    return;
                }
                setServerMatchCount(ok.reduce((sum, r) => sum + (r.match_count ?? 0), 0));
                setServerMatches(mergeSplitMatches(
                    ok.map((r) => normalizeHistoryForFrontend(r.payload?.matches ?? []) as MatchHistory[]),
                ));
            })
            .catch(() => {
                if (cancelled) return;
                setServerMatchCount(0);
                setServerMatches([]);
            })
            .finally(() => {
                if (!cancelled) setServerStatsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [profileUid, fetchSeasonKey, selectedMode, statsRefreshToken, demoMatches]);

    const demoPicked = useMemo(
        () => (demoMatches ? filterDemoMatchesByMode(demoMatches, selectedMode) as unknown as MatchHistory[] : null),
        [demoMatches, selectedMode],
    );
    const matchCount = demoPicked ? demoPicked.length : serverMatchCount;
    const statsLoading = !demoPicked && serverStatsLoading;

    const statsHistory = useMemo(
        () => (demoPicked ?? serverMatches).filter(m => isKnownLegend(m.legend)),
        [demoPicked, serverMatches],
    );

    const renderContent = () => {
        if (statsLoading) {
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

        const isContentLocked = !overviewOnly && !isPremium && activeSubTab !== 'OVERVIEW';

        const lockCopy: Record<string, { headline: string; bullets: string[] }> = {
            MAPS: {
                headline: t('statistics.premiumLock.mapsHeadline', { defaultValue: 'See which maps you win — and lose — on' }),
                bullets: [
                    t('statistics.premiumLock.mapsB1', { defaultValue: 'Avg damage, placement and K/D per map' }),
                    t('statistics.premiumLock.mapsB2', { defaultValue: 'Your top legends, weapons and teammate picks on each map' }),
                ],
            },
            LEGENDS: {
                headline: t('statistics.premiumLock.legendsHeadline', { defaultValue: 'Find the legends that actually fit you' }),
                bullets: [
                    t('statistics.premiumLock.legendsB1', { defaultValue: 'Win rate, damage and placement per legend' }),
                    t('statistics.premiumLock.legendsB2', { defaultValue: 'Ranked by your own results, not pick rate' }),
                ],
            },
            WEAPONS: {
                headline: t('statistics.premiumLock.weaponsHeadline', { defaultValue: 'Know which guns carry your games' }),
                bullets: [
                    t('statistics.premiumLock.weaponsB1', { defaultValue: 'Kills, K/D and win rate per weapon and pairing' }),
                    t('statistics.premiumLock.weaponsB2', { defaultValue: 'Which weapons you die to most' }),
                ],
            },
            TEAMMATES: {
                headline: t('statistics.premiumLock.teammatesHeadline', { defaultValue: 'See who you play best with' }),
                bullets: [
                    t('statistics.premiumLock.teammatesB1', { defaultValue: 'Placement and win rate with each teammate' }),
                    t('statistics.premiumLock.teammatesB2', { defaultValue: 'Your K/D and damage with each teammate vs your average' }),
                ],
            },
        };

        // One free row of the user's own data — the hook for the locked tab.
        let teaser: PremiumTeaser | null = null;
        if (isContentLocked && (activeSubTab === 'MAPS' || activeSubTab === 'LEGENDS')) {
            const top = activeSubTab === 'MAPS'
                ? aggregateMapStatsForMatches(statsHistory)[0]
                : aggregateLegendStatsForMatches(statsHistory)[0];
            if (top && top.games >= 3) {
                teaser = {
                    label: activeSubTab === 'MAPS'
                        ? t('statistics.premiumLock.bestMap', { defaultValue: 'Your best map' })
                        : t('statistics.premiumLock.bestLegend', { defaultValue: 'Your best legend' }),
                    name: activeSubTab === 'MAPS' ? normalizeMapDisplayName(top.name) : top.name,
                    stats: [
                        `${t('statistics.premiumLock.avgDamage', { defaultValue: 'Avg dmg' })} ${top.avgDamage.toLocaleString()}`,
                        `${t('statistics.premiumLock.avgPlace', { defaultValue: 'Avg place' })} #${top.avgPlacement}`,
                        t('statistics.premiumLock.games', { count: top.games, defaultValue: '{{count}} games' }),
                    ],
                };
            }
        }

        const overviewContent = (
            <OverviewView
                data={statsHistory}
                isPremium={isPremium}
                showRankProgress={selectedMode === 'ALL' || selectedMode === 'RANKED'}
                profileUid={profileUid}
                selectedSeasonId={selectedSeasonId}
                seasons={viewSeasons}
                wholeSeason={wholeSeason}
            />
        );

        if (overviewOnly) {
            return overviewContent;
        }

        let content: React.ReactNode;
        switch (activeSubTab) {
            case 'OVERVIEW': content = overviewContent; break;
            case 'MAPS': content = <MapsView data={statsHistory} profileUid={profileUid} profileName={profileName} />; break;
            case 'LEGENDS': content = <LegendsView data={statsHistory} profileUid={profileUid} profileName={profileName} />; break;
            case 'WEAPONS': content = <WeaponsView data={statsHistory} />; break;
            case 'TEAMMATES': content = <TeammatesView data={statsHistory} profileUid={profileUid} profileName={profileName} />; break;
            default: content = null;
        }

        return (
            <PremiumBlurGate
                locked={isContentLocked}
                headline={lockCopy[activeSubTab]?.headline}
                bullets={lockCopy[activeSubTab]?.bullets}
                teaser={teaser}
            >
                {content}
            </PremiumBlurGate>
        );
    };

    return (
        <StatsCompactContext.Provider value={compactStats}>
        <StatsNavContext.Provider value={statsNav}>
        <div ref={statsRootRef} className="stats-root" data-catalog-bounds="content" style={{ paddingBottom: '40px', color: 'var(--color-text-primary)' }}>
            <style>{STATS_SHARED_CSS}</style>
            {/* Tabs stay one scrollable row; mode filters wrap to a clean 2nd row when narrow.
                Desktop passes `mode`: the filter lives in the shared Records bar, so only the
                secondary (underline) sub-tabs remain here. */}
            {!(overviewOnly && isModeControlled) && (
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: isModeControlled ? 'flex-end' : 'center',
                    justifyContent: overviewOnly ? 'flex-end' : 'space-between',
                    rowGap: '10px',
                    columnGap: '12px',
                    marginBottom: isModeControlled ? '16px' : '25px',
                    borderBottom: isModeControlled ? '1px solid var(--color-border)' : '2px solid var(--color-border)',
                    paddingBottom: isModeControlled ? 0 : '15px',
                    minWidth: 0,
                }}
            >
                <style>{`
                    .stats-subtab-scroll {
                        scrollbar-width: thin;
                        scrollbar-color: color-mix(in srgb, var(--color-border-light) 70%, transparent) transparent;
                    }
                    .stats-subtab-scroll::-webkit-scrollbar { height: 4px; }
                    .stats-subtab-scroll::-webkit-scrollbar-thumb {
                        background: color-mix(in srgb, var(--color-border-light) 70%, transparent);
                        border-radius: 4px;
                    }
                `}</style>
                {!overviewOnly && (
                <div
                    className="stats-subtab-scroll"
                    style={{
                        display: 'flex',
                        gap: '5px',
                        flexWrap: 'nowrap',
                        minWidth: 0,
                        flex: '1 1 320px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        paddingBottom: isModeControlled ? 0 : '2px',
                        marginBottom: isModeControlled ? -1 : 0,
                    }}
                >
                    {(['OVERVIEW', 'MAPS', 'LEGENDS', 'WEAPONS', 'TEAMMATES'] as const).map(tab => {
                        const isActive = activeSubTab === tab;
                        const isLocked = !isPremium && tab !== 'OVERVIEW';
                        return (
                            <button
                                key={tab}
                                className="btn-tab"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setActiveSubTab(tab)}
                                style={isModeControlled ? {
                                    // Secondary nav under the Records segmented control: underline tabs.
                                    padding: '8px 14px',
                                    background: 'transparent',
                                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-faint)',
                                    border: 'none',
                                    borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                                    borderRadius: 0,
                                    fontSize: '13px',
                                    fontWeight: 'bold', cursor: 'pointer', transition: '0.2s',
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    outline: 'none', boxShadow: 'none',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                } : {
                                    padding: '8px 16px',
                                    background: isActive ? 'var(--color-accent)' : 'transparent',
                                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                    border: 'none', borderRadius: '4px',
                                    fontWeight: 'bold', cursor: 'pointer', transition: '0.2s',
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    outline: 'none', boxShadow: 'none',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {TAB_LABELS[tab]}
                                {isLocked && (
                                    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.04em', color: isActive && !isModeControlled ? 'var(--color-text-primary)' : 'var(--color-rank-first)', flexShrink: 0 }}>PRO</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                )}

                {!isModeControlled && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: '0 0 auto', marginLeft: overviewOnly ? 0 : 'auto' }}>
                    <div style={{ display: 'flex', gap: '5px', background: 'var(--color-bg-deep)', padding: '4px', borderRadius: '6px', flexShrink: 0 }}>
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
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                }}
                            >
                                {MODE_LABELS[mode]}
                            </button>
                        ))}
                    </div>
                </div>
                )}
            </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px', color: 'var(--color-text-faint)', fontSize: '11px', fontStyle: 'italic', gap: '5px', alignItems: 'center' }}>
                <FaHistory /> {t('statistics.showingStatsFor')} <span style={{ color: COLORS.NEON_ORANGE, fontWeight: 'bold' }}>{wholeSeason ? wholeSeasonName : selectedSeason?.name}</span> ({selectedMode === 'ALL' ? t('statistics.allBrModes') : MODE_LABELS[selectedMode]})
                {statsLoading && <FaSync className="spin-animation" size={10} />}
                {!statsLoading && matchCount > 0 && (
                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'normal' }}>
                        · {matchCount.toLocaleString()} {t('statistics.serverMatchCount', { defaultValue: 'matches' })}
                    </span>
                )}
            </div>

            {renderContent()}
        </div>
        </StatsNavContext.Provider>
        </StatsCompactContext.Provider>
    );
};

export default StatisticsTab;
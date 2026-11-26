import { forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import {
    getCssPos,
    getRankColor,
    normalizeMapDisplayName,
} from '../utils/helpers';
import { groundPathPoints } from '../utils/groundPath';
import { buildShareRings } from '../utils/shareRings';
import type { PlaystyleKey } from '../utils/playstyle';
import { PLAYSTYLE_VISUALS } from '../utils/playstyle';
import { getWeaponCardBackground, getWeaponDisplayName } from '../utils/weaponTheme';
import type { WeaponCombatEntry } from '../types';
import { APEXTRACE_LOGO } from '../utils/tierTableData';

export const SHARE_CARD_WIDTH = 760;
export const SHARE_CARD_HEIGHT = 380;
const MAP_SIZE = SHARE_CARD_HEIGHT;

/** Route stroke: bright cyan stays readable on the dimmed map art (orange World's Edge terrain included). */
export const SHARE_ROUTE_COLOR = '#3fe0ff';
/** Stroke widths in the 0–100 map viewBox (380 px → 1 unit ≈ 3.8 px). */
export const SHARE_ROUTE_WIDTH = 0.42;
export const SHARE_ROUTE_CASING_WIDTH = 1.05;

/** Closed rings: thin white lines under the route, the final (smallest) ring a little brighter. */
export const SHARE_RING_WIDTH = 0.3;
export const SHARE_RING_OPACITY = 0.5;
export const SHARE_FINAL_RING_OPACITY = 0.85;

/** Panel colors are fixed (not theme vars) so the posted image looks the same in every theme. */
const INK = '#f4f5f7';
const INK_MUTED = 'rgba(244, 245, 247, 0.56)';
const INK_FAINT = 'rgba(244, 245, 247, 0.34)';
const PANEL_BG = '#101218';
const HAIRLINE = 'rgba(255, 255, 255, 0.08)';
const FONT = '"Inter", system-ui, "Segoe UI", "Malgun Gothic", Helvetica, Arial, sans-serif';

/** Assets baked before capture (html2canvas can't paint CSS filters or lazy-loaded icons). */
export interface MatchShareAssets {
    playstyle: PlaystyleKey;
    /** Playstyle watermark icon as an image URL (white SVG data URL). */
    playstyleIcon?: string | null;
    bestWeapon: ({ id: string } & WeaponCombatEntry) | null;
    /** White weapon silhouette as a data URL. */
    weaponSilhouette?: string | null;
    /** Map and legend images already resolved to loadable (blob) URLs. */
    mapImage?: string | null;
    legendImage?: string | null;
}

export interface MatchShareCardProps {
    match: Match;
    modeLabel: string;
    modeColor: string;
    assets: MatchShareAssets | null;
}

type PathPoint = { x: number; y: number; t?: number; p?: string };

const label: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '1.4px',
    textTransform: 'uppercase',
    color: INK_MUTED,
};

/**
 * Off-screen card rendered only while capturing a match share image.
 * Teammate names are left out on purpose: the image may be posted publicly.
 * Plain colors / linear gradients only (no color-mix, filter, mask) — html2canvas can't paint those.
 */
const MatchShareCard = forwardRef<HTMLDivElement, MatchShareCardProps>(({ match, modeLabel, modeColor, assets }, ref) => {
    const { t } = useTranslation();
    const matchTimeMs = match.startTime ?? match.endTime ?? null;
    const placement = match.placement === '1' ? 1 : match.placement;
    const placementColor = getRankColor(placement ?? '');
    const isRanked = String(match.mode || '').toLowerCase().includes('ranked');
    const showRp = isRanked && match.rpProcessed && typeof match.rpChange === 'number';
    const mapName = normalizeMapDisplayName(match.map);
    const dateLabel = new Date(match.endTime || match.startTime).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
    });

    // Ground route only (no dropship), split where the player died/respawned.
    const routes = useMemo(() => {
        const pts = (Array.isArray(match.path) ? match.path : []) as PathPoint[];
        const ground = groundPathPoints(pts.filter((pt) => pt && typeof pt.x === 'number' && typeof pt.y === 'number'));
        if (ground.length < 2) return { paths: [] as string[], start: null, end: null };
        const paths: string[] = [];
        let d = '';
        let prev: { x: number; y: number } | null = null;
        let start: { x: number; y: number } | null = null;
        for (const pt of ground) {
            const c = getCssPos(pt.x, pt.y, match.map, matchTimeMs);
            if (!start) start = c;
            if (!prev || Math.hypot(c.x - prev.x, c.y - prev.y) > 8) {
                if (d) paths.push(d);
                d = `M ${c.x} ${c.y}`;
            } else {
                d += ` L ${c.x} ${c.y}`;
            }
            prev = c;
        }
        if (d) paths.push(d);
        return { paths, start, end: prev };
    }, [match.path, match.map, matchTimeMs]);

    const rings = useMemo(() => buildShareRings(match), [match]);

    const style = assets ? PLAYSTYLE_VISUALS[assets.playstyle] : null;
    const best = assets?.bestWeapon ?? null;
    const holdMin = best && best.holdMs > 0 ? Math.max(1, Math.round(best.holdMs / 60000)) : null;

    const stat = (name: string, value: string | number) => (
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.5px', color: INK, fontVariantNumeric: 'tabular-nums' }}>
                {value}
            </div>
            <div style={{ ...label, marginTop: 7 }}>{name}</div>
        </div>
    );
    const divider = <div style={{ width: 1, alignSelf: 'stretch', background: HAIRLINE, margin: '0 16px' }} />;

    return (
        <div
            ref={ref}
            style={{
                width: SHARE_CARD_WIDTH,
                height: SHARE_CARD_HEIGHT,
                display: 'flex',
                background: PANEL_BG,
                color: INK,
                fontFamily: FONT,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Map + route */}
            <div style={{ width: MAP_SIZE, height: MAP_SIZE, position: 'relative', background: '#07080b', flexShrink: 0, overflow: 'hidden' }}>
                {assets?.mapImage ? (
                    <img
                        src={assets.mapImage}
                        crossOrigin="anonymous"
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.55 }}
                    />
                ) : null}
                <svg viewBox="0 0 100 100" width={MAP_SIZE} height={MAP_SIZE} style={{ position: 'absolute', left: 0, top: 0 }}>
                    {rings.map((ring) => (
                        <g key={`ring${ring.round}`}>
                            <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="#000000" strokeOpacity={0.35} strokeWidth={SHARE_RING_WIDTH * 2.4} />
                            <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="#ffffff" strokeOpacity={ring.final ? SHARE_FINAL_RING_OPACITY : SHARE_RING_OPACITY} strokeWidth={SHARE_RING_WIDTH} />
                        </g>
                    ))}
                    {routes.paths.map((d, i) => (
                        <path key={`c${i}`} d={d} fill="none" stroke="#000000" strokeOpacity={0.55} strokeWidth={SHARE_ROUTE_CASING_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {routes.paths.map((d, i) => (
                        <path key={`r${i}`} d={d} fill="none" stroke={SHARE_ROUTE_COLOR} strokeWidth={SHARE_ROUTE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {routes.start ? (
                        <circle cx={routes.start.x} cy={routes.start.y} r={0.9} fill="#ffffff" stroke="#000000" strokeOpacity={0.6} strokeWidth={0.35} />
                    ) : null}
                    {routes.end ? (
                        <g>
                            <circle cx={routes.end.x} cy={routes.end.y} r={1.7} fill={SHARE_ROUTE_COLOR} fillOpacity={0.25} />
                            <circle cx={routes.end.x} cy={routes.end.y} r={0.9} fill={SHARE_ROUTE_COLOR} stroke="#ffffff" strokeWidth={0.35} />
                        </g>
                    ) : null}
                </svg>
                {/* Fade the map's right edge into the panel. */}
                <div style={{ position: 'absolute', top: 0, right: 0, width: 56, height: '100%', background: `linear-gradient(90deg, rgba(16, 18, 24, 0) 0%, ${PANEL_BG} 100%)` }} />
                <div style={{ position: 'absolute', left: 16, top: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <img src={APEXTRACE_LOGO} crossOrigin="anonymous" alt="" style={{ width: 18, height: 18, opacity: 0.9 }} />
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2px', color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>APEXTRACE</span>
                </div>
                <div style={{ position: 'absolute', left: 16, bottom: 14, ...label, color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{mapName}</div>
            </div>

            {/* Stats panel */}
            <div style={{ flex: 1, minWidth: 0, padding: '22px 26px 22px 18px', display: 'flex', flexDirection: 'column' }}>
                {/* Header: legend, player, mode · date, placement */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {assets?.legendImage ? (
                        <img
                            src={assets.legendImage}
                            crossOrigin="anonymous"
                            alt=""
                            style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover', objectPosition: 'center top', background: '#1b1e26', border: `1px solid ${HAIRLINE}` }}
                        />
                    ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 20, background: '#1b1e26', border: `1px solid ${HAIRLINE}` }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {match.playerName && match.playerName !== 'Unknown' ? match.playerName : 'ApexTrace'}
                        </div>
                        <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ color: modeColor, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{modeLabel}</span>
                            <span style={{ color: INK_FAINT }}>{'  ·  '}</span>{dateLabel}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px', color: placementColor }}>
                            {placement == null || placement === '' ? '-' : `#${placement}`}
                        </div>
                        {showRp ? (
                            <div style={{
                                fontSize: 11,
                                fontWeight: 700,
                                marginTop: 4,
                                color: match.rpChange > 0 ? '#4ade80' : match.rpChange < 0 ? '#f87171' : INK_MUTED,
                            }}>
                                {match.rpChange > 0 ? `+${match.rpChange}` : match.rpChange} RP
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Playstyle */}
                <div style={{
                    marginTop: 18,
                    height: 84,
                    borderRadius: 12,
                    position: 'relative',
                    overflow: 'hidden',
                    background: style?.background ?? '#1b1e26',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255, 255, 255, 0.10)',
                }}>
                    {assets?.playstyleIcon ? (
                        <img
                            src={assets.playstyleIcon}
                            alt=""
                            style={{ position: 'absolute', right: -4, top: -4, width: 92, height: 92, transform: 'rotate(-12deg)', opacity: 0.2 }}
                        />
                    ) : null}
                    <div style={{ ...label, color: 'rgba(255,255,255,0.72)', position: 'relative' }}>{t('matchStats.playedLike')}</div>
                    <div style={{ position: 'relative', minWidth: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250 }}>
                            {assets ? t(`playstyles.${assets.playstyle}.name`, { lng: 'en' }) : '-'}
                        </div>
                        {assets ? (
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250 }}>
                                {t(`playstyles.${assets.playstyle}.sub`)}
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Best weapon */}
                <div style={{
                    marginTop: 10,
                    height: 66,
                    borderRadius: 12,
                    position: 'relative',
                    overflow: 'hidden',
                    background: best ? getWeaponCardBackground(best.id) : '#1b1e26',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255, 255, 255, 0.10)',
                }}>
                    {best && assets?.weaponSilhouette ? (
                        <img
                            src={assets.weaponSilhouette}
                            alt=""
                            style={{ position: 'absolute', right: 14, top: 9, width: 128, height: 48, objectFit: 'contain', opacity: 0.92 }}
                        />
                    ) : null}
                    <div style={{ ...label, color: 'rgba(255,255,255,0.72)', position: 'relative' }}>{t('matchStats.bestWeapon', { defaultValue: 'Best weapon' })}</div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 8, maxWidth: 170, minWidth: 0 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
                            {best ? getWeaponDisplayName(best.id) : '—'}
                        </span>
                        {best ? (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                {t('matchStats.bestWeaponLine', { kills: best.kills, assists: best.assists || 0, defaultValue: '{{kills}} K · {{assists}} A' })}
                                {holdMin ? ` · ${holdMin}m` : ''}
                            </span>
                        ) : null}
                    </div>
                </div>

                {/* Kills · Assists · Damage */}
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', paddingTop: 14, borderTop: `1px solid ${HAIRLINE}` }}>
                    {stat(t('match.kills'), match.kills ?? '-')}
                    {divider}
                    {stat(t('match.assists'), match.assists ?? '-')}
                    {divider}
                    {stat(t('match.damage'), match.damage == null ? '-' : Math.round(match.damage).toLocaleString())}
                </div>
            </div>
        </div>
    );
});

MatchShareCard.displayName = 'MatchShareCard';

export default MatchShareCard;

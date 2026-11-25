import { forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import {
    formatMatchTime,
    getAvgDamageColor,
    getCssPos,
    getMapConfig,
    getRankColor,
    normalizeMapDisplayName,
    toGameElapsedMs,
} from '../utils/helpers';
import { groundPathPoints } from '../utils/groundPath';

const IMAGE_BASE = '/images';
const CARD_WIDTH = 760;
const MAP_SIZE = 380;

export interface MatchShareCardProps {
    match: Match;
    modeLabel: string;
    modeColor: string;
}

type PathPoint = { x: number; y: number; t?: number; p?: string };

/**
 * Off-screen card rendered only while capturing a match share image.
 * Teammate names are left out on purpose: the image may be posted publicly.
 * Plain colors only (no color-mix / backdrop-filter) — html2canvas can't paint those.
 */
const MatchShareCard = forwardRef<HTMLDivElement, MatchShareCardProps>(({ match, modeLabel, modeColor }, ref) => {
    const { t } = useTranslation();
    const matchTimeMs = match.startTime ?? match.endTime ?? null;
    const placement = match.placement === '1' ? 1 : match.placement;
    const placementColor = getRankColor(placement ?? '');
    const isRanked = String(match.mode || '').toLowerCase().includes('ranked');
    const showRp = isRanked && match.rpProcessed && typeof match.rpChange === 'number';
    const mapName = normalizeMapDisplayName(match.map);
    const mapConfig = getMapConfig(match.map, matchTimeMs);
    const survival = match.endTime && match.startTime
        ? formatMatchTime(toGameElapsedMs(match.endTime - match.startTime), 'text')
        : '-';
    const dateLabel = new Date(match.endTime || match.startTime).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    // Ground route only (no dropship), split where the player died/respawned.
    const routes = useMemo(() => {
        const pts = (Array.isArray(match.path) ? match.path : []) as PathPoint[];
        const ground = groundPathPoints(pts.filter((pt) => pt && typeof pt.x === 'number' && typeof pt.y === 'number'));
        if (ground.length < 2) return [] as string[];
        const out: string[] = [];
        let d = '';
        let prev: { x: number; y: number } | null = null;
        for (const pt of ground) {
            const c = getCssPos(pt.x, pt.y, match.map, matchTimeMs);
            if (!prev || Math.hypot(c.x - prev.x, c.y - prev.y) > 8) {
                if (d) out.push(d);
                d = `M ${c.x} ${c.y}`;
            } else {
                d += ` L ${c.x} ${c.y}`;
            }
            prev = c;
        }
        if (d) out.push(d);
        return out;
    }, [match.path, match.map, matchTimeMs]);

    const stat = (label: string, value: string | number, color = 'var(--color-text-primary)') => (
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
        </div>
    );

    return (
        <div
            ref={ref}
            style={{
                width: CARD_WIDTH,
                height: MAP_SIZE,
                display: 'flex',
                background: 'var(--color-bg-panel)',
                color: 'var(--color-text-primary)',
                fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
                overflow: 'hidden',
            }}
        >
            <div style={{ width: MAP_SIZE, height: MAP_SIZE, position: 'relative', background: '#000', flexShrink: 0 }}>
                {mapConfig?.img ? (
                    <img
                        src={`${IMAGE_BASE}/${mapConfig.img}`}
                        crossOrigin="anonymous"
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.7 }}
                    />
                ) : null}
                <svg viewBox="0 0 100 100" width={MAP_SIZE} height={MAP_SIZE} style={{ position: 'absolute', inset: 0 }}>
                    {routes.map((d, i) => (
                        <g key={i}>
                            <path d={d} fill="none" stroke="#000" strokeOpacity={0.6} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                            <path d={d} fill="none" stroke="#ffffff" strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    ))}
                </svg>
            </div>

            <div style={{ flex: 1, minWidth: 0, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                        src={`${IMAGE_BASE}/${(match.legend || 'unknown').toLowerCase()}.png`}
                        crossOrigin="anonymous"
                        alt=""
                        style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', border: '2px solid var(--color-border-light)', background: 'var(--color-bg-deep)' }}
                    />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {match.playerName && match.playerName !== 'Unknown' ? match.playerName : 'ApexTrace'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                            <span style={{ color: modeColor, fontWeight: 700, textTransform: 'uppercase' }}>{modeLabel}</span>
                            {' · '}{mapName}{' · '}{dateLabel}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: placementColor }}>
                        {placement == null || placement === '' ? '-' : `#${placement}`}
                    </div>
                    {showRp ? (
                        <div style={{
                            fontSize: 20,
                            fontWeight: 800,
                            color: match.rpChange > 0 ? 'var(--color-success)' : match.rpChange < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
                        }}>
                            {match.rpChange > 0 ? `+${match.rpChange}` : match.rpChange} RP
                        </div>
                    ) : null}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {stat(t('match.damage'), match.damage == null ? '-' : Math.round(match.damage), match.damage == null ? undefined : getAvgDamageColor(match.damage))}
                    {stat(t('match.kills'), match.kills ?? '-')}
                    {stat(t('match.assists'), match.assists ?? '-')}
                    {stat(t('match.knocks'), match.knocks ?? '-')}
                    {stat(t('matchStats.survivalTime'), survival)}
                    {stat(t('share.legend', { defaultValue: 'Legend' }), match.legend || '-')}
                </div>
            </div>
        </div>
    );
});

MatchShareCard.displayName = 'MatchShareCard';

export default MatchShareCard;

import type { Match } from '../types';
import { getCssPos } from './helpers';
import { buildRingCircles, DEFAULT_RING_UNITS_PER_METER } from './ringOverlay';

export type ShareRing = { round: number; cx: number; cy: number; r: number; final: boolean };

/**
 * Every ring the zone closed onto (same source as the map's static ring view), in the card's
 * 0–100 map viewBox. Sorted largest first so the final ring paints on top.
 */
export const buildShareRings = (match: Match): ShareRing[] => {
    const matchTimeMs = match.startTime ?? match.endTime ?? null;
    const circles = buildRingCircles(match.ringRounds, match.ringUnitsPerMeter ?? DEFAULT_RING_UNITS_PER_METER)
        .map((c) => {
            const center = getCssPos(c.x, c.y, match.map, matchTimeMs);
            const edge = getCssPos(c.x + c.r, c.y, match.map, matchTimeMs);
            return { round: c.round, cx: center.x, cy: center.y, r: Math.abs(edge.x - center.x) };
        })
        .filter((c) => Number.isFinite(c.cx) && Number.isFinite(c.cy) && c.r > 0)
        .sort((a, b) => b.r - a.r);
    return circles.map((c, i) => ({ ...c, final: i === circles.length - 1 }));
};

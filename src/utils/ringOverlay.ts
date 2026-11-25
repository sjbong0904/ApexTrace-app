import type { RingRound, RingSample } from '../types';

/** GEP ring coordinates/radius are location meters × 100 (verified 2026-11-14, see docs/GEP-BUGS.md). */
export const DEFAULT_RING_UNITS_PER_METER = 100;

export interface RingCircle {
    /** Ring round index (0 = first closing). */
    round: number;
    /** Center/radius in location meters (same space as `match.path`). */
    x: number;
    y: number;
    r: number;
    /**
     * closed  = the ring a round closes onto (observed, or extrapolated when the match ended
     *           mid-shrink — see resolveRingCenter)
     * partial = where the zone was when recording stopped, if the target couldn't be resolved
     */
    kind: 'closed' | 'partial';
}

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const validSamples = (round: RingRound): RingSample[] =>
    (Array.isArray(round.activeSamples) ? round.activeSamples : []).filter(
        (s) => s && isFiniteNum(s.x) && isFiniteNum(s.y) && isFiniteNum(s.r) && !(s.x === 0 && s.y === 0),
    );

/**
 * Center of the ring a round closes onto, in raw GEP ring units — or null if unknown.
 *
 * GEP next_ring x/y are never trusted (docs/GEP-BUGS.md): 317.4 sent denormals, 318.0 sends
 * x ≈ -2.0 / y ≈ 1.44e-41, which looks valid but is the map origin. Already-uploaded matches
 * carry those values in nextRingCenterX/Y, so they are ignored here too and the center is
 * always derived from the round's active_ring:
 *  - shrink reached the announced radius → its final center ('active_end', exact)
 *  - shrink cut off (match ended / squad wiped mid-close) → extrapolated ('extrapolated').
 *    The closing ring's center moves linearly with its radius, so a least-squares line of
 *    x(r), y(r) over the shrink samples, evaluated at the target radius, recovers the target
 *    center. Checked on completed rounds: 3–5 early samples land within 0.11–0.35 m.
 *  - shrink never started (no samples) → unknown (null).
 */
/** Minimum radius span (ring units) of the shrink samples before extrapolating — 1 m. */
const MIN_EXTRAPOLATION_SPAN = 100;

export const resolveRingCenter = (
    round: RingRound,
): { x: number; y: number; source: 'active_end' | 'extrapolated' } | null => {
    const target = isFiniteNum(round.nextRingRadius) ? round.nextRingRadius : null;
    if (target == null) return null;
    const samples = validSamples(round);
    const last = samples[samples.length - 1];
    if (!last) return null;
    if (Math.abs(last.r - target) <= Math.max(5, target * 0.01)) {
        return { x: last.x, y: last.y, source: 'active_end' };
    }

    // Cut off mid-shrink: only extrapolate toward a smaller target, over a real radius span.
    const shrinking = samples.filter((s) => s.r > target);
    if (shrinking.length < 2) return null;
    const n = shrinking.length;
    const meanR = shrinking.reduce((a, s) => a + s.r, 0) / n;
    const meanX = shrinking.reduce((a, s) => a + s.x, 0) / n;
    const meanY = shrinking.reduce((a, s) => a + s.y, 0) / n;
    let varR = 0;
    let covX = 0;
    let covY = 0;
    let minR = Infinity;
    let maxR = -Infinity;
    for (const s of shrinking) {
        const dr = s.r - meanR;
        varR += dr * dr;
        covX += dr * (s.x - meanX);
        covY += dr * (s.y - meanY);
        minR = Math.min(minR, s.r);
        maxR = Math.max(maxR, s.r);
    }
    if (maxR - minR < MIN_EXTRAPOLATION_SPAN || varR <= 0) return null;
    const x = meanX + (covX / varR) * (target - meanR);
    const y = meanY + (covY / varR) * (target - meanR);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y, source: 'extrapolated' };
};

/**
 * Static ring overlay geometry. Each round contributes the ring it closed onto; the last round
 * that never finished contributes its last observed active ring as `partial`.
 */
export const buildRingCircles = (
    rounds: RingRound[] | null | undefined,
    unitsPerMeter: number = DEFAULT_RING_UNITS_PER_METER,
): RingCircle[] => {
    if (!Array.isArray(rounds) || rounds.length === 0) return [];
    const k = unitsPerMeter > 0 ? unitsPerMeter : DEFAULT_RING_UNITS_PER_METER;
    const out: RingCircle[] = [];
    const sorted = [...rounds].filter(Boolean).sort((a, b) => (a.round ?? 0) - (b.round ?? 0));

    // The pre-round-1 play zone (huge, mostly off-map) is intentionally not drawn.

    sorted.forEach((rd, idx) => {
        const samples = validSamples(rd);
        const last = samples[samples.length - 1];
        const target = isFiniteNum(rd.nextRingRadius) ? rd.nextRingRadius : null;
        const center = resolveRingCenter(rd);

        if (center && target != null) {
            // Final round (radius ≈ 1) collapses to a point — not worth drawing as a ring.
            if (target / k >= 1) out.push({ round: rd.round ?? idx, x: center.x / k, y: center.y / k, r: target / k, kind: 'closed' });
            return;
        }

        // Unfinished shrink: show where the zone was when data stopped.
        if (last && idx === sorted.length - 1 && samples.length > 1) {
            out.push({ round: rd.round ?? idx, x: last.x / k, y: last.y / k, r: last.r / k, kind: 'partial' });
        }
    });

    return out;
};

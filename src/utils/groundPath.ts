/**
 * Ground-route filter shared by the static map, the replay and the share card.
 *
 * Path points carry the GEP phase in `p`. Normally the dropship/skydive is dropped by keeping
 * only `landed` points. GEP sometimes stops sending `phase` for whole matches, though — the
 * points then come tagged `landed` (stale value from the previous match) or `unknown`, and the
 * dropship would be drawn. In that case the drop is cut by speed instead.
 *
 * Measured on 2 s samples of phase-tagged matches (location units/s):
 *   aircraft p10 19.7 · freefly min 3.2, p10 8.1, p50 9.7 · landed p50 1.5, p90 3.2.
 * Short drops glide at only 4–5 u/s, hence the low threshold plus two slow steps in a row.
 */

type PathLike = { x?: unknown; y?: unknown; t?: unknown; p?: unknown };

/** Faster than this is still in the air (dropship or skydive). */
const AIRBORNE_SPEED_UNITS_PER_SEC = 3.5;
/** A drop never lasts longer than this after the first point. */
const MAX_DROP_MS = 150_000;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const hasDropPhaseTags = (points: PathLike[]) =>
    points.some((pt) => pt.p === 'aircraft' || pt.p === 'freefly');

/** Speed from point i to i+1, or null when timing/coords are missing. */
const stepSpeed = (points: PathLike[], i: number): number | null => {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b || !isNum(a.t) || !isNum(b.t) || !isNum(a.x) || !isNum(a.y) || !isNum(b.x) || !isNum(b.y)) return null;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return null;
    return Math.hypot(b.x - a.x, b.y - a.y) / dt;
};

/** Consecutive foot-speed steps required to call it a landing (one slow sample mid-drop happens). */
const LANDED_STEPS = 2;

/**
 * Index of the landing point: first sample after which the player moves at foot speed.
 * 0 when the route does not start airborne (or timing data is missing).
 */
export const findLandingIndex = (points: PathLike[]): number => {
    if (points.length < LANDED_STEPS + 1 || !isNum(points[0].t)) return 0;
    const first = stepSpeed(points, 0);
    if (first === null || first <= AIRBORNE_SPEED_UNITS_PER_SEC) return 0;
    const t0 = points[0].t;
    for (let i = 1; i + LANDED_STEPS < points.length; i++) {
        const t = points[i].t;
        if (!isNum(t) || t - t0 > MAX_DROP_MS) return 0;
        let slow = true;
        for (let k = 0; k < LANDED_STEPS; k++) {
            const v = stepSpeed(points, i + k);
            if (v === null) return 0;
            if (v > AIRBORNE_SPEED_UNITS_PER_SEC) { slow = false; break; }
        }
        if (slow) return i;
    }
    return 0;
};

/** Points of one life (or a whole path) with the dropship / skydive removed. */
export const groundPathPoints = <T extends PathLike>(points: T[]): T[] => {
    if (points.length === 0) return points;
    if (hasDropPhaseTags(points)) {
        const landed = points.filter((pt) => pt.p === 'landed');
        if (landed.length > 0) return landed;
        const notAircraft = points.filter((pt) => pt.p !== 'aircraft');
        return notAircraft.length > 0 ? notAircraft : points;
    }
    // No drop phases recorded: phase was missing for this match — trim the airborne prefix.
    return points.slice(findLandingIndex(points));
};

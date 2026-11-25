import type { Match, RingRound } from '../types';
import { DEFAULT_RING_UNITS_PER_METER, resolveRingCenter } from './ringOverlay';
import { groundPathPoints } from './groundPath';

/**
 * Premium map replay timeline. Everything is in epoch ms (path.t and ring sample t share the
 * same Date.now() clock) and location meters (rings are divided by ringUnitsPerMeter).
 */

export interface ReplayPoint { t: number; x: number; y: number }
export interface ReplayLife { points: ReplayPoint[]; startT: number; endT: number }
export interface ReplayRingSample { t: number; x: number; y: number; r: number }
/** One announced ring per round (a match has exactly one ring per round). */
export interface ReplayNextRing {
    /** Revealed at (GEP next_ring receipt). */
    t: number;
    round: number;
    /** null when the center was never captured (player gone before it closed, or GEP bug). */
    x: number | null;
    y: number | null;
    r: number;
    /** Has a known center and isn't the final point-sized ring. */
    drawable: boolean;
}

/** A ring the UI can draw (center known). */
export type ReplayDrawnRing = ReplayNextRing & { x: number; y: number };

const asDrawn = (ring: ReplayNextRing | null): ReplayDrawnRing | null =>
    ring && ring.drawable && ring.x !== null && ring.y !== null ? (ring as ReplayDrawnRing) : null;

export interface MapReplay {
    startT: number;
    endT: number;
    lives: ReplayLife[];
    activeSamples: ReplayRingSample[];
    nextRings: ReplayNextRing[];
    /** Won the match → the last life never "dies" at the end of the timeline. */
    survived: boolean;
}

export interface ReplayFrame {
    /** Trail per life, cut at time t (last point interpolated). */
    trails: ReplayPoint[][];
    /** Marker position; `dead` while between lives or after the final life ended early. */
    marker: { x: number; y: number; dead: boolean } | null;
    /** Death→respawn pairs already reached by t. */
    jumps: { from: ReplayPoint; to: ReplayPoint | null }[];
    activeRing: ReplayRingSample | null;
    /** True while the zone is actively closing at t (between two streamed active_ring samples). */
    shrinking: boolean;
    nextRing: ReplayDrawnRing | null;
    /** Ring after next — shown from the reveal of `nextRing` (dashed in the UI). */
    afterNextRing: ReplayDrawnRing | null;
}

/** Samples further apart than this are a hold (zone waiting), not a shrink — don't interpolate. */
const RING_INTERP_MAX_GAP_MS = 4500;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

type RawPoint = { x?: unknown; y?: unknown; t?: unknown; s?: unknown; p?: unknown };

/** Same ground filter as the static map: drop dropship/pre-landing points when possible. */
const groundPoints = (points: RawPoint[]): RawPoint[] => groundPathPoints(points);

const validRingSample = (s: { x?: unknown; y?: unknown; r?: unknown; t?: unknown }) =>
    isNum(s.t) && isNum(s.x) && isNum(s.y) && isNum(s.r) && !(s.x === 0 && s.y === 0);

export const buildMapReplay = (match: Match): MapReplay | null => {
    const rawPath = (Array.isArray(match.path) ? match.path : []) as RawPoint[];
    const timed = rawPath.filter((pt) => pt && isNum(pt.x) && isNum(pt.y) && isNum(pt.t));
    if (timed.length < 2) return null;

    const bySegment = new Map<number, RawPoint[]>();
    for (const pt of timed) {
        const seg = isNum(pt.s) ? pt.s : 0;
        if (!bySegment.has(seg)) bySegment.set(seg, []);
        bySegment.get(seg)!.push(pt);
    }
    const lives: ReplayLife[] = Array.from(bySegment.entries())
        .sort(([a], [b]) => a - b)
        .map(([, pts]) => groundPoints(pts)
            .map((pt) => ({ t: pt.t as number, x: pt.x as number, y: pt.y as number }))
            .sort((a, b) => a.t - b.t))
        .filter((pts) => pts.length > 0)
        .map((points) => ({ points, startT: points[0].t, endT: points[points.length - 1].t }));
    if (lives.length === 0) return null;

    const k = match.ringUnitsPerMeter && match.ringUnitsPerMeter > 0
        ? match.ringUnitsPerMeter
        : DEFAULT_RING_UNITS_PER_METER;
    const rounds: RingRound[] = Array.isArray(match.ringRounds) ? match.ringRounds : [];

    const activeSamples: ReplayRingSample[] = rounds
        .flatMap((rd) => (Array.isArray(rd.activeSamples) ? rd.activeSamples : []))
        .filter(validRingSample)
        .map((s) => ({ t: s.t, x: s.x / k, y: s.y / k, r: s.r / k }))
        .sort((a, b) => a.t - b.t);

    const nextRings: ReplayNextRing[] = rounds
        .filter((rd) => isNum(rd.revealedAt) && isNum(rd.nextRingRadius))
        .map((rd) => {
            // GEP next_ring x/y are garbage — center comes from the round's final active_ring.
            const center = resolveRingCenter(rd);
            const hasCenter = center != null;
            const r = (rd.nextRingRadius as number) / k;
            return {
                t: rd.revealedAt as number,
                round: rd.round,
                x: center ? center.x / k : null,
                y: center ? center.y / k : null,
                r,
                // Final "ring" (radius ≈ 1 unit) is a point — nothing to show.
                drawable: hasCenter && r >= 1,
            };
        })
        .sort((a, b) => a.t - b.t);

    // Timeline starts at the start marker (first landed point). A ring revealed earlier is still
    // shown from t=0 because frames look up the latest event at or before t.
    const startT = lives[0].startT;
    const endTimes = [lives[lives.length - 1].endT];
    if (activeSamples.length > 0) endTimes.push(activeSamples[activeSamples.length - 1].t);
    const endT = Math.max(...endTimes);
    if (!(endT > startT)) return null;

    return { startT, endT, lives, activeSamples, nextRings, survived: match.placement === 1 };
};

/** Index of the last element with t <= target (or -1). */
const lastAtOrBefore = <T extends { t: number }>(arr: T[], target: number): number => {
    let lo = 0;
    let hi = arr.length - 1;
    let ans = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].t <= target) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return ans;
};

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

export const getReplayFrame = (replay: MapReplay, t: number): ReplayFrame => {
    const trails: ReplayPoint[][] = [];
    const jumps: ReplayFrame['jumps'] = [];
    let marker: ReplayFrame['marker'] = null;

    for (let idx = 0; idx < replay.lives.length; idx++) {
        const life = replay.lives[idx];
        if (t < life.startT) break;
        const i = lastAtOrBefore(life.points, t);
        const trail = life.points.slice(0, i + 1);
        const next = life.points[i + 1];
        if (next && i >= 0) {
            const prev = life.points[i];
            const f = (t - prev.t) / Math.max(1, next.t - prev.t);
            trail.push({ t, x: lerp(prev.x, next.x, f), y: lerp(prev.y, next.y, f) });
        }
        trails.push(trail);

        const tip = trail[trail.length - 1];
        const isLast = idx === replay.lives.length - 1;
        const alive = t <= life.endT || (isLast && replay.survived);
        marker = { x: tip.x, y: tip.y, dead: !alive };

        if (!alive && idx < replay.lives.length - 1) {
            const nextLife = replay.lives[idx + 1];
            jumps.push({ from: tip, to: t >= nextLife.startT ? nextLife.points[0] : null });
        }
    }

    let activeRing: ReplayRingSample | null = null;
    let shrinking = false;
    const ai = lastAtOrBefore(replay.activeSamples, t);
    if (ai >= 0) {
        const a = replay.activeSamples[ai];
        const b = replay.activeSamples[ai + 1];
        if (b && b.t - a.t <= RING_INTERP_MAX_GAP_MS) {
            const f = (t - a.t) / Math.max(1, b.t - a.t);
            activeRing = { t, x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), r: lerp(a.r, b.r, f) };
            shrinking = b.r < a.r - 0.01;
        } else {
            activeRing = a;
        }
    }

    // Rings follow the in-game reveal rhythm. Each round has exactly one ring, so once round n is
    // revealed we also know round n+1's ring and can preview it.
    //  - nextRing      = latest revealed ring (stays drawn after the zone closes onto it, during
    //                    the ~4 s wait, until the next reveal replaces it)
    //  - afterNextRing = the following round's ring, shown from that same reveal
    // A round with an unknown center still advances the timeline; it just isn't drawn.
    const ni = lastAtOrBefore(replay.nextRings, t);
    const latest = ni >= 0 ? replay.nextRings[ni] : null;
    const following = ni >= 0 ? (replay.nextRings[ni + 1] ?? null) : null;
    const nextRing = asDrawn(latest);
    const afterNextRing = asDrawn(following);

    return { trails, marker, jumps, activeRing, nextRing, afterNextRing, shrinking };
};

export const formatReplayClock = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

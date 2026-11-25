/** Map geometry: ground path filter, ring centers/overlay, replay timeline, per-match detail stats. */
import { describe, expect, it } from 'vitest';
import type { Match, RingRound, RingSample } from '../../types';
import { findLandingIndex, groundPathPoints } from '../groundPath';
import { buildRingCircles, resolveRingCenter } from '../ringOverlay';
import { buildMapReplay, formatReplayClock, getReplayFrame } from '../mapReplay';
import {
    getDamagePerKnock,
    getGrenadeDamage,
    getHeadshotRate,
    getRevivesReceived,
    getTimeOutsideRingMs,
    getTimesKnocked,
    getUltimatesUsed,
} from '../matchDetailStats';

const asMatch = (m: Partial<Match>) => ({ path: [], events: [], ringRounds: [], ...m }) as unknown as Match;
const round = (r: Partial<RingRound> & { round: number }): RingRound =>
    ({ nextRingCenterX: null, nextRingCenterY: null, nextRingRadius: null, ...r });
const sample = (t: number, x: number, y: number, r: number): RingSample => ({ t, x, y, r });

describe('groundPath', () => {
    it('keeps only landed points when phases are tagged', () => {
        const pts = [
            { x: 0, y: 0, p: 'aircraft' }, { x: 1, y: 0, p: 'freefly' },
            { x: 2, y: 0, p: 'landed' }, { x: 3, y: 0, p: 'landed' },
        ];
        expect(groundPathPoints(pts).map((p) => p.x)).toEqual([2, 3]);
    });

    it('cuts the airborne prefix by speed when phases are missing', () => {
        // 20 u/s for three 2 s steps (skydive), then 0.5 u/s on foot.
        const xs = [0, 40, 80, 120, 121, 122, 123];
        const pts = xs.map((x, i) => ({ x, y: 0, t: i * 2000, p: 'unknown' }));
        expect(findLandingIndex(pts)).toBe(3);
        expect(groundPathPoints(pts)[0].x).toBe(120);
    });

    it('leaves a route that starts on foot untouched', () => {
        const pts = [0, 1, 2, 3].map((x, i) => ({ x, y: 0, t: i * 1000 }));
        expect(findLandingIndex(pts)).toBe(0);
        expect(groundPathPoints(pts)).toHaveLength(4);
        expect(groundPathPoints([])).toEqual([]);
    });
});

describe('ringOverlay', () => {
    it('uses the final active sample when the shrink completed', () => {
        const rd = round({ round: 0, nextRingRadius: 1000, activeSamples: [sample(0, 500, 500, 5000), sample(1, 700, 800, 1003)] });
        expect(resolveRingCenter(rd)).toEqual({ x: 700, y: 800, source: 'active_end' });
    });

    it('extrapolates the center linearly when cut off mid-shrink', () => {
        // x(r) = 10000 - r, y(r) = 2000 + r/2 → at r=1000: (9000, 2500)
        const samples = [5000, 4000, 3000].map((r, i) => sample(i, 10000 - r, 2000 + r / 2, r));
        const c = resolveRingCenter(round({ round: 1, nextRingRadius: 1000, activeSamples: samples }));
        expect(c?.source).toBe('extrapolated');
        expect(c?.x).toBeCloseTo(9000, 6);
        expect(c?.y).toBeCloseTo(2500, 6);
    });

    it('unknown center: no target, no samples, (0,0) junk, or too little span', () => {
        expect(resolveRingCenter(round({ round: 0, activeSamples: [sample(0, 1, 1, 10)] }))).toBeNull();
        expect(resolveRingCenter(round({ round: 0, nextRingRadius: 100 }))).toBeNull();
        expect(resolveRingCenter(round({ round: 0, nextRingRadius: 100, activeSamples: [sample(0, 0, 0, 100)] }))).toBeNull();
        expect(resolveRingCenter(round({ round: 0, nextRingRadius: 100, activeSamples: [sample(0, 5, 5, 300), sample(1, 6, 6, 250)] }))).toBeNull();
    });

    it('builds closed rings in meters, skips point-sized final ring, marks unfinished as partial', () => {
        const rounds = [
            round({ round: 0, nextRingRadius: 100000, activeSamples: [sample(0, 1000, 2000, 150000), sample(1, 1000, 2000, 100000)] }),
            round({ round: 1, nextRingRadius: 50, activeSamples: [sample(2, 3000, 3000, 1000), sample(3, 3000, 3000, 50)] }),
            round({ round: 2, activeSamples: [sample(4, 4000, 4000, 900), sample(5, 4100, 4000, 800)] }),
        ];
        expect(buildRingCircles(rounds)).toEqual([
            { round: 0, x: 10, y: 20, r: 1000, kind: 'closed' },
            { round: 2, x: 41, y: 40, r: 8, kind: 'partial' },
        ]);
        expect(buildRingCircles(null)).toEqual([]);
    });
});

describe('mapReplay', () => {
    // Two lives (died, respawned); one shrinking ring; ring units = cm.
    const match = asMatch({
        placement: 5,
        path: [
            { x: 0, y: 0, t: 1000, s: 0 }, { x: 2, y: 0, t: 2000, s: 0 }, { x: 4, y: 0, t: 3000, s: 0 },
            { x: 50, y: 50, t: 10000, s: 1 }, { x: 51, y: 50, t: 11000, s: 1 }, { x: 52, y: 50, t: 12000, s: 1 },
        ],
        ringRounds: [round({
            round: 0, revealedAt: 500, nextRingRadius: 40000,
            activeSamples: [sample(1000, 100, 200, 50000), sample(3000, 100, 200, 40000)],
        })],
    });
    const replay = buildMapReplay(match)!;

    it('builds lives, ring samples and timeline bounds', () => {
        expect(replay.lives).toHaveLength(2);
        expect(replay.startT).toBe(1000);
        expect(replay.endT).toBe(12000);
        expect(replay.survived).toBe(false);
        expect(replay.activeSamples[0]).toEqual({ t: 1000, x: 1, y: 2, r: 500 });
        expect(replay.nextRings[0]).toMatchObject({ t: 500, x: 1, y: 2, r: 400, drawable: true });
    });

    it('interpolates the marker and the shrinking ring', () => {
        const f = getReplayFrame(replay, 2000);
        expect(f.marker).toEqual({ x: 2, y: 0, dead: false });
        expect(f.activeRing?.r).toBeCloseTo(450);
        expect(f.shrinking).toBe(true);
        expect(f.nextRing?.r).toBe(400);
        expect(getReplayFrame(replay, 1500).trails[0].at(-1)).toMatchObject({ x: 1, y: 0 });
    });

    it('marks death between lives and links the respawn jump', () => {
        const dead = getReplayFrame(replay, 5000);
        expect(dead.marker?.dead).toBe(true);
        expect(dead.jumps).toEqual([{ from: { t: 3000, x: 4, y: 0 }, to: null }]);
        const respawned = getReplayFrame(replay, 10000);
        expect(respawned.jumps[0].to).toEqual({ t: 10000, x: 50, y: 50 });
        expect(respawned.marker).toEqual({ x: 50, y: 50, dead: false });
    });

    it('a winner never dies at the end of the timeline', () => {
        const won = buildMapReplay({ ...match, placement: 1 })!;
        expect(getReplayFrame(won, 99_000).marker?.dead).toBe(false);
        expect(getReplayFrame(replay, 99_000).marker?.dead).toBe(true);
    });

    it('null for too-short paths; clock format', () => {
        expect(buildMapReplay(asMatch({ path: [{ x: 0, y: 0, t: 1 }] }))).toBeNull();
        expect(formatReplayClock(65_000)).toBe('1:05');
        expect(formatReplayClock(-1)).toBe('0:00');
    });
});

describe('matchDetailStats', () => {
    it('headshot rate, damage per knock, nullable signals', () => {
        expect(getHeadshotRate(asMatch({ damageHits: 10, headshots: 3 }))).toBe(30);
        expect(getHeadshotRate(asMatch({ headshots: 3 }))).toBeNull();
        expect(getHeadshotRate(asMatch({ damageHits: 2, headshots: 5 }))).toBe(100);
        expect(getDamagePerKnock(asMatch({ damage: 900, knocks: 3 }))).toBe(300);
        expect(getDamagePerKnock(asMatch({ damage: 900, knocks: 0 }))).toBeNull();
        expect(getGrenadeDamage(asMatch({}))).toBeNull();
        expect(getGrenadeDamage(asMatch({ grenadeDamage: 0 }))).toBe(0);
        expect(getUltimatesUsed(asMatch({ ultimatesUsed: 0 }))).toBeNull();
        expect(getUltimatesUsed(asMatch({ ultimatesUsed: 2 }))).toBe(2);
    });

    it('knocks / revives / respawns of the local player', () => {
        const m = asMatch({
            playerName: 'Me',
            events: [
                { type: 'knockdown', victim: '[T] Me' }, { type: 'knockdown', victim: 'Enemy' },
                { type: 'revive', victim: 'me' }, { type: 'respawn', victim: 'Me' }, { type: 'revive', victim: 'Mate' },
            ] as Match['events'],
        });
        expect(getTimesKnocked(m)).toBe(1);
        expect(getRevivesReceived(m)).toEqual({ revives: 1, respawns: 1 });
        expect(getRevivesReceived(asMatch({}))).toBeNull();
    });

    it('falls back to weaponThreats for knocks on summary rows', () => {
        const m = asMatch({ weaponThreats: { r99: { knockdowns: 2 }, flatline: { knockdowns: 1 } } as unknown as Match['weaponThreats'] });
        expect(getTimesKnocked(m)).toBe(3);
        expect(getTimesKnocked(asMatch({}))).toBeNull();
    });

    it('time outside the ring', () => {
        const path = [0, 1, 2].map((x, i) => ({ x, y: 0, t: 1000 + i * 1000 }));
        const ringAt = (cx: number) => [round({ round: 0, activeSamples: [sample(0, cx, 100, 1000), sample(4000, cx, 100, 1000)] })];
        // Ring (r = 10 m) centered 1000 m away → both 1 s steps outside.
        expect(getTimeOutsideRingMs(asMatch({ path, ringRounds: ringAt(100000) }))).toBe(2000);
        // Ring centered on the route → inside.
        expect(getTimeOutsideRingMs(asMatch({ path, ringRounds: ringAt(100) }))).toBe(0);
        expect(getTimeOutsideRingMs(asMatch({ path }))).toBeNull();
    });
});

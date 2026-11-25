/**
 * Golden snapshot over the anonymized demo dataset (real matches, see scripts/build-demo-matches.mjs).
 * Any change to stats/aggregation logic shows up as a snapshot diff — review it,
 * then accept with `npm run test:update` if the new numbers are intended.
 *
 * Modules are imported per test so `npm run metrics -- --ref <old tag>` can run this file against
 * older code: a module/function that did not exist yet is skipped, not a suite crash.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it, type TestContext } from 'vitest';
import type { MatchHistory } from '../match';

type Fn = (...args: any[]) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

const raw = JSON.parse(readFileSync(resolve(__dirname, '../../assets/demo/demoMatches.json'), 'utf8'));
let historyCache: (MatchHistory & { matchId?: string })[] | null = null;
const loadHistory = async () => {
    if (!historyCache) {
        const { normalizeHistoryForFrontend } = await import('../matchNormalizer');
        historyCache = normalizeHistoryForFrontend(raw.matches) as unknown as (MatchHistory & { matchId?: string })[];
    }
    return historyCache;
};

/** Resolve exports or skip the test when this code version does not have them yet. */
const need = async (ctx: TestContext, load: () => Promise<Record<string, unknown>>, names: string[]): Promise<Record<string, Fn>> => {
    let mod: Record<string, unknown>;
    try { mod = await load(); } catch { ctx.skip(); throw new Error('unreachable'); }
    for (const n of names) if (typeof mod[n] !== 'function') ctx.skip();
    return mod as Record<string, Fn>;
};

/** Trim float noise so snapshots only change on real logic changes. */
const round = (v: unknown): unknown => {
    if (typeof v === 'number') return Number.isInteger(v) ? v : Number(v.toFixed(4));
    if (Array.isArray(v)) return v.map(round);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]));
    return v;
};

describe('golden: demo dataset', () => {
    it('normalizes every match', async () => {
        expect((await loadHistory()).length).toBe(raw.matches.length);
    });

    it('calculateStats', async (ctx) => {
        const { calculateStats } = await need(ctx, () => import('../statsAggregation'), ['calculateStats']);
        expect(round(calculateStats(await loadHistory()))).toMatchSnapshot();
    });

    it('overview analytics (tier/score)', async (ctx) => {
        const { calculateStats } = await need(ctx, () => import('../statsAggregation'), ['calculateStats']);
        const { computeOverviewAnalytics } = await need(ctx, () => import('../statsScoring'), ['computeOverviewAnalytics']);
        const history = await loadHistory();
        const { bestPeakMatch, ...rest } = computeOverviewAnalytics(calculateStats(history), history);
        expect(round({ ...rest, bestPeakMatchId: (bestPeakMatch as { matchId?: string } | null)?.matchId })).toMatchSnapshot();
    });

    for (const [name, fn] of [
        ['legends', 'aggregateLegendStatsForMatches'],
        ['weapons', 'aggregateWeaponStatsForMatches'],
        ['threats', 'aggregateThreatWeaponStatsForMatches'],
        ['maps', 'aggregateMapStatsForMatches'],
    ] as const) {
        it(`aggregate: ${name}`, async (ctx) => {
            const mod = await need(ctx, () => import('../statsAggregation'), [fn]);
            expect(round(mod[fn](await loadHistory()))).toMatchSnapshot();
        });
    }

    it('teammate baseline', async (ctx) => {
        const mod = await need(ctx, () => import('../teammateStats'), ['computePlayerPerformanceBaseline', 'aggregateTeammateLegendPicksForMatches']);
        const history = await loadHistory();
        expect(round(mod.computePlayerPerformanceBaseline(history))).toMatchSnapshot('baseline');
        expect(round(mod.aggregateTeammateLegendPicksForMatches(history))).toMatchSnapshot('teammatePicks');
    });

    it('per-match detail stats', async (ctx) => {
        const mod = await need(ctx, () => import('../matchDetailStats'), [
            'getHeadshotRate', 'getDamagePerKnock', 'getTimesKnocked', 'getRevivesReceived', 'getTimeOutsideRingMs',
        ]);
        const history = await loadHistory();
        expect(history.map((m) => ({
            id: m.matchId,
            headshotRate: mod.getHeadshotRate(m),
            damagePerKnock: mod.getDamagePerKnock(m),
            timesKnocked: mod.getTimesKnocked(m),
            revives: mod.getRevivesReceived(m),
            outsideRingMs: mod.getTimeOutsideRingMs(m),
        }))).toMatchSnapshot();
    });

    it('map replay + ring overlay summary', async (ctx) => {
        const { buildMapReplay, getReplayFrame } = await need(ctx, () => import('../mapReplay'), ['buildMapReplay', 'getReplayFrame']);
        const { buildRingCircles } = await need(ctx, () => import('../ringOverlay'), ['buildRingCircles']);
        const history = await loadHistory() as unknown as Array<{ matchId?: string; ringRounds?: unknown }>;
        expect(round(history.map((m) => {
            const r = buildMapReplay(m);
            const mid = r ? getReplayFrame(r, (r.startT + r.endT) / 2) : null;
            return {
                id: m.matchId,
                lives: r?.lives.map((l: { points: unknown[] }) => l.points.length) ?? null,
                durationMs: r ? r.endT - r.startT : null,
                ringSamples: r?.activeSamples.length ?? null,
                drawableRings: r?.nextRings.filter((n: { drawable: boolean }) => n.drawable).length ?? null,
                midMarker: mid?.marker ?? null,
                circles: buildRingCircles(m.ringRounds).map((c: { kind: string; r: number }) => `${c.kind}:${Math.round(c.r)}`),
            };
        }))).toMatchSnapshot();
    });

    it('recent comparison for newest match', async (ctx) => {
        const { buildRecentComparison } = await need(ctx, () => import('../matchComparison'), ['buildRecentComparison']);
        const history = await loadHistory();
        expect(round(buildRecentComparison(history[0], history))).toMatchSnapshot();
    });
});

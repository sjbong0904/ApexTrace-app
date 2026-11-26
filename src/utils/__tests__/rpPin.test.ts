/**
 * RP attribution + match row integers (2026-11-27 SiNiz session: two uploads failed with
 * 500 on a fractional damage sum, and the next match's GEP delta was pinned on them).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';
import { describe, expect, it } from 'vitest';
// @ts-expect-error untyped proxy module (plain ESM JS)
import { rowFromMatch } from '../../../trace-proxy-server/lib/matchHistory.js';

type Fn = (...args: any[]) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

const loadEventRouter = (): Record<string, Fn> => {
    const src = readFileSync(resolve(__dirname, '../../../public/background/events.js'), 'utf8');
    const window: Record<string, unknown> = {};
    vm.runInNewContext(src, { window, console, setTimeout, clearTimeout });
    return window.EventRouter as Record<string, Fn>;
};

const T = (hhmm: string) => Date.parse(`2026-11-27T${hhmm}:00+09:00`);
const ranked = (matchId: string, start: string, end: string, extra = {}) => ({
    matchId, mode: 'Ranked', platformId: 'u1', startTime: T(start), endTime: T(end), rpProcessed: false, ...extra,
});

describe('pickLocalRpTarget', () => {
    const { pickLocalRpTarget } = loadEventRouter();

    // 01:30–01:50 win (upload failed, delta 01:50:34 arrived while it was still running),
    // 01:52–02:10 (its delta arrives 02:10:05, before match_end → still running).
    const failed = ranked('A', '01:30', '01:50');
    const running = { ...ranked('B', '01:52', '02:10'), _ending: false };

    it('does not hand the next delta to the match that owned the previous one', () => {
        const target = pickLocalRpTarget({
            history: [failed], activeMatch: running, localUid: 'u1',
            now: T('02:10'), prevRankedAt: T('01:50') - 26_000, excludeMatchId: 'A',
        });
        expect(target).toBeNull();
    });

    it('without the owner hint the failed match would be picked (old behaviour)', () => {
        const target = pickLocalRpTarget({
            history: [failed], activeMatch: running, localUid: 'u1',
            now: T('02:10'), prevRankedAt: T('01:50') - 26_000, excludeMatchId: null,
        });
        expect(target?.matchId).toBe('A');
    });

    it('still pins a delta that lands after match_end (next match in the dropship)', () => {
        const ended = ranked('C', '03:00', '03:18');
        const next = { ...ranked('D', '03:20', '03:40'), _ending: false };
        const target = pickLocalRpTarget({
            history: [ended], activeMatch: next, localUid: 'u1',
            now: T('03:19'), prevRankedAt: T('02:50'), excludeMatchId: 'B',
        });
        expect(target?.matchId).toBe('C');
    });

    it('pins the ending active match and skips processed / other-uid rows', () => {
        const ending = { ...ranked('E', '04:00', '04:18'), _ending: true };
        const target = pickLocalRpTarget({
            history: [ranked('F', '03:40', '03:59', { rpProcessed: true }), ranked('G', '03:45', '03:58', { platformId: 'u2' })],
            activeMatch: ending, localUid: 'u1', now: T('04:18'), prevRankedAt: T('03:39'), excludeMatchId: null,
        });
        expect(target?.matchId).toBe('E');
    });
});

describe('rowFromMatch integer columns', () => {
    it('rounds a fractional damage sum instead of failing the insert', () => {
        const row = rowFromMatch('u1', { matchId: 'm1', startTime: 1, damage: 2717.7999999999997, kills: 6 });
        expect(row.damage).toBe(2718);
        expect(row.kills).toBe(6);
    });

    it('rounds every integer column and keeps nulls', () => {
        const row = rowFromMatch('u1', {
            matchId: 'm2', startTime: 1, damage: 1099.6, grenadeDamage: 10.4, damageHits: null,
            placement: null, rankScore: 10811.2, rpChange: 211.6, headshots: 2,
        });
        expect(row).toMatchObject({
            damage: 1100, grenade_damage: 10, damage_hits: null, placement: null,
            rank_score: 10811, rp_change: 212, headshots: 2,
        });
        expect(row.kills).toBe(0);
    });
});

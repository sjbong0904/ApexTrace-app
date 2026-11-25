import { describe, expect, it } from 'vitest';
import { linearScore, logScore, strictify, curvedMetricScore } from '../statsScoring';
import { hybridRankScore } from '../statsAggregation';
import { applyTableSort, toggleTableSort, compareNumericStrings, compareAvgPlacement } from '../tableSort';
import { hasUsableMatchStats } from '../match';

describe('score curves', () => {
    it('linearScore clamps', () => {
        expect(linearScore(-1, 0, 10)).toBe(0);
        expect(linearScore(5, 0, 10)).toBe(50);
        expect(linearScore(11, 0, 10)).toBe(100);
        expect(linearScore(3, 5, 5)).toBe(0);
    });
    it('logScore is monotonic between floor and ceiling', () => {
        const a = logScore(300, 180, 1020);
        const b = logScore(600, 180, 1020);
        expect(a).toBeGreaterThan(0);
        expect(b).toBeGreaterThan(a);
        expect(logScore(1020, 180, 1020)).toBe(100);
    });
    it('strictify compresses mid scores', () => {
        expect(strictify(50)).toBeLessThan(50);
        expect(strictify(100)).toBe(100);
        expect(strictify(150)).toBe(100);
    });
    it('curvedMetricScore: 1000 dmg ≈ 85 pts', () => {
        expect(curvedMetricScore(1000, 1500)).toBeCloseTo(85, 5);
    });
    it('hybridRankScore penalizes tiny samples', () => {
        expect(hybridRankScore(0, 3)).toBe(0);
        expect(hybridRankScore(2, 8, 12)).toBeLessThan(hybridRankScore(60, 1.5, 12));
    });
});

describe('tableSort', () => {
    type Row = { v: string };
    const rows: Row[] = [{ v: '2.0' }, { v: '-' }, { v: '10' }, { v: '1.5' }];
    const cmp = { v: (a: Row, b: Row) => compareNumericStrings(a.v, b.v) };
    const opts = { isMissing: { v: (r: Row) => r.v === '-' } };

    it('toggles direction on same column', () => {
        const s1 = toggleTableSort<'v'>({ column: null, direction: 'desc' }, 'v');
        expect(s1).toEqual({ column: 'v', direction: 'desc' });
        expect(toggleTableSort(s1, 'v')).toEqual({ column: 'v', direction: 'asc' });
    });
    it('missing rows stay last in both directions', () => {
        expect(applyTableSort(rows, { column: 'v', direction: 'desc' }, cmp, opts).map(r => r.v)).toEqual(['10', '2.0', '1.5', '-']);
        expect(applyTableSort(rows, { column: 'v', direction: 'asc' }, cmp, opts).map(r => r.v)).toEqual(['1.5', '2.0', '10', '-']);
    });
    it('avg placement: lower is better', () => {
        expect(compareAvgPlacement('3.0', '8.0')).toBeGreaterThan(0);
    });
});

describe('hasUsableMatchStats', () => {
    it('rejects null placement or all-null stats', () => {
        expect(hasUsableMatchStats(null)).toBe(false);
        expect(hasUsableMatchStats({ placement: null, kills: 3 })).toBe(false);
        expect(hasUsableMatchStats({ placement: 4, kills: null, assists: null, damage: null })).toBe(false);
        expect(hasUsableMatchStats({ placement: 4, kills: 0 })).toBe(true);
    });
});

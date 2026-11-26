import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '../../types';
import {
    SHARE_CARD_HEIGHT,
    SHARE_FINAL_RING_OPACITY,
    SHARE_RING_OPACITY,
    SHARE_RING_WIDTH,
    SHARE_CARD_WIDTH,
    SHARE_ROUTE_CASING_WIDTH,
    SHARE_ROUTE_COLOR,
    SHARE_ROUTE_WIDTH,
} from '../../components/MatchShareCard';
import { buildShareRings } from '../shareRings';

describe('match share card route style', () => {
    it('keeps the route thin (under ~2 px on the 380 px map) with a casing just wider than it', () => {
        const pxPerUnit = SHARE_CARD_HEIGHT / 100;
        expect(SHARE_ROUTE_WIDTH * pxPerUnit).toBeLessThan(2);
        expect(SHARE_ROUTE_CASING_WIDTH).toBeGreaterThan(SHARE_ROUTE_WIDTH);
        expect(SHARE_ROUTE_CASING_WIDTH * pxPerUnit).toBeLessThan(4.5);
    });

    it('uses a colored (not white) route and a 2:1 card', () => {
        expect(SHARE_ROUTE_COLOR).toMatch(/^#[0-9a-f]{6}$/i);
        expect(SHARE_ROUTE_COLOR.toLowerCase()).not.toBe('#ffffff');
        expect(SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT).toBe(2);
    });
});

describe('match share card rings', () => {
    beforeEach(() => { vi.stubGlobal('window', {}); });
    afterEach(() => { vi.unstubAllGlobals(); });

    const demo = JSON.parse(readFileSync(resolve(__dirname, '../../assets/demo/demoMatches.json'), 'utf8')).matches as Match[];

    it('stacks every closed ring, largest first, with only the last one marked final', () => {
        const match = demo.find((m) => Array.isArray(m.ringRounds) && m.ringRounds.length >= 3);
        expect(match).toBeDefined();
        const rings = buildShareRings(match!);
        expect(rings.length).toBeGreaterThan(1);
        for (let i = 1; i < rings.length; i++) expect(rings[i].r).toBeLessThanOrEqual(rings[i - 1].r);
        expect(rings.filter((r) => r.final)).toHaveLength(1);
        expect(rings[rings.length - 1].final).toBe(true);
        for (const r of rings) {
            expect(Number.isFinite(r.cx) && Number.isFinite(r.cy)).toBe(true);
            expect(r.r).toBeGreaterThan(0);
        }
    });

    it('draws nothing for a match without ring data', () => {
        expect(buildShareRings({ map: 'Kings Canyon', path: [], startTime: 0 } as unknown as Match)).toEqual([]);
    });

    it('keeps rings thinner and dimmer than the route', () => {
        expect(SHARE_RING_WIDTH).toBeLessThan(SHARE_ROUTE_WIDTH);
        expect(SHARE_RING_OPACITY).toBeLessThan(SHARE_FINAL_RING_OPACITY);
        expect(SHARE_FINAL_RING_OPACITY).toBeLessThanOrEqual(1);
    });
});

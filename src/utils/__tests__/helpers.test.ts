import { describe, expect, it } from 'vitest';
import {
    formatFullRankName,
    formatMatchTime,
    getMatchDeaths,
    getRankColor,
    getRankTierKey,
    getRankTierNameFromRp,
    isKnownLegend,
    isSamePlayer,
    normalizeMapDisplayName,
    STAT_TIER_COLOR,
    getKdColor,
    getWinRateColor,
} from '../helpers';

describe('normalizeMapDisplayName', () => {
    it.each([
        [null, 'Unknown'],
        ['', 'Unknown'],
        ['UNKNOWN', 'Unknown'],
        ['mp_rr_desertlands_hu', "World's Edge"],
        ['worlds edge', "World's Edge"],
        ['mp_rr_canyonlands_hu', 'Kings Canyon'],
        ['mp_rr_olympus_mu2', 'Olympus'],
    ])('%s → %s', (raw, expected) => {
        expect(normalizeMapDisplayName(raw)).toBe(expected);
    });
});

describe('rank helpers', () => {
    it('placement colors by tier', () => {
        expect(getRankColor(1)).toBe(STAT_TIER_COLOR.elite);
        expect(getRankColor('#3')).toBe(STAT_TIER_COLOR.high);
        expect(getRankColor(8)).toBe(STAT_TIER_COLOR.normal);
        expect(getRankColor(15)).toBe(STAT_TIER_COLOR.low);
        expect(getRankColor('x')).toBe(STAT_TIER_COLOR.low);
    });

    it('RP floors map to tier names', () => {
        expect(getRankTierNameFromRp(0)).toBe('Rookie');
        expect(getRankTierNameFromRp(999)).toBe('Rookie');
        expect(getRankTierNameFromRp(1000)).toBe('Bronze');
        expect(getRankTierNameFromRp(8500)).toBe('Platinum');
        expect(getRankTierNameFromRp(20000)).toBe('Master');
        expect(getRankTierNameFromRp(20000, 'Apex Predator')).toBe('Apex Predator');
    });

    it('tier key ignores division', () => {
        expect(getRankTierKey('Diamond III')).toBe('diamond');
        expect(getRankTierKey(null)).toBe('unknown');
    });

    it('formatFullRankName dedupes roman suffixes', () => {
        expect(formatFullRankName('Diamond II II')).toBe('Diamond II');
        expect(formatFullRankName('Diamond II', 3)).toBe('Diamond III');
        expect(formatFullRankName('Master', 2)).toBe('Master');
        expect(formatFullRankName(null)).toBe('Unranked');
    });
});

describe('stat colors', () => {
    it('K/D thresholds', () => {
        expect(getKdColor('N/A')).toBe(STAT_TIER_COLOR.missing);
        expect(getKdColor(0.5)).toBe(STAT_TIER_COLOR.low);
        expect(getKdColor('1.0')).toBe(STAT_TIER_COLOR.normal);
        expect(getKdColor(1.5)).toBe(STAT_TIER_COLOR.high);
        expect(getKdColor(2)).toBe(STAT_TIER_COLOR.elite);
    });
    it('win rate respects hasValue', () => {
        expect(getWinRateColor('25%')).toBe(STAT_TIER_COLOR.elite);
        expect(getWinRateColor(25, { hasValue: false })).toBe(STAT_TIER_COLOR.missing);
    });
});

describe('formatMatchTime', () => {
    it('digital and text', () => {
        expect(formatMatchTime(65_000)).toBe('1:05');
        expect(formatMatchTime(65_000, 'text')).toBe('1m 5s');
        expect(formatMatchTime(-5)).toBe('0:00');
    });
});

describe('player / legend identity', () => {
    it('isSamePlayer ignores clan tags, spaces, case', () => {
        expect(isSamePlayer('[TAG] Foo Bar', 'foobar')).toBe(true);
        expect(isSamePlayer('foo', null)).toBe(false);
        expect(isSamePlayer('foo', 'bar')).toBe(false);
    });
    it('isKnownLegend', () => {
        expect(isKnownLegend('Wraith')).toBe(true);
        expect(isKnownLegend('unknown')).toBe(false);
        expect(isKnownLegend(undefined)).toBe(false);
    });
});

describe('getMatchDeaths', () => {
    it('prefers stored deaths', () => {
        expect(getMatchDeaths({ deaths: 2, placement: 1 })).toBe(2);
    });
    it('counts death events for the player', () => {
        expect(getMatchDeaths({
            playerName: 'Me',
            placement: 5,
            events: [
                { type: 'death', victim: '[X] me' },
                { type: 'death', victim: 'other' },
                { type: 'kill', victim: 'me' },
            ],
        })).toBe(1);
    });
    it('legacy fallback: win=0 / loss=1', () => {
        expect(getMatchDeaths({ placement: 1 })).toBe(0);
        expect(getMatchDeaths({ placement: '7' })).toBe(1);
    });
});

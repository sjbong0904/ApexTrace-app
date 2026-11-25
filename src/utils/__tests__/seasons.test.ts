import { beforeEach, describe, expect, it } from 'vitest';
import {
    getSelectableSeasons,
    hasSeasonStarted,
    resolveCurrentSeason,
    resolveCurrentSeasonId,
    resolveSeasonEndMs,
    type SeasonBoundary,
} from '../seasons';
import {
    findSeasonGroup,
    getSeasonGroupRange,
    getSelectionRange,
    groupSeasons,
    parseSeasonNumberFromName,
    readWholeSeason,
    splitNumberOf,
    storeWholeSeason,
} from '../seasonGroups';

const DAY = 86_400_000;
const NOW = 100 * DAY;

/** S27 (one split, ended) · S28 split 1 + 2 (split 2 open-ended, current) · S29 not started. */
const seasons: SeasonBoundary[] = [
    { id: 1, name: 'Season 27', startTime: 10 * DAY, endTime: 50 * DAY },
    { id: 2, name: 'Season 28 : Split 1', startTime: 50 * DAY, endTime: null },
    { id: 3, name: 'Season 28 : Split 2', startTime: 80 * DAY, endTime: null },
    { id: 4, name: 'Season 29', startTime: 200 * DAY, endTime: null },
];

describe('seasons', () => {
    it('hides seasons that have not started yet', () => {
        expect(hasSeasonStarted(seasons[3], NOW)).toBe(false);
        expect(getSelectableSeasons(seasons, NOW).map((s) => s.id)).toEqual([3, 2, 1]);
    });

    it('current season = latest started one containing now', () => {
        expect(resolveCurrentSeason(seasons, NOW)?.id).toBe(3);
        expect(resolveCurrentSeasonId(seasons, 60 * DAY)).toBe(2);
        expect(resolveCurrentSeason(seasons, 0)).toBeUndefined();
    });

    it('end = explicit endTime, else next season start, else open', () => {
        expect(resolveSeasonEndMs(seasons, 1)).toBe(50 * DAY);
        expect(resolveSeasonEndMs(seasons, 2)).toBe(80 * DAY);
        expect(resolveSeasonEndMs(seasons, 4)).toBeNull();
        expect(resolveSeasonEndMs(seasons, 999)).toBeNull();
    });
});

describe('seasonGroups', () => {
    it('parses season numbers', () => {
        expect(parseSeasonNumberFromName('Season 28 : Split 2')).toBe(28);
        expect(parseSeasonNumberFromName('season28')).toBe(28);
        expect(parseSeasonNumberFromName('Launch')).toBeNull();
        expect(parseSeasonNumberFromName(null)).toBeNull();
    });

    it('groups splits by season, newest season first, splits oldest first', () => {
        const groups = groupSeasons(seasons, NOW);
        expect(groups.map((g) => g.key)).toEqual(['s28', 's27']);
        expect(groups[0].splits.map((s) => s.id)).toEqual([2, 3]);
    });

    it('rows without a season number get their own group', () => {
        const groups = groupSeasons([{ id: 9, name: 'Launch', startTime: 0 }], NOW);
        expect(groups[0].key).toBe('id:9');
    });

    it('split number from name, else position', () => {
        const [s28] = groupSeasons(seasons, NOW);
        expect(splitNumberOf(s28, 3)).toBe(2);
        const unnamed = { key: 'x', seasonNumber: 1, splits: [{ id: 7, name: 'A', startTime: 0 }, { id: 8, name: 'B', startTime: 1 }] };
        expect(splitNumberOf(unnamed, 8)).toBe(2);
    });

    it('whole-season range spans first split start → last split end', () => {
        const groups = groupSeasons(seasons, NOW);
        expect(getSeasonGroupRange(seasons, groups[0])).toEqual({ startTime: 50 * DAY, endTime: 200 * DAY });
        expect(findSeasonGroup(groups, 1)?.key).toBe('s27');
    });

    it('selection range: one split vs whole season', () => {
        const groups = groupSeasons(seasons, NOW);
        expect(getSelectionRange(seasons, groups, 3, false)).toEqual({ startTime: 80 * DAY, endTime: 200 * DAY });
        expect(getSelectionRange(seasons, groups, 3, true)).toEqual({ startTime: 50 * DAY, endTime: 200 * DAY });
        // Single-split season ignores the whole-season toggle.
        expect(getSelectionRange(seasons, groups, 1, true)).toEqual({ startTime: 10 * DAY, endTime: 50 * DAY });
        expect(getSelectionRange(seasons, groups, 999, true)).toBeNull();
    });

    describe('whole-season preference', () => {
        beforeEach(() => localStorage.clear());
        it('defaults off and round-trips', () => {
            expect(readWholeSeason()).toBe(false);
            storeWholeSeason(true);
            expect(readWholeSeason()).toBe(true);
            storeWholeSeason(false);
            expect(readWholeSeason()).toBe(false);
        });
    });
});

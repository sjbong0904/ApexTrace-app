import { describe, expect, it } from 'vitest';
import {
    getModeColor,
    getModeDisplayLabel,
    isMissingGameMode,
    isSupportedMode,
    matchesHistoryTab,
    matchesStatisticsMode,
} from '../matchMode';

describe('matchMode', () => {
    it('missing / fallback / supported', () => {
        expect(isMissingGameMode(undefined)).toBe(true);
        expect(isMissingGameMode(' Unknown ')).toBe(true);
        expect(isMissingGameMode('Trios')).toBe(false);
        expect(isSupportedMode('BR')).toBe(true);
        expect(isSupportedMode('Ranked Leagues')).toBe(true);
        expect(isSupportedMode('Mixtape')).toBe(false);
    });

    it.each([
        // mode, BR, RANKED, TRIO, DUO
        ['Ranked Trios', true, true, false, false],
        ['Trios', true, false, true, false],
        ['Duos', true, false, false, true],
        ['BR', true, false, false, false],
        ['Mixtape', false, false, false, false],
    ] as const)('%s → tabs', (mode, br, ranked, trio, duo) => {
        expect(matchesHistoryTab(mode, 'BR')).toBe(br);
        expect(matchesHistoryTab(mode, 'RANKED')).toBe(ranked);
        expect(matchesHistoryTab(mode, 'TRIO')).toBe(trio);
        expect(matchesHistoryTab(mode, 'DUO')).toBe(duo);
    });

    it('statistics mode filter', () => {
        expect(matchesStatisticsMode('BR', 'ALL')).toBe(true);
        expect(matchesStatisticsMode('Mixtape', 'ALL')).toBe(false);
        expect(matchesStatisticsMode('Ranked Trios', 'TRIO')).toBe(false);
        expect(matchesStatisticsMode('Ranked Trios', 'RANKED')).toBe(true);
    });

    it('labels and colors', () => {
        expect(getModeDisplayLabel('br')).toBe('BR');
        expect(getModeDisplayLabel('')).toBe('Unknown');
        expect(getModeDisplayLabel('Duos')).toBe('Duos');
        expect(getModeColor('Ranked Duos')).toBe('var(--color-mode-ranked)');
        expect(getModeColor('Trios')).toBe('var(--color-mode-trio)');
        expect(getModeColor('BR')).toBe('var(--color-mode-other)');
    });
});

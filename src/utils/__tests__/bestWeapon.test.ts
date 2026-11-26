import { describe, expect, it } from 'vitest';
import { getBestWeapon } from '../weaponMatchStats';

const entry = (kills: number, assists: number, holdMs: number) => ({ kills, assists, holdMs, deaths: 0, qualify: true });

describe('getBestWeapon', () => {
    it('ranks by kills, then assists, then hold time', () => {
        const best = getBestWeapon({
            weaponCombat: {
                r99: entry(2, 0, 60_000),
                flatline: entry(2, 1, 10_000),
                wingman: entry(2, 1, 90_000),
            },
        } as never);
        expect(best?.id).toBe('wingman');
        expect(best?.kills).toBe(2);
    });

    it('ignores unknown weapons and returns null when nothing is left', () => {
        expect(getBestWeapon({ weaponCombat: { unknown: entry(5, 0, 1) } } as never)).toBeNull();
        expect(getBestWeapon({} as never)).toBeNull();
    });
});

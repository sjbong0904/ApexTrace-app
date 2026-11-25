import { describe, expect, it } from 'vitest';
import { AMMO_COLORS } from '../gameData';
import { AMMO_CARD_SHADES, getWeaponCardBackground } from '../weaponTheme';

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const whiteContrast = (hex: string) => {
    const [r, g, b] = (hex.replace('#', '').match(/../g) ?? []).map((h) => lin(parseInt(h, 16) / 255));
    return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
};

describe('Best weapon card shades', () => {
    it('has a shade pair for every ammo color', () => {
        for (const ammo of Object.keys(AMMO_COLORS)) expect(AMMO_CARD_SHADES[ammo]).toHaveLength(2);
    });

    it('keeps white text >= 4.5:1 on both stops (card has 11px text)', () => {
        for (const [ammo, stops] of Object.entries(AMMO_CARD_SHADES)) {
            for (const hex of stops) expect(whiteContrast(hex), `${ammo} ${hex}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('falls back to Light ammo for unknown weapons', () => {
        const [a, b] = AMMO_CARD_SHADES.Light;
        expect(getWeaponCardBackground('weapon_does_not_exist')).toBe(`linear-gradient(135deg, ${a} 0%, ${b} 100%)`);
        expect(getWeaponCardBackground(null)).toBe(`linear-gradient(135deg, ${a} 0%, ${b} 100%)`);
    });
});

import { describe, expect, it } from 'vitest';
import { AMMO_COLORS } from '../gameData';
import { AMMO_CARD_SHADES, AMMO_ICON_COLORS, getWeaponCardBackground, whiteTextContrast, WEAPON_CARD_TEXT_WIDTH } from '../weaponTheme';

const hue = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
};

describe('Best weapon card shades', () => {
    it('has an icon color and three stops for every ammo color', () => {
        for (const ammo of Object.keys(AMMO_COLORS)) {
            expect(AMMO_ICON_COLORS[ammo], ammo).toMatch(/^#[0-9a-f]{6}$/);
            expect(AMMO_CARD_SHADES[ammo]).toHaveLength(3);
        }
    });

    it('ends on the exact in-game icon color', () => {
        for (const [ammo, stops] of Object.entries(AMMO_CARD_SHADES)) expect(stops[2]).toBe(AMMO_ICON_COLORS[ammo]);
    });

    it('keeps white text >= 4.5:1 on the text side (card has 11px text)', () => {
        for (const [ammo, [deep, text]] of Object.entries(AMMO_CARD_SHADES)) {
            expect(whiteTextContrast(deep), `${ammo} ${deep}`).toBeGreaterThanOrEqual(4.5);
            expect(whiteTextContrast(text), `${ammo} ${text}`).toBeGreaterThanOrEqual(4.5);
            // Not darker than needed: the text stop stays close to the threshold.
            expect(whiteTextContrast(text), `${ammo} ${text}`).toBeLessThan(4.8);
        }
    });

    it('darkens without shifting hue', () => {
        for (const [ammo, [deep, text, icon]] of Object.entries(AMMO_CARD_SHADES)) {
            expect(Math.abs(hue(deep) - hue(icon)), ammo).toBeLessThan(0.05);
            expect(Math.abs(hue(text) - hue(icon)), ammo).toBeLessThan(0.05);
        }
    });

    it('blends two-ammo weapons in ammo order (C.A.R.: Heavy → Light)', () => {
        const [h0, h1] = AMMO_CARD_SHADES.Heavy;
        const [, , l2] = AMMO_CARD_SHADES.Light;
        expect(getWeaponCardBackground('car-smg')).toBe(`linear-gradient(90deg, ${h0} 0%, ${h1} ${WEAPON_CARD_TEXT_WIDTH}, ${l2} 100%)`);
    });

    it('falls back to Light ammo for unknown weapons', () => {
        const [a, b, c] = AMMO_CARD_SHADES.Light;
        const expected = `linear-gradient(90deg, ${a} 0%, ${b} ${WEAPON_CARD_TEXT_WIDTH}, ${c} 100%)`;
        expect(getWeaponCardBackground('weapon_does_not_exist')).toBe(expected);
        expect(getWeaponCardBackground(null)).toBe(expected);
    });
});

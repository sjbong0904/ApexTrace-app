import type { CSSProperties } from 'react';
import { AMMO_COLORS, SHORT_WEAPON_NAMES } from './gameData';
import { previewImageUrl } from './imageSource';
import { WEAPONS_DB, type WeaponInfo, type WeaponVariant } from './WeaponsData';

export interface WeaponTagTheme {
    color: string;
    themeColor: string;
    bgGradient?: string;
    shineGradient?: string;
}

export type WeaponTagTier = 'god' | 'master' | 'user';

export const PROFILE_IMAGE_BASE = '/images';

/** Non-transparent PNG pixels → pure white silhouette (alpha preserved). */
export const WHITE_SILHOUETTE_FILTER = 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.35))';

const loadoutKey = (raw: string): string =>
    raw.toLowerCase().trim().replace(/[\s.]/g, '').replace(/_/g, '-');

const loadoutKeyFlat = (raw: string): string => loadoutKey(raw).replace(/-/g, '');

export function findWeaponByLoadoutId(rawName: string): WeaponInfo | undefined {
    if (!rawName || rawName === 'unknown' || rawName === 'none') return undefined;

    const key = loadoutKey(rawName);
    const keyFlat = loadoutKeyFlat(rawName);

    const exact = WEAPONS_DB.find(w => loadoutKey(w.id) === key);
    if (exact) return exact;

    const partial = WEAPONS_DB.filter(w => {
        const wFlat = loadoutKeyFlat(w.id);
        return wFlat === keyFlat || keyFlat.startsWith(wFlat) || wFlat.startsWith(keyFlat);
    });

    if (partial.length === 0) return undefined;
    return partial.find(w => w.variant === 'STANDARD') ?? partial[0];
}

/** Canonical catalog id when known (e.g. weapon_prowler → prowler). */
export function getCanonicalWeaponId(rawName: string): string {
    return findWeaponByLoadoutId(rawName)?.id ?? rawName;
}

const looksLikeI18nKey = (value: string): boolean =>
    value.includes('.') && (
        value.startsWith('weaponDb.')
        || value.startsWith('statistics.')
        || value.startsWith('sidebar.')
    );

/**
 * Human label for loadout / combat ids.
 * Prefer short names over i18n so missing weaponDb packs don't show raw keys.
 */
export function getWeaponDisplayName(rawName: string): string {
    const found = findWeaponByLoadoutId(rawName);
    const short =
        SHORT_WEAPON_NAMES(rawName)
        ?? (found ? SHORT_WEAPON_NAMES(found.id) : null);
    if (short) return short;

    if (found) {
        const localized = found.name();
        if (localized && !looksLikeI18nKey(localized)) return localized;
    }

    return String(rawName)
        .replace(/^weapon[_-]?/i, '')
        .replace(/[-_]/g, ' ')
        .trim()
        .toUpperCase() || rawName;
}

export function weaponsMatchId(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    return getCanonicalWeaponId(a) === getCanonicalWeaponId(b);
}

const darkenHex = (hex: string, factor: number): string => {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) return hex;
    const num = parseInt(normalized, 16);
    const r = Math.round(((num >> 16) & 255) * factor);
    const g = Math.round(((num >> 8) & 255) * factor);
    const b = Math.round((num & 255) * factor);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const resolveAmmoColors = (ammoTypes: string[], variant: WeaponVariant): { primary: string; secondary: string } => {
    if (variant === 'CARE_PACKAGE') {
        const c = AMMO_COLORS.Mythic;
        return { primary: c, secondary: darkenHex(c, 0.55) };
    }
    if (variant === 'ELITE') {
        return { primary: '#FFD700', secondary: '#FFA500' };
    }
    if (ammoTypes.length > 1) {
        const c1 = AMMO_COLORS[ammoTypes[0]] ?? '#888888';
        const c2 = AMMO_COLORS[ammoTypes[1]] ?? darkenHex(c1, 0.7);
        return { primary: c1, secondary: c2 };
    }
    const c = AMMO_COLORS[ammoTypes[0]] ?? '#888888';
    return { primary: c, secondary: darkenHex(c, 0.58) };
};

const buildWeaponTagTheme = (ammoTypes: string[], variant: WeaponVariant, tier: WeaponTagTier): WeaponTagTheme => {
    const { primary, secondary } = resolveAmmoColors(ammoTypes, variant);

    if (tier === 'user') {
        return { color: primary, themeColor: primary };
    }

    const bgGradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;

    if (tier === 'god') {
        return {
            color: '#fff',
            themeColor: primary,
            bgGradient,
            shineGradient: `linear-gradient(110deg, ${darkenHex(primary, 0.35)} 20%, ${primary} 50%, ${darkenHex(secondary, 0.35)} 80%)`,
        };
    }

    return {
        color: '#fff',
        themeColor: primary,
        bgGradient,
    };
};

export function getWeaponTagTheme(rawName: string, tier: WeaponTagTier = 'master'): WeaponTagTheme {
    const weapon = findWeaponByLoadoutId(rawName);
    const ammoTypes = weapon?.ammoType?.length ? weapon.ammoType : ['Light'];
    const variant = weapon?.variant ?? 'STANDARD';
    return buildWeaponTagTheme(ammoTypes, variant, tier);
}

export function getWeaponImageId(rawName: string): string {
    return findWeaponByLoadoutId(rawName)?.id ?? rawName;
}

/**
 * Prefer catalog `image` URL (handles special files like c.a.r..png).
 * Served from the image cache after the first Supabase download.
 */
export function getWeaponImageUrl(rawName: string): string {
    const found = findWeaponByLoadoutId(rawName);
    if (found?.image) return previewImageUrl(found.image);
    return previewImageUrl(`${PROFILE_IMAGE_BASE}/${getWeaponImageId(rawName)}.png`);
}

/**
 * Game HUD silhouette (white, tightly cropped) uploaded next to each weapon render as
 * "<render name>_silhouette.png" by scripts/game-icons/sync_supabase.py.
 * Akimbo variants have their own silhouette even when they share the single-gun render.
 */
const AKIMBO_SILHOUETTE_IDS = new Set(['mozambique_akimbo', 'p2020_akimbo', 'wingman_akimbo']);

export function getWeaponSilhouetteUrl(rawName: string): string {
    const found = findWeaponByLoadoutId(rawName);
    let stem: string;
    if (found && AKIMBO_SILHOUETTE_IDS.has(found.id)) {
        stem = found.id;
    } else if (found?.image) {
        const file = decodeURIComponent(found.image.split('/').pop() ?? '');
        stem = file.replace(/\.png$/i, '');
    } else {
        stem = getWeaponImageId(rawName);
    }
    return `${PROFILE_IMAGE_BASE}/${encodeURIComponent(stem)}_silhouette.png`;
}

export function getLegendImageId(rawName: string): string {
    return rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
}

/**
 * Size multiplier for weapon silhouettes. The old colour renders had uneven padding, so long guns
 * were scaled up 1.28×; the HUD silhouettes are tightly cropped, so every weapon renders at 1×.
 * Kept as a function so callers stay unchanged if a weapon ever needs a tweak.
 */
export function getWeaponSilhouetteScale(rawName?: string | null): number {
    void rawName;
    return 1;
}

const getWeaponAmmoColor = (rawName?: string | null): string => {
    if (!rawName || rawName === 'unknown' || rawName === 'none') {
        return AMMO_COLORS.Light;
    }
    const weapon = findWeaponByLoadoutId(rawName);
    const variant = weapon?.variant ?? 'STANDARD';
    if (variant === 'CARE_PACKAGE') return AMMO_COLORS.Mythic;
    const ammo = weapon?.ammoType?.[0] ?? 'Light';
    return AMMO_COLORS[ammo] ?? AMMO_COLORS.Light;
};

/**
 * Frame colour of each in-game ammo icon (rui/hud/gametype_icons/survival/sur_ammo_*.png,
 * build R5pc_r5-310): median of the icon's saturated rim pixels. Mythic = care-package icons
 * (kraber / bocek share the same red frame).
 */
export const AMMO_ICON_COLORS: Record<string, string> = {
    Light: '#f59a4a',   // sur_ammo_bullet
    Heavy: '#6acea9',   // sur_ammo_bullet_large
    Energy: '#c6dd3a',  // sur_ammo_special
    Sniper: '#7d84ff',  // sur_ammo_sniper
    Shotgun: '#ff2c01', // sur_ammo_shotgun
    Mythic: '#ec0048',  // sur_ammo_kraber / sur_ammo_bocek
    Arrows: '#e8c25a',  // sur_ammo_arrows
};

const srgbToLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** WCAG contrast of white text on `hex`. */
export function whiteTextContrast(hex: string): number {
    const n = parseInt(hex.replace('#', ''), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => srgbToLinear(c / 255));
    return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/** Same hue, darkened (RGB scaled) just enough for white text to reach `target` contrast. */
const darkenForWhiteText = (hex: string, target: number): string => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (whiteTextContrast(darkenHex(hex, mid)) >= target) lo = mid; else hi = mid;
    }
    let out = darkenHex(hex, lo);
    // Rounding to 8-bit can land a hair under the target; step down until it holds.
    for (let f = lo; whiteTextContrast(out) < target && f > 0; f -= 0.005) out = darkenHex(hex, f);
    return out;
};

/** Text side of the card (white 11px text) must keep ≥ 4.5:1; the far left goes deeper. */
const CARD_TEXT_CONTRAST = 4.5;
const CARD_DEEP_CONTRAST = 8;

/**
 * Best-weapon card stops: [deep, text, icon]. The icon colour sits on the right under the
 * weapon silhouette and darkens toward the left, where the white text is.
 */
export const AMMO_CARD_SHADES: Record<string, readonly [string, string, string]> = Object.fromEntries(
    Object.entries(AMMO_ICON_COLORS).map(([ammo, hex]) => [
        ammo,
        [darkenForWhiteText(hex, CARD_DEEP_CONTRAST), darkenForWhiteText(hex, CARD_TEXT_CONTRAST), hex] as const,
    ]),
);

/** Where the text-safe stop sits; card text is capped to this width. */
export const WEAPON_CARD_TEXT_WIDTH = '58%';

/**
 * Ammo-icon-colored card background: real icon colour on the right, darkening to the left.
 * Two-ammo weapons read left → right in ammo order: dark side of the first ammo, icon colour of
 * the second (C.A.R. = Heavy → Light).
 */
export function getWeaponCardBackground(rawName?: string | null): string {
    const weapon = rawName ? findWeaponByLoadoutId(rawName) : undefined;
    const variant = weapon?.variant ?? 'STANDARD';
    const ammo = weapon?.ammoType?.length ? weapon.ammoType : ['Light'];
    const shadeOf = (type: string) => AMMO_CARD_SHADES[type] ?? AMMO_CARD_SHADES.Light;
    let dark: readonly [string, string, string], bright: readonly [string, string, string];
    if (variant === 'CARE_PACKAGE') dark = bright = AMMO_CARD_SHADES.Mythic;
    else if (variant === 'ELITE') dark = bright = AMMO_CARD_SHADES.Arrows;
    else { dark = shadeOf(ammo[0]); bright = shadeOf(ammo[1] ?? ammo[0]); }
    return `linear-gradient(90deg, ${dark[0]} 0%, ${dark[1]} ${WEAPON_CARD_TEXT_WIDTH}, ${bright[2]} 100%)`;
}

/** Primary ammo / variant color for silhouettes and accents. */
export function getWeaponAmmoTint(rawName?: string | null): string {
    return getWeaponAmmoColor(rawName);
}

/**
 * White silhouette recolored to ammo tint.
 * Mask keeps alpha; drop-shadow matches {@link WHITE_SILHOUETTE_FILTER}.
 */
export function getWeaponAmmoSilhouetteStyle(
    rawName: string,
    size: { width: number | string; height: number | string },
): CSSProperties {
    const src = getWeaponSilhouetteUrl(rawName);
    const color = getWeaponAmmoColor(rawName);
    const scale = getWeaponSilhouetteScale(rawName);
    return {
        display: 'inline-block',
        width: size.width,
        height: size.height,
        flexShrink: 0,
        backgroundColor: color,
        WebkitMaskImage: `url("${src}")`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskImage: `url("${src}")`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'center',
    };
}

/** Combat-log row tint from primary + secondary weapon ammo types. */
export function getLoadoutRowTheme(primaryWeapon?: string | null, secondaryWeapon?: string | null) {
    const primaryColor = getWeaponAmmoColor(primaryWeapon);
    const secondaryColor = getWeaponAmmoColor(secondaryWeapon);
    return {
        rowBg: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 34%, var(--color-bg-card)) 0%, color-mix(in srgb, ${secondaryColor} 34%, var(--color-bg-card)) 100%)`,
        borderColor: primaryColor,
    };
}

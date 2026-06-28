import { AMMO_COLORS } from './gameData';
import { WEAPONS_DB, type WeaponInfo, type WeaponVariant } from './WeaponsData';

export interface WeaponTagTheme {
    color: string;
    themeColor: string;
    bgGradient?: string;
    shineGradient?: string;
}

export type WeaponTagTier = 'god' | 'master' | 'user';

export const PROFILE_IMAGE_BASE = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images';

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

export function getLegendImageId(rawName: string): string {
    return rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
}

/** Pistols / compact SMGs keep default silhouette size in loadout + profile tags. */
const COMPACT_SILHOUETTE_WEAPON_IDS = new Set([
    'alternator',
    'prowler',
    'mozambique',
    'wingman',
    're-45',
    'p2020',
]);

export const WEAPON_SILHOUETTE_SCALE_LARGE = 1.28;

export function getWeaponSilhouetteScale(rawName?: string | null): number {
    if (!rawName) return 1;
    const weapon = findWeaponByLoadoutId(rawName);
    const canonicalId = loadoutKey(weapon?.baseId ?? weapon?.id ?? rawName);
    if (COMPACT_SILHOUETTE_WEAPON_IDS.has(canonicalId)) return 1;
    return WEAPON_SILHOUETTE_SCALE_LARGE;
}

const getWeaponAmmoColor = (rawName?: string | null): string => {
    if (!rawName || rawName === 'unknown' || rawName === 'none') {
        return AMMO_COLORS.Light;
    }
    const weapon = findWeaponByLoadoutId(rawName);
    const variant = weapon?.variant ?? 'STANDARD';
    if (variant === 'CARE_PACKAGE') return AMMO_COLORS.Mythic;
    if (variant === 'ELITE') return '#FFD700';
    const ammo = weapon?.ammoType?.[0] ?? 'Light';
    return AMMO_COLORS[ammo] ?? AMMO_COLORS.Light;
};

/** Combat-log row tint from primary + secondary weapon ammo types. */
export function getLoadoutRowTheme(primaryWeapon?: string | null, secondaryWeapon?: string | null) {
    const primaryColor = getWeaponAmmoColor(primaryWeapon);
    const secondaryColor = getWeaponAmmoColor(secondaryWeapon);
    return {
        rowBg: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 34%, var(--color-bg-card)) 0%, color-mix(in srgb, ${secondaryColor} 34%, var(--color-bg-card)) 100%)`,
        borderColor: primaryColor,
    };
}

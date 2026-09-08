import i18n from '../i18n';
import { supabase } from '../lib/supabase';
import { SHORT_WEAPON_NAMES } from './gameData';
import { WEAPON_FALLBACK_ROWS, type WeaponRow } from './weaponFallbackRows';
import type { WeaponDbRow, WeaponInfo } from './weaponTypes';

const looksLikeI18nKey = (value: string): boolean =>
    value.includes('.') && (value.startsWith('weaponDb.') || value.startsWith('statistics.') || value.startsWith('sidebar.'));

const fallbackWeaponLabel = (id: string): string =>
    SHORT_WEAPON_NAMES(id)
    ?? (String(id)
        .replace(/^weapon[_-]?/i, '')
        .replace(/[-_]/g, ' ')
        .trim()
        .toUpperCase() || id);

export type {
    LevelStats,
    WeaponCategory,
    WeaponDbRow,
    WeaponInfo,
    WeaponStats,
    WeaponVariant,
} from './weaponTypes';

export function rowToWeaponInfo(row: WeaponRow): WeaponInfo {
    return {
        id: row.id,
        baseId: row.baseId,
        variant: row.variant,
        category: row.category,
        FireMods: row.FireMods,
        ammoType: row.ammoType,
        image: row.image,
        stats: row.stats,
        attachments: row.attachments,
        hopup: row.hopup,
        care_hopup: row.care_hopup,
        hopup_point: row.hopup_point,
        name: () => {
            const translated = String(i18n.t(row.nameKey, { defaultValue: '' }) || '');
            if (translated && !looksLikeI18nKey(translated)) return translated;
            return fallbackWeaponLabel(row.id);
        },
        description: () => {
            const translated = String(i18n.t(row.descKey, { defaultValue: '' }) || '');
            if (translated && !looksLikeI18nKey(translated)) return translated;
            return '';
        },
    };
}

export function dbRowToWeaponInfo(row: WeaponDbRow): WeaponInfo {
    const plain: WeaponRow = {
        id: row.id,
        baseId: row.base_id || undefined,
        variant: (row.variant as WeaponRow['variant']) || 'STANDARD',
        category: row.category as WeaponRow['category'],
        FireMods: row.fire_modes || [],
        ammoType: row.ammo_types || [],
        image: row.image_url || '',
        nameKey: row.name_key,
        descKey: row.desc_key,
        stats: row.stats || { dmg: { body: 0, head: 0, leg: 0 }, magSize: { lv0: 0 } },
        attachments: row.attachments || [],
        hopup: row.hopup || undefined,
        care_hopup: row.care_hopup || undefined,
        hopup_point: row.hopup_point ?? undefined,
    };
    return rowToWeaponInfo(plain);
}

export function weaponInfoToDbRow(info: WeaponInfo & { nameKey?: string; descKey?: string }, sortOrder = 0): Record<string, unknown> {
    const nameKey = info.nameKey || `weaponDb.names.${info.id.replace(/-/g, '')}`;
    const descKey = info.descKey || `weaponDb.desc.${info.id.replace(/-/g, '')}`;
    return {
        id: info.id,
        base_id: info.baseId ?? null,
        variant: info.variant,
        category: info.category,
        fire_modes: info.FireMods,
        ammo_types: info.ammoType,
        image_url: info.image,
        stats: info.stats,
        attachments: info.attachments,
        hopup: info.hopup ?? null,
        care_hopup: info.care_hopup ?? null,
        hopup_point: info.hopup_point ?? null,
        name_key: nameKey,
        desc_key: descKey,
        schema_version: 1,
        is_active: true,
        sort_order: sortOrder,
    };
}

function replaceWeaponsDb(next: WeaponInfo[]) {
    WEAPONS_DB.length = 0;
    WEAPONS_DB.push(...next);
}

/** Mutable list — remote load mutates in place so existing imports stay live. */
export const WEAPONS_DB: WeaponInfo[] = WEAPON_FALLBACK_ROWS.map(rowToWeaponInfo);

export async function loadWeaponsFromRemote(): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('weapons')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true });

        if (!error && data && data.length > 0) {
            replaceWeaponsDb(data.map((row) => dbRowToWeaponInfo(row as WeaponDbRow)));
            return true;
        }
    } catch {
        /* local fallback weapons */
    }
    return false;
}

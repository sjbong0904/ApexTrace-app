import { LEGENDS_LIST } from './gameData';
import { WEAPONS_DB, type WeaponCategory } from './WeaponsData';

export type TierTableMode = 'legend' | 'weapon';

export interface TierRowDef {
    id: string;
    label: string;
    color?: string;
}

export interface TierTableItem {
    id: string;
    label: string;
    image: string;
}

export interface TierTableState {
    tiers: TierRowDef[];
    assignments: Record<string, string[]>;
}

const IMAGE_BASE = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images';
export const TIER_FALLBACK_IMG = `${IMAGE_BASE}/unknown.png`;
export const APEXTRACE_LOGO = '/icons/IconMouseOver.png';

export const DEFAULT_TIER_LABELS = ['S', 'A', 'B', 'C', 'D', 'F'];

export const TIER_LABEL_MAX_LENGTH = 24;

/** Scale tier label font down as text length grows (fits the ~108px tier column). */
export const getTierLabelFontSize = (label: string): number => {
    const len = label.trim().length || 1;
    const max = 18;
    const min = 8;
    if (len <= 3) return max;
    const size = Math.round(max - (len - 3) * 0.65);
    return Math.max(min, Math.min(max, size));
};

/** Matches Weapons tab category grid order. */
const WEAPON_CATEGORY_ORDER: WeaponCategory[] = ['AR', 'SMG', 'LMG', 'MARKSMAN', 'SNIPER', 'SHOTGUN', 'PISTOL'];

export const TIER_ROW_COLORS: Record<string, string> = {
    S: '#ff4757',
    A: '#ff9f43',
    B: '#feca57',
    C: '#1dd1a1',
    D: '#54a0ff',
    F: '#8395a7',
};

export const TIER_COLOR_CYCLE = [
    '#ff4757',
    '#ff9f43',
    '#feca57',
    '#1dd1a1',
    '#54a0ff',
    '#8395a7',
    '#a29bfe',
    '#fd79a8',
    '#00cec9',
    '#e17055',
];

export const formatLegendLabel = (slug: string): string =>
    slug.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const getLegendImageUrl = (slug: string): string => `${IMAGE_BASE}/${slug}.png`;

export const buildLegendItems = (): TierTableItem[] =>
    LEGENDS_LIST.map((slug) => ({
        id: slug,
        label: formatLegendLabel(slug),
        image: getLegendImageUrl(slug),
    }));

export const buildWeaponItems = (): TierTableItem[] => {
    const seen = new Set<string>();
    const items: TierTableItem[] = [];

    for (const category of WEAPON_CATEGORY_ORDER) {
        for (const weapon of WEAPONS_DB) {
            if (weapon.variant !== 'STANDARD' || weapon.category !== category) continue;
            const baseKey = weapon.baseId ?? weapon.id;
            if (seen.has(baseKey)) continue;
            seen.add(baseKey);
            items.push({
                id: weapon.id,
                label: weapon.name(),
                image: weapon.image,
            });
        }
    }

    return items;
};

export const getItemsForMode = (mode: TierTableMode): TierTableItem[] =>
    mode === 'legend' ? buildLegendItems() : buildWeaponItems();

export const getTierColor = (label: string): string =>
    TIER_ROW_COLORS[label.trim().toUpperCase()] ?? TIER_COLOR_CYCLE[0];

export const getTierRowColor = (tier: TierRowDef, index: number): string => {
    if (tier.color) return tier.color;
    const fromLabel = TIER_ROW_COLORS[tier.label.trim().toUpperCase()];
    if (fromLabel) return fromLabel;
    return TIER_COLOR_CYCLE[index % TIER_COLOR_CYCLE.length];
};

const normalizeTierRows = (tiers: TierRowDef[]): TierRowDef[] =>
    tiers.map((tier, index) => ({
        ...tier,
        color: tier.color
            ?? TIER_ROW_COLORS[tier.label.trim().toUpperCase()]
            ?? TIER_COLOR_CYCLE[index % TIER_COLOR_CYCLE.length],
    }));

export const createDefaultTableState = (): TierTableState => ({
    tiers: DEFAULT_TIER_LABELS.map((label, index) => ({
        id: `tier-${index}-${label.toLowerCase()}`,
        label,
        color: TIER_ROW_COLORS[label] ?? TIER_COLOR_CYCLE[index % TIER_COLOR_CYCLE.length],
    })),
    assignments: {},
});

export const loadTableState = (mode: TierTableMode): TierTableState => {
    try {
        const raw = localStorage.getItem(`apex-tier-table:${mode}`);
        if (!raw) return createDefaultTableState();
        const parsed = JSON.parse(raw) as TierTableState;
        if (!parsed?.tiers?.length) return createDefaultTableState();
        return {
            tiers: normalizeTierRows(parsed.tiers),
            assignments: parsed.assignments ?? {},
        };
    } catch {
        return createDefaultTableState();
    }
};

export const saveTableState = (mode: TierTableMode, state: TierTableState): void => {
    localStorage.setItem(`apex-tier-table:${mode}`, JSON.stringify(state));
};

const LAST_MODE_KEY = 'apex-tier-table:last-mode';

export const loadLastMode = (): TierTableMode | null => {
    const value = localStorage.getItem(LAST_MODE_KEY);
    return value === 'legend' || value === 'weapon' ? value : null;
};

export const saveLastMode = (mode: TierTableMode): void => {
    localStorage.setItem(LAST_MODE_KEY, mode);
};

export const reorderTierRow = (
    state: TierTableState,
    tierId: string,
    targetIndex: number,
): TierTableState => {
    const tiers = [...state.tiers];
    const fromIndex = tiers.findIndex((tier) => tier.id === tierId);
    if (fromIndex === -1) return state;

    const clampedTarget = Math.max(0, Math.min(targetIndex, tiers.length));
    let insertIndex = clampedTarget;
    if (fromIndex < insertIndex) insertIndex -= 1;
    if (fromIndex === insertIndex) return state;

    const [moved] = tiers.splice(fromIndex, 1);
    tiers.splice(insertIndex, 0, moved);
    return { ...state, tiers };
};

export const findItemTierId = (state: TierTableState, itemId: string): string | null => {
    for (const tier of state.tiers) {
        if (state.assignments[tier.id]?.includes(itemId)) return tier.id;
    }
    return null;
};

export const moveItemToTier = (
    state: TierTableState,
    itemId: string,
    targetTierId: string | null,
    insertIndex?: number,
): TierTableState => {
    if (!targetTierId) {
        const assignments: Record<string, string[]> = {};
        for (const tier of state.tiers) {
            assignments[tier.id] = (state.assignments[tier.id] ?? []).filter((id) => id !== itemId);
        }
        return { ...state, assignments };
    }

    const targetList = state.assignments[targetTierId] ?? [];
    return insertItemInTier(state, itemId, targetTierId, insertIndex ?? targetList.length);
};

export const insertItemInTier = (
    state: TierTableState,
    itemId: string,
    targetTierId: string,
    insertIndex: number,
): TierTableState => {
    const sourceTierId = findItemTierId(state, itemId);
    const assignments: Record<string, string[]> = {};

    for (const tier of state.tiers) {
        assignments[tier.id] = [...(state.assignments[tier.id] ?? [])];
    }

    let fromIndex = -1;
    if (sourceTierId) {
        fromIndex = assignments[sourceTierId].indexOf(itemId);
        if (fromIndex !== -1) {
            assignments[sourceTierId] = assignments[sourceTierId].filter((id) => id !== itemId);
        }
    }

    const targetList = assignments[targetTierId] ?? [];
    let index = Math.max(0, Math.min(insertIndex, targetList.length));
    if (sourceTierId === targetTierId && fromIndex !== -1 && fromIndex < index) {
        index -= 1;
    }

    targetList.splice(index, 0, itemId);
    assignments[targetTierId] = targetList;
    return { ...state, assignments };
};
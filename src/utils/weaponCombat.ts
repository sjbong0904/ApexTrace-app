import type { MatchEvent } from '../types';
import type { WeaponCombatMap } from '../types';
import {
    computeMatchWeaponCombat,
    resolveWeaponCombatForMatch,
} from './weaponMatchStats';

export type { WeaponCombatEntry, WeaponCombatMap } from '../types';
export {
    computeMatchWeaponCombat,
    normalizeWeaponCombat,
    resolveWeaponCombatForMatch,
    formatHoldDuration,
    loadoutAtTimestamp,
    isRichWeaponCombatEntry,
} from './weaponMatchStats';

/** @deprecated Prefer computeMatchWeaponCombat — kills/assists only. */
export const deriveWeaponCombatFromEvents = (
    events: MatchEvent[] | null | undefined,
): WeaponCombatMap => {
    const computed = computeMatchWeaponCombat({ events: events || [] });
    const out: WeaponCombatMap = {};
    for (const [k, v] of Object.entries(computed)) {
        if (v.kills > 0 || (v.assists || 0) > 0) {
            out[k] = { ...v };
        }
    }
    return out;
};

/** Prefer stored map; otherwise derive from events (detail). */
export const resolveWeaponCombat = (
    weaponCombat: unknown,
    events?: MatchEvent[] | null,
): WeaponCombatMap => {
    return resolveWeaponCombatForMatch({ weaponCombat, events: events || [] });
};

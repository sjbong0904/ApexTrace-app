import type { MatchEvent, WeaponCombatEntry, WeaponCombatMap, WeaponTimelineEntry } from '../types';
import { isSamePlayer } from './helpers';

export type MatchWeaponStatsInput = {
    startTime?: number;
    endTime?: number;
    playerName?: string | null;
    placement?: number | string | null;
    loadout?: { primary?: string | null; secondary?: string | null } | null;
    weaponTimeline?: WeaponTimelineEntry[] | null;
    events?: MatchEvent[] | null;
};

const isUsableWeapon = (weapon: string | null | undefined): weapon is string =>
    Boolean(weapon) && weapon !== 'unknown' && weapon !== 'none' && weapon !== 'Unknown';

const ensureEntry = (map: WeaponCombatMap, weapon: string): WeaponCombatEntry => {
    if (!map[weapon]) {
        map[weapon] = { holdMs: 0, kills: 0, deaths: 0, assists: 0, qualify: false };
    }
    return map[weapon];
};

const addHold = (map: WeaponCombatMap, weapon: string | null | undefined, ms: number) => {
    if (!isUsableWeapon(weapon) || ms <= 0) return;
    ensureEntry(map, weapon).holdMs += ms;
};

/** Loadout slots at timestamp from timeline (state after last change at or before t). */
export const loadoutAtTimestamp = (
    match: MatchWeaponStatsInput,
    timestamp: number,
): { primary: string | null; secondary: string | null } => {
    const timeline = Array.isArray(match.weaponTimeline)
        ? [...match.weaponTimeline].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        : [];

    if (timeline.length === 0) {
        return {
            primary: isUsableWeapon(match.loadout?.primary) ? match.loadout!.primary! : null,
            secondary: isUsableWeapon(match.loadout?.secondary) ? match.loadout!.secondary! : null,
        };
    }

    let primary: string | null = null;
    let secondary: string | null = null;
    for (const entry of timeline) {
        if ((entry.timestamp || 0) > timestamp) break;
        if (entry.primary !== undefined) {
            primary = isUsableWeapon(entry.primary) ? entry.primary : null;
        }
        if (entry.secondary !== undefined) {
            secondary = isUsableWeapon(entry.secondary) ? entry.secondary : null;
        }
    }
    return { primary, secondary };
};

const accumulateHoldTimes = (match: MatchWeaponStatsInput, map: WeaponCombatMap) => {
    const start = Number(match.startTime) || 0;
    const end = Number(match.endTime) || start;
    if (!start || end <= start) return;

    const timeline = Array.isArray(match.weaponTimeline)
        ? [...match.weaponTimeline].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        : [];

    if (timeline.length === 0) {
        // No timeline: attribute full match to final loadout only.
        addHold(map, match.loadout?.primary, end - start);
        addHold(map, match.loadout?.secondary, end - start);
        return;
    }

    let primary: string | null = null;
    let secondary: string | null = null;
    let cursor = start;

    for (const entry of timeline) {
        const t = Math.min(end, Math.max(start, entry.timestamp || start));
        if (t > cursor) {
            addHold(map, primary, t - cursor);
            addHold(map, secondary, t - cursor);
        }
        if (entry.primary !== undefined) {
            primary = isUsableWeapon(entry.primary) ? entry.primary : null;
        }
        if (entry.secondary !== undefined) {
            secondary = isUsableWeapon(entry.secondary) ? entry.secondary : null;
        }
        cursor = Math.max(cursor, t);
    }

    if (end > cursor) {
        const finalPrimary = isUsableWeapon(match.loadout?.primary) ? match.loadout!.primary! : primary;
        const finalSecondary = isUsableWeapon(match.loadout?.secondary) ? match.loadout!.secondary! : secondary;
        addHold(map, finalPrimary, end - cursor);
        addHold(map, finalSecondary, end - cursor);
    }
};

/**
 * Per-match weapon combat summary (hold time, kills, deaths, WR/placement qualify).
 * Spec: final loadout always qualifies; kill weapons qualify; both slots at combat times qualify.
 * Deaths: +1 per local death to both slots at that time; mid-kill with 0 real deaths → death = 1.
 */
export const computeMatchWeaponCombat = (match: MatchWeaponStatsInput): WeaponCombatMap => {
    const map: WeaponCombatMap = {};
    const playerName = match.playerName || '';
    const events = Array.isArray(match.events) ? match.events : [];

    accumulateHoldTimes(match, map);

    const finalPrimary = isUsableWeapon(match.loadout?.primary) ? match.loadout!.primary! : null;
    const finalSecondary = isUsableWeapon(match.loadout?.secondary) ? match.loadout!.secondary! : null;
    const finalSet = new Set<string>();
    if (finalPrimary) {
        finalSet.add(finalPrimary);
        ensureEntry(map, finalPrimary).qualify = true;
    }
    if (finalSecondary) {
        finalSet.add(finalSecondary);
        ensureEntry(map, finalSecondary).qualify = true;
    }

    for (const event of events) {
        if (!event) continue;
        const type = String(event.type || '').toLowerCase();
        const ts = Number(event.timestamp) || 0;

        if (type === 'kill' && isUsableWeapon(event.weapon)) {
            // Our kill rows use local player as attacker.
            if (!playerName || isSamePlayer(event.attacker, playerName)) {
                ensureEntry(map, event.weapon).kills += 1;
                ensureEntry(map, event.weapon).qualify = true;
            }
        }

        if (type === 'assist' && isUsableWeapon(event.weapon)) {
            if (!playerName || isSamePlayer(event.attacker, playerName)) {
                ensureEntry(map, event.weapon).assists += 1;
            }
        }

        // Combat moments → both slots qualify (kill / knockdown by me, or damage tick).
        const isMyCombat =
            (type === 'kill' || type === 'knockdown') &&
            (!playerName || isSamePlayer(event.attacker, playerName));
        const isDamageTick = type === 'damage';
        if ((isMyCombat || isDamageTick) && ts) {
            const slots = loadoutAtTimestamp(match, ts);
            if (isUsableWeapon(slots.primary)) ensureEntry(map, slots.primary).qualify = true;
            if (isUsableWeapon(slots.secondary)) ensureEntry(map, slots.secondary).qualify = true;
        }

        if (type === 'death' && ts && playerName && isSamePlayer(event.victim, playerName)) {
            const slots = loadoutAtTimestamp(match, ts);
            if (isUsableWeapon(slots.primary)) ensureEntry(map, slots.primary).deaths += 1;
            if (isUsableWeapon(slots.secondary)) ensureEntry(map, slots.secondary).deaths += 1;
        }
    }

    // Mid-match kill weapon with no real deaths while held → exactly 1 death (correction).
    for (const [weapon, entry] of Object.entries(map)) {
        if (entry.kills > 0 && !finalSet.has(weapon) && entry.deaths === 0) {
            entry.deaths = 1;
        }
        entry.qualify = Boolean(entry.qualify);
    }

    return map;
};

export const isRichWeaponCombatEntry = (entry: unknown): entry is WeaponCombatEntry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const e = entry as Record<string, unknown>;
    return 'holdMs' in e || 'qualify' in e || 'deaths' in e;
};

export const normalizeWeaponCombat = (value: unknown): WeaponCombatMap => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: WeaponCombatMap = {};
    for (const [rawKey, rawEntry] of Object.entries(value as Record<string, unknown>)) {
        if (!isUsableWeapon(rawKey)) continue;
        const entry = rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry)
            ? rawEntry as Record<string, unknown>
            : {};
        const kills = Number(entry.kills) || 0;
        const assists = Number(entry.assists) || 0;
        const deaths = Number(entry.deaths) || 0;
        const holdMs = Number(entry.holdMs) || 0;
        const qualify = Boolean(entry.qualify);
        const rich = isRichWeaponCombatEntry(entry);
        if (!rich && kills === 0 && assists === 0) continue;
        if (rich && holdMs === 0 && kills === 0 && deaths === 0 && !qualify && assists === 0) continue;
        out[rawKey] = { holdMs, kills, deaths, assists, qualify: rich ? qualify : false };
    }
    return out;
};

/** Prefer stored rich map; otherwise compute from match detail; else legacy/empty. */
export const resolveWeaponCombatForMatch = (
    match: MatchWeaponStatsInput & { weaponCombat?: unknown },
): WeaponCombatMap => {
    const raw = match.weaponCombat;
    const storedIsRich = Boolean(
        raw
        && typeof raw === 'object'
        && !Array.isArray(raw)
        && Object.values(raw as Record<string, unknown>).some(isRichWeaponCombatEntry),
    );
    if (storedIsRich) return normalizeWeaponCombat(raw);

    const hasDetail =
        (Array.isArray(match.events) && match.events.length > 0)
        || (Array.isArray(match.weaponTimeline) && match.weaponTimeline.length > 0);
    if (hasDetail) return computeMatchWeaponCombat(match);

    return normalizeWeaponCombat(raw);
};

/** Format milliseconds as hh:mm (table-friendly; seconds omitted). */
export const formatHoldDuration = (ms: number): string => {
    const totalMin = Math.max(0, Math.floor((Number(ms) || 0) / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

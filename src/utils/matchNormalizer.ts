import type { Match, MatchEvent } from '../types';
import { normalizeWeaponCombat } from './weaponCombat';
import { normalizeMapDisplayName } from './helpers';

type JsonObject = Record<string, unknown>;
type MaybeMatch = Partial<Match> & JsonObject;

/** Background runtime keys that may ride along on live Store matches. */
const PRIVATE_KEYS = ['startPos', 'endPos', 'isDead'];
/** `_`-prefixed keys are runtime state except the client's own detail marker. */
const KEEP_UNDERSCORE_KEYS = new Set(['_detailLoaded']);

const isObject = (value: unknown): value is JsonObject =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown, fallback = 0): number => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toNullableNumber = (value: unknown, fallback: number | null = 0): number | null => {
    if (value === null) return null;
    if (value === undefined || value === '') return fallback;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toStringValue = (value: unknown, fallback = ''): string => {
    if (value === null || value === undefined) return fallback;
    return String(value);
};

const toArray = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const toObject = <T extends JsonObject>(value: unknown, fallback: T): T =>
    isObject(value) ? value as T : fallback;

export const normalizeMatchForFrontend = (input: unknown): Match | null => {
    if (!isObject(input)) return null;
    const source = input as MaybeMatch;

    const rank: JsonObject = toObject(source.rank, {});
    const loadout: JsonObject = toObject(source.loadout, {});
    const matchId = toStringValue(source.matchId ?? source.startTime);
    if (!matchId) return null;

    const events = toArray<MatchEvent>(source.events);
    const weaponCombat = normalizeWeaponCombat(
        source.weaponCombat,
    );

    const normalized = {
        ...source,
        matchId,
        platformId: (source.platformId ?? null) as string | null,
        playerName: toStringValue(source.playerName, ''),
        mode: toStringValue(source.mode, 'Unknown'),
        map: normalizeMapDisplayName(toStringValue(source.map, 'Unknown')),
        legend: (source.legend === undefined ? null : source.legend) as string | null,
        placement: source.placement === null
            ? null
            : (source.placement === undefined ? 0 : source.placement) as number | string | null,
        kills: toNullableNumber(source.kills, 0),
        assists: toNullableNumber(source.assists, 0),
        deaths: source.deaths === undefined || source.deaths === null
            ? null
            : toNumber(source.deaths),
        knocks: toNullableNumber(source.knocks, 0),
        damage: toNullableNumber(source.damage, 0),
        squadKills: toNumber(source.squadKills),
        ultimatesUsed: toNumber(source.ultimatesUsed),
        headshots: toNumber(source.headshots),
        grenadeDamage: source.grenadeDamage as number | undefined,
        rank: {
            name: toStringValue(rank.name, 'Unknown'),
            score: toNumber(rank.score),
            startScore: toNumber(rank.startScore),
        },
        rpChange: toNumber(source.rpChange),
        rpProcessed: Boolean(source.rpProcessed),
        rankScore: source.rankScore as number | undefined,
        startTime: toNumber(source.startTime),
        endTime: toNumber(source.endTime),
        loadout: {
            primary: (loadout.primary ?? null) as string | null,
            secondary: (loadout.secondary ?? null) as string | null,
        },
        weaponCombat,
        path: toArray(source.path),
        ringRounds: toArray(source.ringRounds),
        weaponTimeline: toArray(source.weaponTimeline),
        events,
        teamStats: toArray(source.teamStats),
        teammateKills: toObject(source.teammateKills, {}),
        isKillLeader: source.isKillLeader as boolean | undefined,
        missingSignals: Array.isArray(source.missingSignals) && source.missingSignals.length > 0
            ? source.missingSignals as string[]
            : undefined,
    } satisfies Match;

    const record = normalized as JsonObject;
    PRIVATE_KEYS.forEach((key) => {
        delete record[key];
    });
    Object.keys(record).forEach((key) => {
        if (key.startsWith('_') && !KEEP_UNDERSCORE_KEYS.has(key)) delete record[key];
    });

    return normalized;
};

export const normalizeHistoryForFrontend = (history: unknown): Match[] => {
    if (!Array.isArray(history)) return [];

    return history
        .map(normalizeMatchForFrontend)
        .filter((match): match is Match => Boolean(match));
};

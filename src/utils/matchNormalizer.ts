import type { Match } from '../types';

type JsonObject = Record<string, unknown>;
type MaybeMatch = Partial<Match> & JsonObject;

const PRIVATE_KEYS = [
    '_saved',
    '_currentPhase',
    '_lastLocationTime',
    'startPos',
    'endPos',
];

const isObject = (value: unknown): value is JsonObject =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown, fallback = 0): number => {
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

const readLegacyPayload = (input: unknown): MaybeMatch | null => {
    if (!isObject(input)) return null;

    const legacy = input.legacy_match ?? input.legacyMatch;
    if (isObject(legacy)) {
        return { ...legacy, ...input } as MaybeMatch;
    }

    return input as MaybeMatch;
};

export const normalizeMatchForFrontend = (input: unknown): Match | null => {
    const source = readLegacyPayload(input);
    if (!source) return null;

    const rank: JsonObject = toObject(source.rank, {});
    const loadout: JsonObject = toObject(source.loadout, {});
    const matchId = toStringValue(source.matchId ?? source.match_id ?? source.startTime ?? source.start_time);
    if (!matchId) return null;

    const normalized = {
        ...source,
        matchId,
        platformId: source.platformId === undefined ? toStringValue(source.uid, '') : source.platformId as string | null,
        playerName: toStringValue(source.playerName, ''),
        mode: toStringValue(source.mode, 'Unknown'),
        map: toStringValue(source.map, 'Unknown'),
        legend: (source.legend === undefined ? null : source.legend) as string | null,
        placement: source.placement === undefined || source.placement === null ? 0 : source.placement as number | string,
        kills: toNumber(source.kills),
        assists: toNumber(source.assists),
        knocks: toNumber(source.knocks),
        damage: toNumber(source.damage),
        squadKills: toNumber(source.squadKills ?? source.squad_kills),
        ultimatesUsed: toNumber(source.ultimatesUsed ?? source.ultimates_used),
        headshots: toNumber(source.headshots),
        grenadeDamage: (source.grenadeDamage ?? source.grenade_damage) as number | undefined,
        rank: {
            name: toStringValue(rank.name, 'Unknown'),
            score: toNumber(rank.score),
            startScore: toNumber(rank.startScore),
        },
        rpChange: toNumber(source.rpChange ?? source.rp_change),
        rpProcessed: Boolean(source.rpProcessed ?? source.rp_processed),
        rankScore: (source.rankScore ?? source.rank_score) as number | undefined,
        startTime: toNumber(source.startTime ?? source.start_time),
        endTime: toNumber(source.endTime ?? source.end_time),
        loadout: {
            primary: (loadout.primary ?? null) as string | null,
            secondary: (loadout.secondary ?? null) as string | null,
        },
        path: toArray(source.path),
        ringRounds: toArray(source.ringRounds ?? source.ring_rounds),
        weaponTimeline: toArray(source.weaponTimeline ?? source.weapon_timeline),
        events: toArray(source.events),
        teamStats: toArray(source.teamStats ?? source.team_stats),
        teammateKills: toObject(source.teammateKills ?? source.teammate_kills, {}),
        isKillLeader: (source.isKillLeader ?? source.is_kill_leader) as boolean | undefined,
    } satisfies Match;

    PRIVATE_KEYS.forEach((key) => {
        delete (normalized as JsonObject)[key];
    });

    return normalized;
};

export const normalizeHistoryForFrontend = (history: unknown): Match[] => {
    if (!Array.isArray(history)) return [];

    return history
        .map(normalizeMatchForFrontend)
        .filter((match): match is Match => Boolean(match));
};

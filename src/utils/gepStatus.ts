export const APEX_GAME_ID = 21566;
export const GEP_STATUS_URL = `https://game-events-status.overwolf.com/${APEX_GAME_ID}_prod.json`;
export const GEP_STATUS_REFRESH_MS = 5 * 60 * 1000;

export interface GepStatusKey {
    name: string;
    state: number;
    category?: string | null;
    status_comment?: string | null;
}

export interface GepStatusFeature {
    name: string;
    state: number;
    keys?: GepStatusKey[];
}

export interface GepStatusResponse {
    game_id: number;
    name?: string;
    state: number;
    features?: GepStatusFeature[];
}

export interface GepIssue {
    id: string;
    state: number;
    featureName: string;
    keyName: string;
    category?: string | null;
}

export const GEP_DISPLAY_GROUP_ORDER = [
    'gameMode',
    'combatLogs',
    'rank',
    'movementPath',
    'loadout',
    'teamInfo',
    'legend',
    'ultimate',
    'matchLifecycle',
    'revive',
] as const;

export type GepDisplayGroupId = typeof GEP_DISPLAY_GROUP_ORDER[number];

/** Maps raw GEP keys to user-facing feature groups in the panel. */
export const GEP_KEY_TO_GROUP: Record<string, GepDisplayGroupId> = {
    game_mode: 'gameMode',
    kill: 'combatLogs',
    kill_feed: 'combatLogs',
    knockdown: 'combatLogs',
    tabs: 'combatLogs',
    totalDamageDealt: 'combatLogs',
    damage: 'combatLogs',
    death: 'combatLogs',
    knocked_out: 'combatLogs',
    victory: 'rank',
    match_summary: 'rank',
    phase: 'movementPath',
    location: 'movementPath',
    weapons: 'loadout',
    roster: 'teamInfo',
    teammate: 'teamInfo',
    legendSelect: 'legend',
    ultimate_cooldown: 'ultimate',
    match_start: 'matchLifecycle',
    match_end: 'matchLifecycle',
    healed_from_ko: 'revive',
    respawn: 'revive',
};

export interface GepGroupedIssue {
    id: GepDisplayGroupId;
    state: number;
    keyNames: string[];
}

export const GEP_GROUP_I18N_PREFIX = 'gameStatus.groups';

export const getGepGroupLabelKey = (groupId: GepDisplayGroupId): string =>
    `${GEP_GROUP_I18N_PREFIX}.${groupId}.label`;

export const getGepGroupImpactKey = (groupId: GepDisplayGroupId): string =>
    `${GEP_GROUP_I18N_PREFIX}.${groupId}.impact`;

export function collectGepIssues(data: GepStatusResponse): GepIssue[] {
    const issues: GepIssue[] = [];
    const seen = new Set<string>();

    for (const feature of data.features ?? []) {
        for (const key of feature.keys ?? []) {
            if (key.state < 2 || seen.has(key.name)) continue;
            seen.add(key.name);
            issues.push({
                id: key.name,
                state: key.state,
                featureName: feature.name,
                keyName: key.name,
                category: key.category,
            });
        }
    }

    return issues;
}

export function collectGepGroupedIssues(data: GepStatusResponse): GepGroupedIssue[] {
    const grouped = new Map<GepDisplayGroupId, { state: number; keyNames: string[] }>();

    for (const issue of collectGepIssues(data)) {
        const groupId = GEP_KEY_TO_GROUP[issue.keyName];
        if (!groupId) continue;

        const current = grouped.get(groupId) ?? { state: 0, keyNames: [] };
        current.state = Math.max(current.state, issue.state);
        current.keyNames.push(issue.keyName);
        grouped.set(groupId, current);
    }

    return GEP_DISPLAY_GROUP_ORDER
        .filter((groupId) => grouped.has(groupId))
        .map((groupId) => ({
            id: groupId,
            state: grouped.get(groupId)!.state,
            keyNames: grouped.get(groupId)!.keyNames,
        }));
}

export function collectOtherGepIssues(data: GepStatusResponse): GepIssue[] {
    return collectGepIssues(data).filter((issue) => !GEP_KEY_TO_GROUP[issue.keyName]);
}

export async function fetchGepStatus(): Promise<GepStatusResponse | null> {
    try {
        const response = await fetch(GEP_STATUS_URL, { cache: 'no-store' });
        if (!response.ok) return null;
        return await response.json() as GepStatusResponse;
    } catch {
        return null;
    }
}

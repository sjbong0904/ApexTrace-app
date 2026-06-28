/**
 * Insert fake ranked matches with teammates for local UI testing.
 *
 * Run:  npm run seed:teammate-test
 * Clean: npm run seed:teammate-test:clean
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY with insert grants) in .env
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

const TARGET_UID = '1006729871276';
const TARGET_PLAYER_NAME = 'TraceTestPlayer';
const TEST_MATCH_PREFIX = 'test_tm_';
const CURRENT_SEASON_ID = 3;
const SEASON_START_MS = Date.UTC(2026, 2, 24, 18, 0, 0); // Season 28 Split 2

type StatisticsMode = 'ALL' | 'RANKED' | 'TRIO' | 'DUO';

interface TeammateDef {
    id: string;
    uid: string;
    name: string;
    legend: string;
}

interface LegacyMatch {
    matchId: string;
    platformId: string;
    playerName: string;
    mode: string;
    map: string;
    legend: string;
    placement: number;
    kills: number;
    assists: number;
    knocks: number;
    damage: number;
    squadKills: number;
    ultimatesUsed: number;
    headshots: number;
    rank: { name: string; score: number; startScore: number };
    rpChange: number;
    rpProcessed: boolean;
    startTime: number;
    endTime: number;
    loadout: { primary: string | null; secondary: string | null };
    path: unknown[];
    ringRounds: unknown[];
    weaponTimeline: unknown[];
    events: unknown[];
    teamStats: Array<{ uid: string; name: string; legend: string; kills?: number }>;
    teammateKills: Record<string, number>;
}

function loadEnvFiles(...paths: string[]) {
    for (const path of paths) {
        if (!existsSync(path)) continue;
        for (const line of readFileSync(path, 'utf-8').split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq === -1) continue;
            const key = trimmed.slice(0, eq).trim();
            const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
            if (process.env[key] == null || process.env[key] === '') {
                process.env[key] = value;
            }
        }
    }
}

loadEnvFiles(join(ROOT_DIR, '.env'), join(ROOT_DIR, 'trace-proxy-server', '.env'));

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ureuzkxyyozzzluzawwr.supabase.co';
const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TEAMMATES: TeammateDef[] = [
    { id: 'pro', uid: '9000000000001', name: 'ProGamer_KR', legend: 'wraith' },
    { id: 'long', uid: '9000000000002', name: 'VeryLongNicknameForMarqueeTest', legend: 'pathfinder' },
    { id: 'snipe', uid: '9000000000003', name: 'SnipeMaster', legend: 'bangalore' },
    { id: 'clutch', uid: '9000000000004', name: 'ClutchKing', legend: 'horizon' },
];

const MAPS = ['World\'s Edge', 'Broken Moon', 'Storm Point', 'E-District'];
const PLAYER_LEGENDS = ['wraith', 'bloodhound', 'horizon', 'madmaggie', 'newcastle'];

const toNumber = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const sanitizeLegacyMatch = (match: LegacyMatch) => ({ ...match });

const legacyMatchFromRow = (row: Record<string, unknown>, includeDetail = false): LegacyMatch => {
    const legacy = sanitizeLegacyMatch((row.legacy_match ?? {}) as LegacyMatch);
    const rank = (legacy.rank ?? row.rank ?? {}) as LegacyMatch['rank'];
    const loadout = (legacy.loadout ?? row.loadout ?? {}) as LegacyMatch['loadout'];

    return {
        ...legacy,
        matchId: String(legacy.matchId ?? row.match_id),
        platformId: String(legacy.platformId ?? row.uid ?? TARGET_UID),
        playerName: legacy.playerName ?? TARGET_PLAYER_NAME,
        mode: String(legacy.mode ?? row.mode ?? 'Ranked'),
        map: String(legacy.map ?? row.map ?? 'Unknown'),
        legend: String(legacy.legend ?? row.legend ?? 'wraith'),
        placement: toNumber(legacy.placement ?? row.placement),
        kills: toNumber(legacy.kills ?? row.kills),
        assists: toNumber(legacy.assists ?? row.assists),
        knocks: toNumber(legacy.knocks ?? row.knocks),
        damage: toNumber(legacy.damage ?? row.damage),
        squadKills: toNumber(legacy.squadKills ?? row.squad_kills),
        ultimatesUsed: toNumber(legacy.ultimatesUsed ?? row.ultimates_used),
        headshots: toNumber(legacy.headshots ?? row.headshots),
        rank: {
            name: rank.name ?? 'Platinum',
            score: toNumber(rank.score),
            startScore: toNumber(rank.startScore),
        },
        rpChange: toNumber(legacy.rpChange ?? row.rp_change),
        rpProcessed: Boolean(legacy.rpProcessed ?? row.rp_processed),
        startTime: toNumber(legacy.startTime ?? row.start_time),
        endTime: toNumber(legacy.endTime ?? row.end_time),
        loadout: {
            primary: loadout.primary ?? 'r301',
            secondary: loadout.secondary ?? 'mastiff',
        },
        path: includeDetail ? toArray(legacy.path ?? row.path) : [],
        ringRounds: includeDetail ? toArray(legacy.ringRounds ?? row.ring_rounds) : [],
        weaponTimeline: includeDetail ? toArray(legacy.weaponTimeline ?? row.weapon_timeline) : [],
        events: includeDetail ? toArray(legacy.events ?? row.events) : [],
        teamStats: toArray(legacy.teamStats ?? row.team_stats),
        teammateKills: (legacy.teammateKills ?? row.teammate_kills ?? {}) as Record<string, number>,
    };
};

const normalizedRowFromLegacyMatch = (uid: string, match: LegacyMatch, seasonId: number) => ({
    match_id: String(match.matchId),
    uid,
    season_id: seasonId,
    start_time: match.startTime,
    end_time: match.endTime,
    mode: match.mode,
    map: match.map,
    legend: match.legend,
    placement: match.placement,
    kills: match.kills,
    assists: match.assists,
    knocks: match.knocks,
    damage: match.damage,
    squad_kills: match.squadKills,
    ultimates_used: match.ultimatesUsed,
    headshots: match.headshots,
    grenade_damage: null,
    rank_score: null,
    rp_change: match.rpChange,
    rp_processed: match.rpProcessed,
    is_kill_leader: null,
    rank: match.rank,
    loadout: match.loadout,
    team_stats: match.teamStats,
    events: [],
    path: [],
    ring_rounds: [],
    weapon_timeline: [],
    teammate_kills: match.teammateKills,
    legacy_match: sanitizeLegacyMatch(match),
    schema_version: 2,
});

const matchTime = (match: LegacyMatch) => match.startTime ?? match.endTime;

const matchesStatisticsMode = (mode: string, selectedMode: StatisticsMode) => {
    const normalized = String(mode ?? '').toLowerCase();
    if (selectedMode === 'ALL') return normalized.includes('ranked') || normalized.includes('trio') || normalized.includes('duo');
    if (selectedMode === 'RANKED') return normalized.includes('ranked');
    if (selectedMode === 'TRIO') return normalized.includes('trio') && !normalized.includes('ranked');
    if (selectedMode === 'DUO') return normalized.includes('duo') && !normalized.includes('ranked');
    return false;
};

const upsertMatchInPayload = (payload: { matches: LegacyMatch[] }, summaryMatch: LegacyMatch) => {
    const matchId = String(summaryMatch.matchId);
    const without = payload.matches.filter(m => String(m.matchId) !== matchId);
    without.unshift(summaryMatch);
    without.sort((a, b) => matchTime(b) - matchTime(a));
    return { matches: without.slice(0, 2000) };
};

async function recomputePlayerSeasonStats(uid: string, seasonId: number, mode: StatisticsMode) {
    const { data: season, error: seasonError } = await supabase
        .from('seasons')
        .select('id, start_time, end_time')
        .eq('id', seasonId)
        .maybeSingle();

    if (seasonError) throw seasonError;
    if (!season) throw new Error(`Unknown season_id: ${seasonId}`);

    let query = supabase
        .from('matches')
        .select('match_id, uid, start_time, end_time, mode, map, legend, placement, kills, assists, knocks, damage, squad_kills, ultimates_used, headshots, rank, loadout, team_stats, teammate_kills, legacy_match, schema_version, season_id')
        .eq('uid', uid)
        .gte('start_time', season.start_time)
        .order('start_time', { ascending: false });

    if (season.end_time != null) {
        query = query.lt('start_time', season.end_time);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const summaryMatches = (rows ?? [])
        .map(row => legacyMatchFromRow(row as Record<string, unknown>, false))
        .filter(match => matchesStatisticsMode(match.mode, mode));

    let payload = { matches: [] as LegacyMatch[] };
    for (const match of summaryMatches) {
        payload = upsertMatchInPayload(payload, match);
    }

    const row = {
        uid,
        season_id: seasonId,
        mode,
        match_count: summaryMatches.length,
        payload,
        schema_version: 1,
        updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
        .from('player_season_stats')
        .upsert(row, { onConflict: 'uid,season_id,mode' });

    if (upsertError) throw upsertError;
    return summaryMatches.length;
}

function teammateEntry(def: TeammateDef, kills = 1) {
    return { uid: def.uid, name: def.name, legend: def.legend, kills };
}

function buildTestMatches(): LegacyMatch[] {
    type Perf = { placement: number; kills: number; assists: number; damage: number };
    const good: Perf = { placement: 2, kills: 5, assists: 3, damage: 1800 };
    const avg: Perf = { placement: 8, kills: 2, assists: 1, damage: 950 };
    const bad: Perf = { placement: 14, kills: 0, assists: 1, damage: 420 };
    const win: Perf = { placement: 1, kills: 6, assists: 2, damage: 2100 };

    const specs: Array<{ teammates: TeammateDef[]; perf: Perf }> = [
        // ProGamer_KR — 8 games (shows ▲/▼ deltas)
        ...Array.from({ length: 3 }, () => ({ teammates: [TEAMMATES[0], TEAMMATES[2]], perf: good })),
        ...Array.from({ length: 2 }, () => ({ teammates: [TEAMMATES[0], TEAMMATES[3]], perf: win })),
        ...Array.from({ length: 2 }, () => ({ teammates: [TEAMMATES[0], TEAMMATES[1]], perf: avg })),
        { teammates: [TEAMMATES[0], TEAMMATES[1]], perf: bad },
        // VeryLongNickname — 6 games
        ...Array.from({ length: 3 }, () => ({ teammates: [TEAMMATES[1], TEAMMATES[3]], perf: good })),
        ...Array.from({ length: 2 }, () => ({ teammates: [TEAMMATES[1], TEAMMATES[2]], perf: avg })),
        { teammates: [TEAMMATES[1], TEAMMATES[0]], perf: bad },
        // SnipeMaster — 3 games (below 5-game delta threshold)
        { teammates: [TEAMMATES[2], TEAMMATES[3]], perf: avg },
        { teammates: [TEAMMATES[2], TEAMMATES[0]], perf: good },
        { teammates: [TEAMMATES[2], TEAMMATES[1]], perf: bad },
        // ClutchKing — 7 games
        ...Array.from({ length: 4 }, () => ({ teammates: [TEAMMATES[3], TEAMMATES[0]], perf: avg })),
        ...Array.from({ length: 2 }, () => ({ teammates: [TEAMMATES[3], TEAMMATES[1]], perf: good })),
        { teammates: [TEAMMATES[3], TEAMMATES[2]], perf: win },
        // Baseline filler — no teammates in teamStats
        ...Array.from({ length: 8 }, () => ({ teammates: [], perf: avg })),
    ];

    const now = Date.now();
    return specs.map((spec, index) => {
        const startTime = Math.max(SEASON_START_MS + 86_400_000, now - (specs.length - index) * 3_600_000 * 6);
        const endTime = startTime + 420_000 + (index % 5) * 30_000;
        const matchId = `${TEST_MATCH_PREFIX}${String(index + 1).padStart(3, '0')}`;

        return {
            matchId,
            platformId: TARGET_UID,
            playerName: TARGET_PLAYER_NAME,
            mode: 'Ranked',
            map: MAPS[index % MAPS.length],
            legend: PLAYER_LEGENDS[index % PLAYER_LEGENDS.length],
            placement: spec.perf.placement,
            kills: spec.perf.kills,
            assists: spec.perf.assists,
            knocks: spec.perf.kills,
            damage: spec.perf.damage,
            squadKills: spec.perf.kills + spec.teammates.length,
            ultimatesUsed: index % 3,
            headshots: spec.perf.kills > 0 ? 1 : 0,
            rank: { name: 'Platinum IV', score: 7200 + index * 12, startScore: 7200 },
            rpChange: spec.perf.placement === 1 ? 78 : spec.perf.placement <= 5 ? 24 : -18,
            rpProcessed: true,
            startTime,
            endTime,
            loadout: { primary: 'r301', secondary: 'mastiff' },
            path: [],
            ringRounds: [],
            weaponTimeline: [],
            events: [],
            teamStats: spec.teammates.map((tm, tmIndex) => teammateEntry(tm, 1 + ((index + tmIndex) % 3))),
            teammateKills: {},
        };
    });
}

async function cleanTestData() {
    const { data: existing, error: listError } = await supabase
        .from('matches')
        .select('match_id')
        .eq('uid', TARGET_UID)
        .like('match_id', `${TEST_MATCH_PREFIX}%`);

    if (listError) throw listError;

    const ids = (existing ?? []).map(row => row.match_id);
    if (ids.length === 0) {
        console.log('No test matches to remove.');
    } else {
        const { error: deleteError } = await supabase
            .from('matches')
            .delete()
            .eq('uid', TARGET_UID)
            .in('match_id', ids);

        if (deleteError) throw deleteError;
        console.log(`🗑️  Removed ${ids.length} test matches.`);
    }

    for (const mode of ['ALL', 'RANKED'] as StatisticsMode[]) {
        const count = await recomputePlayerSeasonStats(TARGET_UID, CURRENT_SEASON_ID, mode);
        console.log(`♻️  Recomputed player_season_stats ${mode}: ${count} matches`);
    }
}

async function seedTestData() {
    const matches = buildTestMatches();
    const rows = matches.map(match => normalizedRowFromLegacyMatch(TARGET_UID, match, CURRENT_SEASON_ID));

    const { error: upsertError } = await supabase
        .from('matches')
        .upsert(rows, { onConflict: 'uid,match_id' });

    if (upsertError) throw upsertError;

    console.log(`✅ Upserted ${rows.length} test matches for uid ${TARGET_UID}`);

    const teammateCounts = new Map<string, number>();
    for (const match of matches) {
        for (const tm of match.teamStats) {
            teammateCounts.set(tm.name, (teammateCounts.get(tm.name) ?? 0) + 1);
        }
    }
    console.log('Teammate game counts:');
    for (const [name, count] of [...teammateCounts.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  - ${name}: ${count}${count >= 5 ? ' (delta enabled)' : ''}`);
    }

    for (const mode of ['ALL', 'RANKED'] as StatisticsMode[]) {
        const count = await recomputePlayerSeasonStats(TARGET_UID, CURRENT_SEASON_ID, mode);
        console.log(`♻️  Recomputed player_season_stats ${mode}: ${count} matches`);
    }

    console.log('\nOpen Statistics → Teammates for uid', TARGET_UID, '(Season 28 : Split 2, Ranked/All).');
    console.log('Refresh the profile or restart the app if cached stats are stale.');
}

async function main() {
    const clean = process.argv.includes('--clean');

    if (clean) {
        await cleanTestData();
        return;
    }

    await seedTestData();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

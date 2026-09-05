import type { MatchHistory } from './match';
import { hasUsableMatchStats } from './match';
import { isKnownLegend, normalizeLegendKey, toGameElapsedMs, getMatchDeaths, normalizeMapDisplayName } from './helpers';
import { TARGET_MAPS, SHORT_WEAPON_NAMES } from './gameData';
import { formatHoldDuration, resolveWeaponCombatForMatch } from './weaponMatchStats';

export const formatDuration = (ms: number): string => {
    if (!ms) return "0m 0s";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
};

export const formatLegendDisplayName = (legendId: string) =>
    legendId
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

export const getMatchPlacement = (m: MatchHistory): number => {
    const placement = m.placement;
    return placement != null && !isNaN(Number(placement)) ? Number(placement) : 20;
};

export const formatAvgPlacement = (totalPlacement: number, count: number): string =>
    count > 0 ? (totalPlacement / count).toFixed(1) : '0.0';

export const resolveMapName = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown') return null;
    const normalized = normalizeMapDisplayName(trimmed);
    if (normalized === 'Unknown') return null;
    return TARGET_MAPS.find(t => t.toLowerCase() === normalized.toLowerCase()) ?? normalized;
};

const isUsableWeaponSlot = (fileId: string | null | undefined): fileId is string =>
    Boolean(fileId) && fileId !== 'unknown' && fileId !== 'none';

/**
 * Usage × performance for Top Legends / Weapons.
 * `priorVolume` shrinks tiny samples (e.g. 4 min hold with KD 8) so they
 * cannot outrank long-session mains with ordinary KD.
 * score = volume^0.6 × kd × volume/(volume+prior)
 */
export const hybridRankScore = (volume: number, kd: number, priorVolume = 30): number => {
    const v = Math.max(0, Number(volume) || 0);
    const k = Math.max(0, Number(kd) || 0);
    if (v <= 0 || k <= 0) return 0;
    const reliability = v / (v + Math.max(1, priorVolume));
    return Math.pow(v, 0.6) * k * reliability;
};

/** Games prior for legend ranking (~a dozen matches before full weight). */
export const LEGEND_RANK_PRIOR_GAMES = 12;
/** Hold-minutes prior for weapon ranking (~45 min before full weight). */
export const WEAPON_RANK_PRIOR_MINUTES = 45;

const compareWinRateDesc = (a: string, b: string, aHas = true, bHas = true): number => {
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (!aHas && !bHas) return 0;
    const na = parseFloat(a);
    const nb = parseFloat(b);
    const aOk = Number.isFinite(na);
    const bOk = Number.isFinite(nb);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    return nb - na;
};

export type AggregatedLegendStat = {
    id: string;
    name: string;
    games: number;
    winRate: string;
    avgPlacement: string;
    avgDamage: number;
    kd: number;
    kda: number;
    rankScore: number;
};

/** Legend buckets skip unknown/missing picks. Volume stats (games/kills/damage) include estimated matches. */
export const aggregateLegendStatsForMatches = (matches: MatchHistory[]): AggregatedLegendStat[] => {
    const map: Record<string, { games: number; wins: number; kills: number; assists: number; deaths: number; damage: number; placement: number }> = {};

    matches.forEach(m => {
        if (!hasUsableMatchStats(m)) return;
        if (!isKnownLegend(m.legend)) return;

        const legend = normalizeLegendKey(m.legend);

        const isWin = m.placement === 1;
        if (!map[legend]) {
            map[legend] = { games: 0, wins: 0, kills: 0, assists: 0, deaths: 0, damage: 0, placement: 0 };
        }
        const entry = map[legend];
        entry.games++;
        entry.kills += m.kills || 0;
        entry.assists += m.assists || 0;
        entry.deaths += getMatchDeaths(m);
        entry.damage += m.damage || 0;
        entry.placement += getMatchPlacement(m);
        if (isWin) entry.wins++;
    });

    return Object.entries(map).map(([id, v]) => {
        const kdNum = v.deaths === 0 ? v.kills : v.kills / v.deaths;
        const kdaNum = v.deaths === 0 ? v.kills + v.assists : (v.kills + v.assists) / v.deaths;
        return {
            id,
            name: formatLegendDisplayName(id),
            games: v.games,
            winRate: ((v.wins / v.games) * 100).toFixed(1),
            avgPlacement: formatAvgPlacement(v.placement, v.games),
            avgDamage: Math.round(v.damage / v.games),
            kd: parseFloat(kdNum.toFixed(2)),
            kda: parseFloat(kdaNum.toFixed(2)),
            rankScore: hybridRankScore(v.games, kdNum, LEGEND_RANK_PRIOR_GAMES),
        };
    }).sort((a, b) => {
        if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
        if (b.games !== a.games) return b.games - a.games;
        const winDiff = compareWinRateDesc(a.winRate, b.winRate);
        if (winDiff !== 0) return winDiff;
        return a.id.localeCompare(b.id);
    });
};

export type AggregatedWeaponStat = {
    id: string;
    name: string;
    /** Total possession time (ms). */
    holdMs: number;
    holdTime: string;
    /** Matches where weapon qualified for WR/placement. */
    qualifyGames: number;
    games: number;
    winRate: string;
    avgPlacement: string;
    kd: number;
    topLegends: string[];
    hasWinRate: boolean;
    rankScore: number;
};

export const aggregateWeaponStatsForMatches = (matches: MatchHistory[]): AggregatedWeaponStat[] => {
    const map: Record<string, {
        holdMs: number;
        kills: number;
        deaths: number;
        qualifyGames: number;
        wins: number;
        placement: number;
        legends: Record<string, number>;
    }> = {};

    matches.forEach(m => {
        if (!hasUsableMatchStats(m)) return;
        const isWin = m.placement === 1;
        const matchPlacement = getMatchPlacement(m);
        const legend = isKnownLegend(m.legend) ? normalizeLegendKey(m.legend) : null;
        const combat = resolveWeaponCombatForMatch(m as MatchHistory & {
            startTime?: number;
            endTime?: number;
            playerName?: string;
            weaponTimeline?: unknown;
        });

        const combatKeys = Object.keys(combat);
        const hasRich = combatKeys.some(k =>
            combat[k].holdMs > 0 || combat[k].deaths > 0 || combat[k].qualify || combat[k].kills > 0,
        );

        if (!hasRich) {
            // Legacy summary: attribute match totals to final loadout slots.
            const loadoutWeapons = [m.loadout?.primary, m.loadout?.secondary].filter(isUsableWeaponSlot);
            if (loadoutWeapons.length === 0) return;
            const matchDeath = getMatchDeaths(m);
            loadoutWeapons.forEach(fileId => {
                if (!map[fileId]) {
                    map[fileId] = { holdMs: 0, kills: 0, deaths: 0, qualifyGames: 0, wins: 0, placement: 0, legends: {} };
                }
                const entry = map[fileId];
                entry.qualifyGames++;
                entry.kills += m.kills || 0;
                entry.deaths += matchDeath;
                entry.placement += matchPlacement;
                if (isWin) entry.wins++;
                if (legend) entry.legends[legend] = (entry.legends[legend] || 0) + 1;
            });
            return;
        }

        combatKeys.forEach(fileId => {
            const c = combat[fileId];
            if (!map[fileId]) {
                map[fileId] = { holdMs: 0, kills: 0, deaths: 0, qualifyGames: 0, wins: 0, placement: 0, legends: {} };
            }
            const entry = map[fileId];
            entry.holdMs += c.holdMs || 0;
            entry.kills += c.kills || 0;
            entry.deaths += c.deaths || 0;
            if (c.qualify) {
                entry.qualifyGames++;
                entry.placement += matchPlacement;
                if (isWin) entry.wins++;
                if (legend) entry.legends[legend] = (entry.legends[legend] || 0) + 1;
            } else if (legend && ((c.holdMs || 0) > 0 || (c.kills || 0) > 0)) {
                entry.legends[legend] = (entry.legends[legend] || 0) + 1;
            }
        });
    });

    return Object.entries(map).map(([k, v]) => {
        const displayName = SHORT_WEAPON_NAMES(k) ?? k.toUpperCase().replace(/-/g, ' ');
        const kdNum = v.deaths === 0 ? v.kills : v.kills / v.deaths;
        const hasWinRate = v.qualifyGames > 0;
        const holdMinutes = (v.holdMs || 0) / 60000;
        const topLegends = Object.entries(v.legends)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([id]) => id);
        return {
            id: k,
            name: displayName,
            holdMs: v.holdMs,
            holdTime: formatHoldDuration(v.holdMs),
            qualifyGames: v.qualifyGames,
            games: v.qualifyGames,
            winRate: hasWinRate ? ((v.wins / v.qualifyGames) * 100).toFixed(1) : '-',
            avgPlacement: hasWinRate ? formatAvgPlacement(v.placement, v.qualifyGames) : '-',
            kd: parseFloat(kdNum.toFixed(2)),
            topLegends,
            hasWinRate,
            rankScore: hybridRankScore(holdMinutes, kdNum, WEAPON_RANK_PRIOR_MINUTES),
        };
    }).sort((a, b) => {
        if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
        if (b.holdMs !== a.holdMs) return b.holdMs - a.holdMs;
        const winDiff = compareWinRateDesc(a.winRate, b.winRate, a.hasWinRate, b.hasWinRate);
        if (winDiff !== 0) return winDiff;
        return a.id.localeCompare(b.id);
    });
};

export const aggregateMapStatsForMatches = (matches: MatchHistory[]) => {
    const map: Record<string, { games: number; wins: number }> = {};
    const usable = matches.filter(hasUsableMatchStats);
    usable.forEach(m => {
        const mapName = resolveMapName(String((m as { map?: string }).map ?? ''));
        if (!mapName) return;
        if (!map[mapName]) map[mapName] = { games: 0, wins: 0 };
        map[mapName].games++;
        if (m.placement === 1) map[mapName].wins++;
    });

    const total = usable.length;
    return Object.entries(map)
        .map(([name, { games, wins }]) => ({
            name,
            games,
            share: total > 0 ? (games / total) * 100 : 0,
            winRate: games > 0 ? ((wins / games) * 100).toFixed(1) : '0.0',
        }))
        .sort((a, b) => b.games - a.games);
};

export const calculateStats = (matches: MatchHistory[]) => {
    const usable = matches.filter(hasUsableMatchStats);
    if (usable.length === 0) return null;
    const totalMatches = usable.length;
    const totalKills = usable.reduce((sum, m) => sum + (m.kills || 0), 0);
    const totalDamage = usable.reduce((sum, m) => sum + (m.damage || 0), 0);
    const totalAssists = usable.reduce((sum, m) => sum + (m.assists || 0), 0);
    const totalWins = usable.filter(m => m.placement === 1).length;
    const totalTop5 = usable.filter(m => getMatchPlacement(m) <= 5).length;
    const totalDeaths = usable.reduce((sum, m) => sum + getMatchDeaths(m), 0);
    const totalTime = usable.reduce(
        (sum, m: any) => sum + toGameElapsedMs((m.endTime || Date.now()) - m.startTime),
        0,
    );
    const totalPlacement = usable.reduce((sum, m) => sum + getMatchPlacement(m), 0);
    const maxKills = Math.max(...usable.map(m => m.kills || 0));
    const totalsquadKills = usable.reduce((sum, m: any) => sum + (m.squadKills || 0), 0);
    const topLegend = aggregateLegendStatsForMatches(usable)[0];
    const topWeapon = aggregateWeaponStatsForMatches(usable)[0];
    const myContribution = totalKills + (totalAssists * 0.5);
    const actualSquadKills = totalsquadKills > 0 ? totalsquadKills : (totalKills || 1);
    const contributionRate = (myContribution / actualSquadKills) * 100;

    return {
        matches: totalMatches,
        wins: totalWins,
        totalDamage,
        winRate: ((totalWins / totalMatches) * 100).toFixed(1),
        top5Rate: ((totalTop5 / totalMatches) * 100).toFixed(1),
        kills: totalKills,
        deaths: totalDeaths,
        kd: totalDeaths === 0 ? totalKills : (totalKills / totalDeaths).toFixed(2),
        kda: totalDeaths === 0 ? (totalKills + totalAssists).toFixed(2) : ((totalKills + totalAssists) / totalDeaths).toFixed(2),
        avgDamage: Math.round(totalDamage / totalMatches),
        avgTime: formatDuration(totalTime / totalMatches),
        avgTimeSec: Math.round(totalTime / totalMatches / 1000),
        avgmin: Math.floor(Math.round(totalTime / totalMatches / 1000) / 60),
        avgsec: Math.round(Math.round(totalTime / totalMatches / 1000) % 60),
        mostLegend: topLegend ? topLegend.id : '-',
        mostWeapon: topWeapon ? topWeapon.id.replace('weapon_', '').toUpperCase() : '-',
        avgKills: (totalKills / totalMatches).toFixed(1),
        avgPlacement: (totalPlacement / totalMatches).toFixed(1),
        maxKills,
        squadKills: totalsquadKills,
        assists: totalAssists,
        lograte: Math.min(contributionRate, 100).toFixed(1)
    };
};

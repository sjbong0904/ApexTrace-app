import type { MatchHistory } from './match';
import { hasUsableMatchStats } from './match';
import { isKnownLegend, normalizeLegendKey, toGameElapsedMs, getMatchDeaths, normalizeMapDisplayName } from './helpers';
import { TARGET_MAPS } from './gameData';
import { formatHoldDuration, formatUsageGames, resolveWeaponCombatForMatch, resolveWeaponThreatsForMatch } from './weaponMatchStats';
import { getCanonicalWeaponId, getWeaponDisplayName, weaponsMatchId } from './weaponTheme';
import type { WeaponCombatEntry, WeaponCombatMap } from '../types';

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
/** Games prior for weapon ranking (~a dozen matches before full weight). */
export const WEAPON_RANK_PRIOR_GAMES = 12;
/** @deprecated Prefer WEAPON_RANK_PRIOR_GAMES — kept for any external imports. */
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
    /** Matches where this weapon was used (integer; switch-in still counts 1). */
    usageGames: number;
    usageLabel: string;
    /** Matches where weapon qualified for WR/placement. */
    qualifyGames: number;
    /** Same as usageGames (used-match count). */
    games: number;
    winRate: string;
    avgPlacement: string;
    /** null when deaths == 0 (UI shows N/A). */
    kd: number | null;
    kda: number | null;
    hasKd: boolean;
    topLegends: string[];
    hasWinRate: boolean;
    rankScore: number;
};

export type AggregatedThreatWeaponStat = {
    id: string;
    name: string;
    /** Deaths against local player credited to this weapon (knockdown-preferring). */
    kills: number;
    /** Times local player was knocked by this weapon. */
    knockdowns: number;
};

export type AggregatedWeaponPairStat = {
    id: string;
    name: string;
    games: number;
    winRate: string;
    avgPlacement: string;
    kd: number | null;
    kda: number | null;
    hasKd: boolean;
    hasWinRate: boolean;
};

export type AggregatedWeaponLegendStat = {
    id: string;
    name: string;
    games: number;
    winRate: string;
    avgPlacement: string;
    kd: number | null;
    kda: number | null;
    hasKd: boolean;
};

/** Weapon K/D — N/A when no attributed deaths. */
export const weaponRatioFromTotals = (
    kills: number,
    assists: number,
    deaths: number,
): { kd: number | null; kda: number | null; hasKd: boolean } => {
    if (!(deaths > 0)) return { kd: null, kda: null, hasKd: false };
    return {
        kd: parseFloat((kills / deaths).toFixed(2)),
        kda: parseFloat(((kills + assists) / deaths).toFixed(2)),
        hasKd: true,
    };
};

const resolveCombatMap = (m: MatchHistory): WeaponCombatMap =>
    resolveWeaponCombatForMatch(m as MatchHistory & {
        startTime?: number;
        endTime?: number;
        playerName?: string;
        weaponTimeline?: unknown;
    });

const findCombatEntry = (combat: WeaponCombatMap, weaponId: string) => {
    const direct = combat[weaponId];
    if (direct) return direct;
    const hit = Object.entries(combat).find(([raw]) => weaponsMatchId(raw, weaponId));
    return hit?.[1] ?? null;
};

const weaponUsedInCombat = (combat: WeaponCombatMap, weaponId: string): boolean => {
    const entry = findCombatEntry(combat, weaponId);
    if (!entry) return false;
    return (entry.holdMs || 0) > 0 || (entry.kills || 0) > 0 || entry.qualify || (entry.assists || 0) > 0;
};

export const filterMatchesForWeapon = (matches: MatchHistory[], weaponId: string): MatchHistory[] =>
    matches.filter(m => {
        if (!hasUsableMatchStats(m)) return false;
        return weaponUsedInCombat(resolveCombatMap(m), weaponId);
    });

export const aggregateWeaponStatsForMatches = (matches: MatchHistory[]): AggregatedWeaponStat[] => {
    const map: Record<string, {
        holdMs: number;
        kills: number;
        assists: number;
        deaths: number;
        usedGames: number;
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
        const combat = resolveCombatMap(m);

        // Merge aliases once per match so a weapon switch-in still counts as 1 game.
        const byCanon: Record<string, WeaponCombatEntry> = {};
        Object.entries(combat).forEach(([fileId, c]) => {
            const id = getCanonicalWeaponId(fileId);
            if (!byCanon[id]) {
                byCanon[id] = { holdMs: 0, kills: 0, assists: 0, deaths: 0, qualify: false };
            }
            const merged = byCanon[id];
            merged.holdMs += c.holdMs || 0;
            merged.kills += c.kills || 0;
            merged.assists += c.assists || 0;
            merged.deaths += c.deaths || 0;
            merged.qualify = merged.qualify || Boolean(c.qualify);
        });

        Object.entries(byCanon).forEach(([id, c]) => {
            if (!weaponUsedInCombat({ [id]: c }, id)) return;

            if (!map[id]) {
                map[id] = {
                    holdMs: 0, kills: 0, assists: 0, deaths: 0,
                    usedGames: 0, qualifyGames: 0, wins: 0, placement: 0, legends: {},
                };
            }
            const entry = map[id];
            entry.usedGames += 1;
            entry.holdMs += c.holdMs || 0;
            entry.kills += c.kills || 0;
            entry.assists += c.assists || 0;
            entry.deaths += c.deaths || 0;
            if (c.qualify) {
                entry.qualifyGames += 1;
                entry.placement += matchPlacement;
                if (isWin) entry.wins += 1;
                if (legend) entry.legends[legend] = (entry.legends[legend] || 0) + 1;
            } else if (legend) {
                entry.legends[legend] = (entry.legends[legend] || 0) + 1;
            }
        });
    });

    return Object.entries(map).map(([k, v]) => {
        const { kd, kda, hasKd } = weaponRatioFromTotals(v.kills, v.assists, v.deaths);
        const hasWinRate = v.qualifyGames > 0;
        const topLegends = Object.entries(v.legends)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([id]) => id);
        const rankKd = hasKd && kd != null ? kd : ((v.kills > 0 || v.assists > 0) ? 1 : 0);
        return {
            id: k,
            name: getWeaponDisplayName(k),
            holdMs: v.holdMs,
            holdTime: formatHoldDuration(v.holdMs),
            usageGames: v.usedGames,
            usageLabel: formatUsageGames(v.usedGames),
            qualifyGames: v.qualifyGames,
            games: v.usedGames,
            winRate: hasWinRate ? ((v.wins / v.qualifyGames) * 100).toFixed(1) : '-',
            avgPlacement: hasWinRate ? formatAvgPlacement(v.placement, v.qualifyGames) : '-',
            kd,
            kda,
            hasKd,
            topLegends,
            hasWinRate,
            rankScore: hybridRankScore(v.usedGames, rankKd, WEAPON_RANK_PRIOR_GAMES),
        };
    }).sort((a, b) => {
        if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
        if (b.usageGames !== a.usageGames) return b.usageGames - a.usageGames;
        if (b.holdMs !== a.holdMs) return b.holdMs - a.holdMs;
        const winDiff = compareWinRateDesc(a.winRate, b.winRate, a.hasWinRate, b.hasWinRate);
        if (winDiff !== 0) return winDiff;
        return a.id.localeCompare(b.id);
    });
};

export const aggregateThreatWeaponStatsForMatches = (matches: MatchHistory[]): AggregatedThreatWeaponStat[] => {
    const map: Record<string, { kills: number; knockdowns: number }> = {};

    matches.forEach(m => {
        if (!hasUsableMatchStats(m)) return;
        const threats = resolveWeaponThreatsForMatch(m as MatchHistory & {
            playerName?: string;
            events?: unknown;
            weaponThreats?: unknown;
        });
        Object.entries(threats).forEach(([weaponId, entry]) => {
            const id = getCanonicalWeaponId(weaponId);
            if (!map[id]) map[id] = { kills: 0, knockdowns: 0 };
            map[id].kills += entry.kills || 0;
            map[id].knockdowns += entry.knockdowns || 0;
        });
    });

    return Object.entries(map)
        .map(([id, v]) => ({
            id,
            name: getWeaponDisplayName(id),
            kills: v.kills,
            knockdowns: v.knockdowns,
        }))
        .filter(w => w.kills > 0 || w.knockdowns > 0)
        .sort((a, b) => {
            if (b.kills !== a.kills) return b.kills - a.kills;
            if (b.knockdowns !== a.knockdowns) return b.knockdowns - a.knockdowns;
            return a.id.localeCompare(b.id);
        });
};

/** Other weapons held in the same matches as `weaponId` (one primary partner per match). */
export const aggregatePairedWeaponsForWeapon = (
    matches: MatchHistory[],
    weaponId: string,
): AggregatedWeaponPairStat[] => {
    const map: Record<string, {
        games: number;
        wins: number;
        placement: number;
        kills: number;
        assists: number;
        deaths: number;
        qualifyGames: number;
    }> = {};

    matches.forEach(m => {
        if (!hasUsableMatchStats(m)) return;
        const combat = resolveCombatMap(m);
        if (!weaponUsedInCombat(combat, weaponId)) return;

        const isWin = m.placement === 1;
        const matchPlacement = getMatchPlacement(m);
        const selected = findCombatEntry(combat, weaponId);
        const selectedQualifies = Boolean(selected?.qualify);

        let bestId: string | null = null;
        let bestEntry: WeaponCombatEntry | null = null;
        Object.entries(combat).forEach(([rawId, entry]) => {
            if (weaponsMatchId(rawId, weaponId)) return;
            if ((entry.holdMs || 0) <= 0 && (entry.kills || 0) <= 0 && !entry.qualify) return;
            const id = getCanonicalWeaponId(rawId);
            if (!bestEntry || (entry.holdMs || 0) > (bestEntry.holdMs || 0)) {
                bestId = id;
                bestEntry = entry;
            }
        });
        if (!bestId || !bestEntry) return;

        const partnerEntry: WeaponCombatEntry = bestEntry;
        if (!map[bestId]) {
            map[bestId] = { games: 0, wins: 0, placement: 0, kills: 0, assists: 0, deaths: 0, qualifyGames: 0 };
        }
        const row = map[bestId];
        row.games += 1;
        row.kills += partnerEntry.kills || 0;
        row.assists += partnerEntry.assists || 0;
        row.deaths += partnerEntry.deaths || 0;
        if (selectedQualifies) {
            row.qualifyGames += 1;
            row.placement += matchPlacement;
            if (isWin) row.wins += 1;
        }
    });

    return Object.entries(map)
        .map(([id, v]) => {
            const hasWinRate = v.qualifyGames > 0;
            const { kd, kda, hasKd } = weaponRatioFromTotals(v.kills, v.assists, v.deaths);
            return {
                id,
                name: getWeaponDisplayName(id),
                games: v.games,
                winRate: hasWinRate ? ((v.wins / v.qualifyGames) * 100).toFixed(1) : '-',
                avgPlacement: hasWinRate ? formatAvgPlacement(v.placement, v.qualifyGames) : '-',
                kd,
                kda,
                hasKd,
                hasWinRate,
            };
        })
        .sort((a, b) => {
            if (b.games !== a.games) return b.games - a.games;
            const ak = a.kd ?? -1;
            const bk = b.kd ?? -1;
            if (bk !== ak) return bk - ak;
            return a.id.localeCompare(b.id);
        });
};

/** Legends used while playing with `weaponId`. */
export const aggregateLegendsForWeapon = (
    matches: MatchHistory[],
    weaponId: string,
): AggregatedWeaponLegendStat[] => {
    const map: Record<string, {
        games: number;
        wins: number;
        placement: number;
        kills: number;
        assists: number;
        deaths: number;
    }> = {};

    matches.forEach(m => {
        if (!hasUsableMatchStats(m)) return;
        if (!isKnownLegend(m.legend)) return;
        const combat = resolveCombatMap(m);
        const entry = findCombatEntry(combat, weaponId);
        if (!entry || !weaponUsedInCombat(combat, weaponId)) return;

        const legend = normalizeLegendKey(m.legend);
        if (!map[legend]) {
            map[legend] = { games: 0, wins: 0, placement: 0, kills: 0, assists: 0, deaths: 0 };
        }
        const row = map[legend];
        row.games += 1;
        row.placement += getMatchPlacement(m);
        row.kills += entry.kills || 0;
        row.assists += entry.assists || 0;
        row.deaths += entry.deaths || 0;
        if (m.placement === 1) row.wins += 1;
    });

    return Object.entries(map)
        .map(([id, v]) => {
            const { kd, kda, hasKd } = weaponRatioFromTotals(v.kills, v.assists, v.deaths);
            return {
                id,
                name: formatLegendDisplayName(id),
                games: v.games,
                winRate: ((v.wins / v.games) * 100).toFixed(1),
                avgPlacement: formatAvgPlacement(v.placement, v.games),
                kd,
                kda,
                hasKd,
            };
        })
        .sort((a, b) => {
            if (b.games !== a.games) return b.games - a.games;
            const ak = a.kd ?? -1;
            const bk = b.kd ?? -1;
            if (bk !== ak) return bk - ak;
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
        // Always string with 2 decimals — bare totalKills looked like a raw kill count when deaths==0.
        kd: totalDeaths === 0
            ? totalKills.toFixed(2)
            : (totalKills / totalDeaths).toFixed(2),
        kda: totalDeaths === 0
            ? (totalKills + totalAssists).toFixed(2)
            : ((totalKills + totalAssists) / totalDeaths).toFixed(2),
        avgDamage: Math.round(totalDamage / totalMatches),
        avgTime: formatDuration(totalTime / totalMatches),
        avgTimeSec: Math.round(totalTime / totalMatches / 1000),
        avgmin: Math.floor(Math.round(totalTime / totalMatches / 1000) / 60),
        avgsec: Math.round(Math.round(totalTime / totalMatches / 1000) % 60),
        mostLegend: topLegend ? topLegend.id : '-',
        mostWeapon: topWeapon ? topWeapon.name : '-',
        avgKills: (totalKills / totalMatches).toFixed(1),
        avgPlacement: (totalPlacement / totalMatches).toFixed(1),
        maxKills,
        squadKills: totalsquadKills,
        assists: totalAssists,
        lograte: Math.min(contributionRate, 100).toFixed(1)
    };
};

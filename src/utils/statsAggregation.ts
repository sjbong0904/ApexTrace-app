import type { MatchHistory } from './match';
import { isKnownLegend, normalizeLegendKey, toGameElapsedMs } from './helpers';
import { TARGET_MAPS, SHORT_WEAPON_NAMES } from './gameData';

export const formatDuration = (ms: number): string => {
    if (!ms) return "0m 0s";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
};

export const formatLegendDisplayName = (legendId: string) =>
    legendId.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

export const getMatchPlacement = (m: MatchHistory): number => {
    const placement = m.placement;
    return placement != null && !isNaN(Number(placement)) ? Number(placement) : 20;
};

export const formatAvgPlacement = (totalPlacement: number, count: number): string =>
    count > 0 ? (totalPlacement / count).toFixed(1) : '0.0';

export const resolveMapName = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown') return null;
    return TARGET_MAPS.find(t => t.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
};

export const aggregateLegendStatsForMatches = (matches: MatchHistory[]) => {
    const map: Record<string, { games: number; wins: number; kills: number; assists: number; deaths: number; damage: number; placement: number }> = {};

    matches.forEach(m => {
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
        entry.deaths += isWin ? 0 : 1;
        entry.damage += m.damage || 0;
        entry.placement += getMatchPlacement(m);
        if (isWin) entry.wins++;
    });

    return Object.entries(map).map(([id, v]) => {
        const kd = v.deaths === 0 ? v.kills.toFixed(2) : (v.kills / v.deaths).toFixed(2);
        const kda = v.deaths === 0 ? (v.kills + v.assists).toFixed(2) : ((v.kills + v.assists) / v.deaths).toFixed(2);
        return {
            id,
            name: formatLegendDisplayName(id),
            games: v.games,
            winRate: ((v.wins / v.games) * 100).toFixed(1),
            avgPlacement: formatAvgPlacement(v.placement, v.games),
            avgDamage: Math.round(v.damage / v.games),
            kd: parseFloat(kd),
            kda: parseFloat(kda),
        };
    }).sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        const winDiff = parseFloat(b.winRate) - parseFloat(a.winRate);
        if (winDiff !== 0) return winDiff;
        if (b.kd !== a.kd) return b.kd - a.kd;
        return b.avgDamage - a.avgDamage;
    });
};

export const aggregateWeaponStatsForMatches = (matches: MatchHistory[]) => {
    const map: Record<string, { games: number; wins: number; kills: number; assists: number; deaths: number; placement: number; legends: Record<string, number> }> = {};

    matches.forEach(m => {
        if (!m.loadout) return;
        const isWin = m.placement === 1;
        const matchKills = m.kills || 0;
        const matchAssists = m.assists || 0;
        const matchDeath = isWin ? 0 : 1;
        const matchPlacement = getMatchPlacement(m);
        const legend = isKnownLegend(m.legend) ? normalizeLegendKey(m.legend) : null;

        (['primary', 'secondary'] as const).forEach(slot => {
            const fileId = m.loadout![slot];
            if (!fileId || fileId === 'unknown' || fileId === 'none') return;

            if (!map[fileId]) map[fileId] = { games: 0, wins: 0, kills: 0, assists: 0, deaths: 0, placement: 0, legends: {} };
            const entry = map[fileId];
            entry.games++;
            entry.kills += matchKills;
            entry.assists += matchAssists;
            entry.deaths += matchDeath;
            entry.placement += matchPlacement;
            if (isWin) entry.wins++;
            if (legend) entry.legends[legend] = (entry.legends[legend] || 0) + 1;
        });
    });

    return Object.entries(map).map(([k, v]) => {
        const displayName = SHORT_WEAPON_NAMES(k) ?? k.toUpperCase().replace(/-/g, ' ');
        const kd = v.deaths === 0 ? v.kills.toFixed(2) : (v.kills / v.deaths).toFixed(2);
        const kda = v.deaths === 0 ? (v.kills + v.assists).toFixed(2) : ((v.kills + v.assists) / v.deaths).toFixed(2);
        const topLegends = Object.entries(v.legends)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([id]) => id);
        return {
            id: k,
            name: displayName,
            games: v.games,
            winRate: ((v.wins / v.games) * 100).toFixed(1),
            avgPlacement: formatAvgPlacement(v.placement, v.games),
            kd: parseFloat(kd),
            kda: parseFloat(kda),
            topLegends,
        };
    }).sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        if (b.kd !== a.kd) return b.kd - a.kd;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
    });
};

export const aggregateMapStatsForMatches = (matches: MatchHistory[]) => {
    const map: Record<string, { games: number; wins: number }> = {};
    matches.forEach(m => {
        const mapName = resolveMapName(String((m as { map?: string }).map ?? ''));
        if (!mapName) return;
        if (!map[mapName]) map[mapName] = { games: 0, wins: 0 };
        map[mapName].games++;
        if (m.placement === 1) map[mapName].wins++;
    });

    const total = matches.length;
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
    if (matches.length === 0) return null;
    const totalMatches = matches.length;
    const totalKills = matches.reduce((sum, m) => sum + (m.kills || 0), 0);
    const totalDamage = matches.reduce((sum, m) => sum + (m.damage || 0), 0);
    const totalAssists = matches.reduce((sum, m) => sum + (m.assists || 0), 0);
    const totalWins = matches.filter(m => m.placement === 1).length;
    const totalTop5 = matches.filter(m => (m.placement ?? 20) <= 5).length;
    const totalDeaths = totalMatches - totalWins;
    const totalTime = matches.reduce(
        (sum, m: any) => sum + toGameElapsedMs((m.endTime || Date.now()) - m.startTime),
        0,
    );
    const totalPlacement = matches.reduce((sum, m) => sum + (m.placement ?? 20), 0);
    const maxKills = Math.max(...matches.map(m => m.kills || 0));
    const totalsquadKills = matches.reduce((sum, m: any) => sum + (m.squadKills || 0), 0);
    const legendCounts: Record<string, number> = {};
    matches.forEach(m => {
        if (!isKnownLegend(m.legend)) return;
        const l = normalizeLegendKey(m.legend);
        legendCounts[l] = (legendCounts[l] || 0) + 1;
    });
    const mostLegend = Object.entries(legendCounts).sort((a, b) => b[1] - a[1])[0];
    const weaponCounts: Record<string, number> = {};
    matches.forEach(m => {
        if (m.loadout?.primary) weaponCounts[m.loadout.primary] = (weaponCounts[m.loadout.primary] || 0) + 1;
        if (m.loadout?.secondary) weaponCounts[m.loadout.secondary] = (weaponCounts[m.loadout.secondary] || 0) + 1;
    });
    const mostWeapon = Object.entries(weaponCounts).sort((a, b) => b[1] - a[1])[0];
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
        mostLegend: mostLegend ? mostLegend[0] : '-',
        mostWeapon: mostWeapon ? mostWeapon[0].replace('weapon_', '').toUpperCase() : '-',
        avgKills: (totalKills / totalMatches).toFixed(1),
        avgPlacement: (totalPlacement / totalMatches).toFixed(1),
        maxKills,
        squadKills: totalsquadKills,
        assists: totalAssists,
        lograte: Math.min(contributionRate, 100).toFixed(1)
    };
};

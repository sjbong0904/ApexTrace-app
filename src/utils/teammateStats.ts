import type { MatchHistory } from './match';
import { isSamePlayer, isKnownLegend, normalizeLegendKey, getMatchDeaths } from './helpers';
import { getMatchPlacement, formatLegendDisplayName, formatAvgPlacement } from './statsAggregation';

export type TeammateMatchStat = {
    uid: string | null;
    name: string;
    legend: string;
    games: number;
    wins: number;
    kills: number;
    assists: number;
    deaths: number;
    damage: number;
    placement: number;
};

export type PlayerPerformanceBaseline = {
    games: number;
    kd: number;
    kda: number;
    winRate: number;
    avgPlacement: number;
    avgDamage: number;
};

export const MIN_GAMES_FOR_TEAMMATE_DELTA = 5;

export const isSelfTeammateEntry = (
    tm: { uid?: string | null; name?: string },
    matchPlayerName: string | undefined,
    profileUid?: string | null,
    profileName?: string | null,
) => {
    if (profileUid && tm.uid && String(tm.uid) === String(profileUid)) return true;
    if (profileName && tm.name && isSamePlayer(tm.name, profileName)) return true;
    if (matchPlayerName && tm.name && isSamePlayer(tm.name, matchPlayerName)) return true;
    return false;
};

export const normalizeTeammateUid = (uid?: string | null): string | null => {
    const value = uid?.trim();
    return value && value !== 'null' ? value : null;
};

export const resolveTeammateKey = (
    map: Record<string, TeammateMatchStat & { legendCounts: Record<string, number> }>,
    tm: { uid?: string | null; name?: string }
): string | null => {
    const uid = normalizeTeammateUid(tm.uid);
    const name = (tm.name || '').trim();
    if (!uid && !name) return null;

    for (const [key, entry] of Object.entries(map)) {
        const uidMatch = !!(uid && entry.uid && String(entry.uid) === uid);
        const nameMatch = !!(name && entry.name && isSamePlayer(name, entry.name));
        if (!uidMatch && !nameMatch) continue;

        if (uid && !entry.uid) entry.uid = uid;
        if (name) {
            if (!entry.name) entry.name = name;
            else if (name.includes('[') && !entry.name.includes('[')) entry.name = name;
        }
        return key;
    }

    if (uid) return `uid:${uid}`;
    const nameKey = name.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    return nameKey ? `name:${nameKey}` : null;
};

export const aggregateTeammateLegendPicksForMatches = (
    matches: MatchHistory[],
    profileUid?: string | null,
    profileName?: string | null,
) => {
    const counts: Record<string, { picks: number; wins: number; placement: number }> = {};
    let totalPicks = 0;

    matches.forEach(m => {
        const teamStats = (m as { teamStats?: Array<{ name?: string; uid?: string | null; legend?: string }> }).teamStats;
        if (!teamStats?.length) return;
        const isWin = m.placement === 1;
        const matchPlacement = getMatchPlacement(m);

        teamStats.forEach(tm => {
            if (isSelfTeammateEntry(tm, (m as { playerName?: string }).playerName, profileUid, profileName)) return;
            if (!isKnownLegend(tm.legend)) return;
            const legend = normalizeLegendKey(tm.legend);
            if (!counts[legend]) counts[legend] = { picks: 0, wins: 0, placement: 0 };
            counts[legend].picks++;
            counts[legend].placement += matchPlacement;
            if (isWin) counts[legend].wins++;
            totalPicks++;
        });
    });

    return Object.entries(counts)
        .map(([id, { picks, wins, placement }]) => ({
            id,
            name: formatLegendDisplayName(id),
            picks,
            pickRate: totalPicks > 0 ? ((picks / totalPicks) * 100).toFixed(1) : '0.0',
            winRate: picks > 0 ? ((wins / picks) * 100).toFixed(1) : '0.0',
            avgPlacement: formatAvgPlacement(placement, picks),
        }))
        .sort((a, b) => {
            if (b.picks !== a.picks) return b.picks - a.picks;
            return parseFloat(b.pickRate) - parseFloat(a.pickRate);
        });
};

export const computePlayerPerformanceBaseline = (matches: MatchHistory[]): PlayerPerformanceBaseline | null => {
    if (matches.length === 0) return null;

    let wins = 0;
    let kills = 0;
    let assists = 0;
    let deaths = 0;
    let damage = 0;
    let placement = 0;

    matches.forEach((match) => {
        const isWin = match.placement === 1;
        wins += isWin ? 1 : 0;
        kills += match.kills || 0;
        assists += match.assists || 0;
        deaths += getMatchDeaths(match);
        damage += match.damage || 0;
        placement += getMatchPlacement(match);
    });

    const games = matches.length;
    const kd = deaths === 0 ? kills : kills / deaths;
    const kda = deaths === 0 ? kills + assists : (kills + assists) / deaths;

    return {
        games,
        kd,
        kda,
        winRate: (wins / games) * 100,
        avgPlacement: placement / games,
        avgDamage: Math.round(damage / games),
    };
};

export const formatSignedDelta = (delta: number, fractionDigits: number, suffix = ''): string => {
    const fixed = delta.toFixed(fractionDigits);
    if (delta > 0) return `+${fixed}${suffix}`;
    return `${fixed}${suffix}`;
};

export const getPerformanceDeltaColor = (delta: number, higherIsBetter: boolean): string => {
    if (Math.abs(delta) < 0.001) return 'var(--color-text-faint)';
    const improved = higherIsBetter ? delta > 0 : delta < 0;
    return improved ? '#4ade80' : '#f87171';
};

export const formatVsAverageBadge = (
    delta: number,
    fractionDigits: number,
    higherIsBetter: boolean,
    suffix = '',
): { label: string; color: string } => {
    const threshold = fractionDigits === 0 ? 0.5 : 0.05;
    if (Math.abs(delta) < threshold) {
        return { label: '-', color: 'var(--color-text-faint)' };
    }
    const improved = higherIsBetter ? delta > 0 : delta < 0;
    const magnitude = Math.abs(delta).toFixed(fractionDigits);
    return {
        label: `${improved ? '▲' : '▼'}${magnitude}${suffix}`,
        color: improved ? '#4ade80' : '#f87171',
    };
};

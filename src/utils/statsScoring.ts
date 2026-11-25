import type { MatchHistory } from './match';
import { toGameElapsedMs } from './helpers';

export type MatchWithMeta = MatchHistory & {
    map?: string;
    startTime?: number;
    endTime?: number;
    squadKills?: number;
};

/** Linear 0–100; at/below floor → 0, at/above ceiling → 100. */
export const linearScore = (value: number, floor: number, ceiling: number): number => {
    if (ceiling <= floor) return value >= ceiling ? 100 : 0;
    if (value <= floor) return 0;
    if (value >= ceiling) return 100;
    return ((value - floor) / (ceiling - floor)) * 100;
};

/** Compress mid/high scores — applied to non-combat axes. */
export const strictify = (score: number, power = 1.32): number =>
    Math.pow(Math.max(0, Math.min(100, score)) / 100, power) * 100;

/** Log-scaled 0–100 for metrics whose floor is strictly positive (e.g. survival seconds). */
export const logScore = (value: number, floor: number, ceiling: number): number => {
    if (ceiling <= floor) return value >= ceiling ? 100 : 0;
    if (value <= floor) return 0;
    if (value >= ceiling) return 100;
    const lf = Math.log(floor);
    const lc = Math.log(ceiling);
    const lv = Math.log(value);
    return ((lv - lf) / (lc - lf)) * 100;
};

export const getMatchSurvivalSec = (m: MatchWithMeta): number => {
    if (!m.startTime) return 0;
    return Math.max(0, Math.round(toGameElapsedMs((m.endTime || Date.now()) - m.startTime) / 1000));
};

/** 1 kill ≈ 200 damage — 피크 대미지 ceiling 기준. */
const DMG_PER_KILL = 200;

/** 0 → 0, ceiling → 100; at ~66.7% of ceiling → ~85 (shared curve). */
const AVG_DAMAGE_CEILING = 1500;
const PEAK_KILLS_CEILING = 20;
const PEAK_DAMAGE_CEILING = PEAK_KILLS_CEILING * DMG_PER_KILL;
const SCORE_CURVE_POWER = Math.log(0.85) / Math.log(1000 / AVG_DAMAGE_CEILING);
/** 교전 전용 — 화력보다 가파른 곡선 (중간 스탯 점수 과다 방지). */
const COMBAT_CURVE_POWER = 0.45;
/** ~85 pt anchor (K/D 3.5, KA/D 5.25). */
const COMBAT_STRONG_KD = 3.5;
const COMBAT_STRONG_KAD = 5.25;
const COMBAT_SCORE_RATIO_AT_85 = Math.pow(0.85, 1 / COMBAT_CURVE_POWER);
const COMBAT_KD_CEILING = COMBAT_STRONG_KD / COMBAT_SCORE_RATIO_AT_85;
const COMBAT_KAD_CEILING = COMBAT_STRONG_KAD / COMBAT_SCORE_RATIO_AT_85;

export const curvedMetricScore = (value: number, ceiling: number, power = SCORE_CURVE_POWER): number => {
    const ratio = Math.max(0, Math.min(1, value / ceiling));
    return Math.pow(ratio, power) * 100;
};

export const avgDamageScore = (avgDamage: number): number =>
    curvedMetricScore(avgDamage, AVG_DAMAGE_CEILING);

/** Peak match score: 20 kills + 4000 damage = 100 (same curve as 화력, averaged). */
export const computePeakMatchScore = (m: MatchWithMeta): number => {
    const kills = m.kills || 0;
    const damage = m.damage || 0;
    return (
        curvedMetricScore(kills, PEAK_KILLS_CEILING) * 0.5 +
        curvedMetricScore(damage, PEAK_DAMAGE_CEILING) * 0.5
    );
};

export const findBestPeakMatch = (matches: MatchHistory[]): { match: MatchWithMeta | null; score: number } => {
    let best: MatchWithMeta | null = null;
    let bestScore = 0;
    for (const raw of matches) {
        const m = raw as MatchWithMeta;
        const score = computePeakMatchScore(m);
        if (score > bestScore) {
            bestScore = score;
            best = m;
        }
    }
    return { match: best, score: bestScore };
};

const SCORE_WEIGHTS = {
    combat: 0.25,
    damage: 0.20,
    macro: 0.24,
    team: 0.16,
    peak: 0.15,
} as const;

/** Subset of aggregated match stats consumed by the overview radar/score. */
export interface OverviewStatsInput {
    kd: number | string;
    kda: number | string;
    avgPlacement: number | string;
    /** null when no match recorded squad kills. */
    lograte: number | string | null;
    avgDamage: number;
    avgTimeSec: number;
}

export const computeOverviewAnalytics = (
    stats: OverviewStatsInput,
    matches: MatchHistory[],
) => {
    const kd = parseFloat(String(stats.kd));
    const kda = parseFloat(String(stats.kda));
    const avgPlacement = parseFloat(String(stats.avgPlacement));
    const killContrib = parseFloat(String(stats.lograte));

    const scoreCombat =
        curvedMetricScore(kd, COMBAT_KD_CEILING, COMBAT_CURVE_POWER) * 0.55 +
        curvedMetricScore(kda, COMBAT_KAD_CEILING, COMBAT_CURVE_POWER) * 0.45;

    const scoreDamage = avgDamageScore(stats.avgDamage);

    const scorePlace = linearScore(20 - avgPlacement, 0, 19);
    const scoreSurvTime = logScore(stats.avgTimeSec, 180, 1020);
    const scoreMacro = strictify(scorePlace * 0.65 + scoreSurvTime * 0.35);

    // No squad-kill data → team axis unknown: draw it at 0 but leave it out of the total.
    const hasTeam = Number.isFinite(killContrib);
    const scoreTeam = hasTeam ? Math.max(0, Math.min(100, killContrib)) : 0;

    const { match: bestPeakMatch, score: scorePeak } = findBestPeakMatch(matches);

    const teamWeight = hasTeam ? SCORE_WEIGHTS.team : 0;
    const weightSum = SCORE_WEIGHTS.combat + SCORE_WEIGHTS.damage + SCORE_WEIGHTS.macro + teamWeight + SCORE_WEIGHTS.peak;
    const weightedScore = Math.max(0, Math.min(100, (
        scoreCombat * SCORE_WEIGHTS.combat +
        scoreDamage * SCORE_WEIGHTS.damage +
        scoreMacro * SCORE_WEIGHTS.macro +
        scoreTeam * teamWeight +
        scorePeak * SCORE_WEIGHTS.peak
    ) / weightSum));

    let tier = 'None';
    if (weightedScore >= 97) tier = 'SSS';
    else if (weightedScore >= 90) tier = 'SS';
    else if (weightedScore >= 85) tier = 'S';
    else if (weightedScore >= 80) tier = 'A+';
    else if (weightedScore >= 75) tier = 'A';
    else if (weightedScore >= 70) tier = 'A-';
    else if (weightedScore >= 65) tier = 'B+';
    else if (weightedScore >= 60) tier = 'B';
    else if (weightedScore >= 55) tier = 'B-';
    else if (weightedScore >= 50) tier = 'C+';
    else if (weightedScore >= 45) tier = 'C';
    else if (weightedScore >= 40) tier = 'C-';
    else if (weightedScore >= 35) tier = 'D+';
    else if (weightedScore >= 30) tier = 'D';
    else tier = 'D-';

    return {
        radarScores: {
            combat: scoreCombat,
            damage: scoreDamage,
            macro: scoreMacro,
            team: scoreTeam,
            peak: scorePeak,
        },
        bestPeakMatch,
        totalTier: tier,
        totalScore: Math.round(weightedScore),
    };
};

import type { Match } from '../types';
import { getMapConfig, isSamePlayer, toGameElapsedMs } from './helpers';
import { getRevivesReceived, getTimeOutsideRingMs, getTimesKnocked } from './matchDetailStats';

export type PlaystyleKey =
    | 'deathbox'
    | 'dominator'
    | 'aimbot'
    | 'warlord'
    | 'protagonist'
    | 'phoenix'
    | 'reborn'
    | 'ace'
    | 'blitz'
    | 'pacifist'
    | 'backpack'
    | 'champion'
    | 'unluckyAce'
    | 'heartbreaker'
    | 'tumbler'
    | 'ringSurfer'
    | 'observer'
    | 'sidekick'
    | 'atlas'
    | 'assassin'
    | 'sniper'
    | 'berserker'
    | 'sweeper'
    | 'oneTrick'
    | 'finisher'
    | 'collector'
    | 'support'
    | 'soldier'
    | 'survivor'
    | 'vanguard'
    | 'chihuahua'
    | 'rat'
    | 'delivery'
    | 'tourist'
    | 'skirmisher'
    | 'npc';

export interface PlaystyleBase {
    timeMin: number;
    dpm: number;
    speed: number;
    dist: number;
    dpk: number;
    kills: number;
    damage: number;
    kcr: number;
    assists: number;
    placement: number;
    kpp: number;
    squadKills: number;
}

export interface PlaystyleSignals {
    respawnsRecv: number | null;
    revivesRecv: number | null;
    timesKnocked: number | null;
    burst12: number | null;
    knockBurst8: number | null;
    outsideRingSec: number | null;
    topWeaponShare: number | null;
    weaponsHeld: number | null;
}

const maxInWindow = (timestamps: number[], windowMs: number): number => {
    if (timestamps.length === 0) return 0;
    const sorted = [...timestamps].sort((a, b) => a - b);
    let max = 0;
    let left = 0;
    for (let right = 0; right < sorted.length; right++) {
        while (sorted[right]! - sorted[left]! > windowMs) left += 1;
        max = Math.max(max, right - left + 1);
    }
    return max;
};

export function extractPlaystyleSignals(match: Match, outsideRingMs?: number | null): PlaystyleSignals {
    const support = getRevivesReceived(match);
    const respawnsRecv = support === null ? null : support.respawns;
    const revivesRecv = support === null ? null : support.revives;
    const timesKnocked = getTimesKnocked(match);

    let outsideMs = outsideRingMs;
    if (outsideMs === undefined) {
        outsideMs = getTimeOutsideRingMs(match);
    }
    const outsideRingSec = outsideMs === null ? null : outsideMs / 1000;

    const events = match.events;
    let burst12: number | null = null;
    let knockBurst8: number | null = null;
    if (Array.isArray(events) && events.length > 0) {
        const killTs = events
            .filter((e) => e.type === 'kill' && isSamePlayer(e.attacker, match.playerName))
            .map((e) => e.timestamp);
        const knockTs = events
            .filter((e) => e.type === 'knockdown' && isSamePlayer(e.attacker, match.playerName))
            .map((e) => e.timestamp);
        burst12 = maxInWindow(killTs, 12_000);
        knockBurst8 = maxInWindow(knockTs, 8_000);
    }

    let topWeaponShare: number | null = null;
    const combat = match.weaponCombat;
    if (combat) {
        const kills = Object.values(combat).map((entry) => entry.kills || 0);
        const total = kills.reduce((sum, k) => sum + k, 0);
        if (total >= 3) {
            topWeaponShare = Math.max(...kills) / total;
        }
    }

    let weaponsHeld: number | null = null;
    const timeline = match.weaponTimeline;
    if (Array.isArray(timeline) && timeline.length > 0) {
        const names = new Set<string>();
        for (const entry of timeline) {
            if (entry.primary) names.add(entry.primary);
            if (entry.secondary) names.add(entry.secondary);
        }
        weaponsHeld = names.size;
    }

    return {
        respawnsRecv,
        revivesRecv,
        timesKnocked,
        burst12,
        knockBurst8,
        outsideRingSec,
        topWeaponShare,
        weaponsHeld,
    };
}

/** Ground distance in map units; jumps (respawn / redeploy) longer than 5 m-scale are skipped. */
export const calculateTotalDistance = (path: Match['path'], mapName: string): number => {
    if (!path || !Array.isArray(path) || path.length < 2) return 0;
    const config = getMapConfig(mapName);
    const scale = config?.scale || 30;
    const RAW_JUMP_THRESHOLD = 5.0 * scale;

    let totalDist = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        if (!p1 || !p2 || typeof p1.x !== 'number' || typeof p2.x !== 'number') continue;
        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        if (dist <= RAW_JUMP_THRESHOLD) totalDist += dist;
    }
    return Math.round(totalDist);
};

/**
 * Per-match numbers the playstyle rules read. Shared by the match panel and the share card
 * so both always name the same playstyle. `nowMs` stands in for endTime while a match is live.
 */
export function computePlaystyleBase(match: Match, nowMs: number = Date.now()): PlaystyleBase {
    const placement = typeof match.placement === 'string' ? parseInt(match.placement) : (match.placement || 20);
    const damage = Number(match.damage || 0);
    const kills = Number(match.kills || 0);
    const assists = Number(match.assists || 0);
    const events = match.events || [];
    const myName = match.playerName;

    // 넉다운→킬 전환율: 피해자 기준 유니크 (동일 넉다운 로그 중복 시 분모 과대 방지)
    const norm = (s: string) => s.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    const knockedVictims = new Set(
        events
            .filter((e) => e.type === 'knockdown' && e.attacker === myName)
            .map((k) => k.victim)
            .filter((v): v is string => !!v)
            .map(norm),
    );
    let kcr = 0;
    if (knockedVictims.size > 0) {
        const finished = new Set(
            events
                .filter((e) => e.type === 'kill' && e.attacker === myName && e.victim && knockedVictims.has(norm(e.victim)))
                .map((k) => norm(k.victim!)),
        );
        kcr = Math.min(100, Math.round((finished.size / knockedVictims.size) * 100));
    } else {
        const tk = Number(match.knocks || 0);
        if (tk > 0) kcr = Math.min(100, Math.round((kills / tk) * 100));
    }

    let squadKills = Number(match.squadKills || 0);
    if (assists + kills > squadKills) squadKills = assists + kills;

    const durationMs = toGameElapsedMs((match.endTime || nowMs) - match.startTime);
    const timeMin = durationMs / 1000 / 60;
    const dist = calculateTotalDistance(match.path, match.map);

    let kpp = Number(Math.round(((kills + assists) / squadKills) * 100));
    if (squadKills === 0) kpp = 0;
    else if (kpp > 100) kpp = 100;

    return {
        timeMin,
        dpm: timeMin > 0.1 ? Math.round(damage / timeMin) : 0,
        speed: timeMin > 0.5 ? Math.round(dist / timeMin) : 0,
        dist,
        dpk: kills > 0 ? Math.round(damage / kills) : 0,
        kills,
        damage,
        kcr,
        assists,
        placement,
        kpp,
        squadKills,
    };
}

type PlaystyleRule =[PlaystyleKey, (x: PlaystyleBase, f: PlaystyleSignals) => boolean];

const RULES: PlaystyleRule[] = [
    ['deathbox', (x) => x.timeMin < 3 && x.damage < 150],
    ['dominator', (x) => x.kills >= 10 && x.kcr > 85],
    ['aimbot', (x) => x.kills >= 7 && x.damage >= 150 * x.kills && x.damage <= 250 * x.kills],
    ['warlord', (x) => x.kills >= 7 && x.damage >= 2500],
    ['protagonist', (x) => x.squadKills >= 8 && x.kills >= 0.6 * x.squadKills],
    ['phoenix', (x, f) => f.respawnsRecv !== null && f.respawnsRecv >= 1 && x.placement === 1],
    ['reborn', (x, f) => f.respawnsRecv !== null && f.respawnsRecv >= 1 && x.placement >= 2 && x.placement <= 5],
    ['ace', (_x, f) => f.burst12 !== null && f.burst12 >= 3],
    ['blitz', (_x, f) => f.knockBurst8 !== null && f.knockBurst8 >= 3],
    ['pacifist', (x) => x.placement === 1 && x.kills === 0 && x.assists === 0 && x.damage < 300],
    ['backpack', (x) => x.placement === 1 && x.kills <= 2 && x.damage < 500 && x.assists <= 2],
    ['champion', (x) => x.placement === 1],
    ['unluckyAce', (x) => x.placement > 10 && x.kills >= 5],
    ['heartbreaker', (x) => x.placement === 2],
    ['tumbler', (_x, f) =>
        f.timesKnocked !== null && f.timesKnocked >= 3 && f.revivesRecv !== null && f.revivesRecv >= 2],
    ['ringSurfer', (x, f) => f.outsideRingSec !== null && f.outsideRingSec >= 60 && x.placement <= 5],
    ['observer', (x) => x.squadKills >= 6 && x.kpp <= 15 && x.timeMin > 5],
    ['sidekick', (x) => x.assists >= 4 && x.kills === 0],
    ['atlas', (x) => x.squadKills >= 8 && x.kpp >= 80 && x.kills >= 3],
    ['assassin', (x) => x.kills >= 4 && x.dpk < 140],
    ['sniper', (x) => x.damage >= 2000 && (x.kills <= 3 || x.dpk > 600)],
    ['berserker', (x) => x.timeMin < 5 && (x.dpm > 180 || x.kills >= 3)],
    ['sweeper', (x) => x.kills >= 5],
    ['oneTrick', (x, f) => f.topWeaponShare !== null && x.kills >= 4 && f.topWeaponShare >= 0.9],
    ['finisher', (x) => x.kills >= 3 && x.kcr >= 90],
    ['collector', (_x, f) => f.weaponsHeld !== null && f.weaponsHeld >= 8],
    ['support', (x) => x.kills <= 1 && x.assists >= 3],
    ['soldier', (x) => x.kills >= 2 && x.damage >= 600],
    ['survivor', (x) => x.placement <= 5 && x.kills <= 2],
    ['vanguard', (x) => x.timeMin < 8 && x.damage >= 300],
    ['chihuahua', (x) => x.kills === 0 && x.damage >= 450],
    ['rat', (x) => x.timeMin > 12 && x.speed < 45],
    ['delivery', (x) => x.dist > 1500 && x.damage < 200],
    ['tourist', (x) => x.kills === 0 && x.damage < 150],
    ['skirmisher', (x) => x.kills >= 1 || x.damage >= 300],
];

export function classifyPlaystyle(base: PlaystyleBase, signals: PlaystyleSignals): PlaystyleKey {
    for (const [key, pred] of RULES) {
        if (pred(base, signals)) return key;
    }
    return 'npc';
}

export type PlaystyleTier = 's' | 'a' | 'b' | 'c' | 'd' | 'e';
export interface PlaystyleVisual { tier: PlaystyleTier; background: string; glow: string }
export const PLAYSTYLE_VISUALS: Record<PlaystyleKey, PlaystyleVisual> = {
    dominator: { tier: 's', background: 'linear-gradient(135deg, #8a5eec 0%, #0066e2 100%)', glow: '#8a5eec73' },
    aimbot: { tier: 's', background: 'linear-gradient(135deg, #199763 0%, #607a05 100%)', glow: '#19976373' },
    warlord: { tier: 's', background: 'linear-gradient(135deg, #d43691 0%, #8d3fcd 100%)', glow: '#d4369173' },
    protagonist: { tier: 's', background: 'linear-gradient(135deg, #1b4ba9 0%, #7a004c 100%)', glow: '#1b4ba973' },
    phoenix: { tier: 'a', background: 'linear-gradient(135deg, #cb3901 0%, #a72684 100%)', glow: '#cb390173' },
    reborn: { tier: 'a', background: 'linear-gradient(135deg, #278c81 0%, #007a87 100%)', glow: '#278c8173' },
    ace: { tier: 'a', background: 'linear-gradient(135deg, #b25c65 0%, #885594 100%)', glow: '#b25c6573' },
    blitz: { tier: 'a', background: 'linear-gradient(135deg, #0a77e6 0%, #8d41bb 100%)', glow: '#0a77e673' },
    champion: { tier: 'a', background: 'linear-gradient(135deg, #ad6700 0%, #a55017 100%)', glow: '#ad670073' },
    unluckyAce: { tier: 'a', background: 'linear-gradient(135deg, #ca3a80 0%, #c12442 100%)', glow: '#ca3a8073' },
    tumbler: { tier: 'b', background: 'linear-gradient(135deg, #8f1d20 0%, #6d024e 100%)', glow: '#8f1d2073' },
    ringSurfer: { tier: 'b', background: 'linear-gradient(135deg, #00398d 0%, #3c096c 100%)', glow: '#00398d73' },
    heartbreaker: { tier: 'b', background: 'linear-gradient(135deg, #4f1370 0%, #300065 100%)', glow: '#4f137073' },
    pacifist: { tier: 'b', background: 'linear-gradient(135deg, #797a00 0%, #247233 100%)', glow: '#797a0073' },
    backpack: { tier: 'b', background: 'linear-gradient(135deg, #6a1b00 0%, #550002 100%)', glow: '#6a1b0073' },
    atlas: { tier: 'c', background: 'linear-gradient(135deg, #6f422c 0%, #4b2d00 100%)', glow: '#6f422c73' },
    assassin: { tier: 'c', background: 'linear-gradient(135deg, #002b78 0%, #00065a 100%)', glow: '#002b7873' },
    sniper: { tier: 'c', background: 'linear-gradient(135deg, #0e739d 0%, #015283 100%)', glow: '#0e739d73' },
    berserker: { tier: 'c', background: 'linear-gradient(135deg, #8d2850 0%, #71000c 100%)', glow: '#8d285073' },
    sweeper: { tier: 'c', background: 'linear-gradient(135deg, #8b6027 0%, #6d4400 100%)', glow: '#8b602773' },
    oneTrick: { tier: 'c', background: 'linear-gradient(135deg, #6b5eba 0%, #51419a 100%)', glow: '#6b5eba73' },
    finisher: { tier: 'c', background: 'linear-gradient(135deg, #59162e 0%, #34002a 100%)', glow: '#59162e73' },
    collector: { tier: 'c', background: 'linear-gradient(135deg, #b04836 0%, #8e2917 100%)', glow: '#b0483673' },
    support: { tier: 'c', background: 'linear-gradient(135deg, #296c2a 0%, #014f0b 100%)', glow: '#296c2a73' },
    soldier: { tier: 'd', background: '#00456c', glow: '#00456c73' },
    survivor: { tier: 'd', background: '#203f07', glow: '#203f0773' },
    vanguard: { tier: 'd', background: '#4f1f46', glow: '#4f1f4673' },
    skirmisher: { tier: 'd', background: '#6e7488', glow: '#6e748873' },
    npc: { tier: 'd', background: '#4c4b3f', glow: '#4c4b3f73' },
    deathbox: { tier: 'e', background: '#251806', glow: '#25180673' },
    observer: { tier: 'e', background: '#002334', glow: '#00233473' },
    sidekick: { tier: 'e', background: '#3d0b02', glow: '#3d0b0273' },
    chihuahua: { tier: 'e', background: '#6d446c', glow: '#6d446c73' },
    rat: { tier: 'e', background: '#002802', glow: '#00280273' },
    delivery: { tier: 'e', background: '#666256', glow: '#66625673' },
    tourist: { tier: 'e', background: '#1f1642', glow: '#1f164273' },
};

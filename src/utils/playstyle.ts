import type { Match } from '../types';
import { isSamePlayer } from './helpers';
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

type PlaystyleRule = [PlaystyleKey, (x: PlaystyleBase, f: PlaystyleSignals) => boolean];

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

export const PLAYSTYLE_VISUALS: Record<PlaystyleKey, { gradient: string; isPrimary?: boolean }> = {
    deathbox: { gradient: 'linear-gradient(135deg, #4b4340 0%, #24201e 100%)' },
    aimbot: { gradient: 'linear-gradient(135deg, #008ea0 0%, #3dffb5 100%)', isPrimary: true },
    dominator: { gradient: 'linear-gradient(135deg, #b224ef 0%, #ff8b50 100%)', isPrimary: true },
    warlord: { gradient: 'linear-gradient(135deg, #ff0844 0%, #635198 100%)', isPrimary: true },
    atlas: { gradient: 'linear-gradient(135deg, #f7903c 0%, #00c7aa 100%)', isPrimary: true },
    protagonist: { gradient: 'linear-gradient(135deg, #8871ed 0%, #00107b 100%)', isPrimary: true },
    observer: { gradient: 'linear-gradient(135deg, #304352 0%, #171d24 100%)' },
    pacifist: { gradient: 'linear-gradient(135deg, #e7f6d1 0%, #a8e063 100%)' },
    backpack: { gradient: 'linear-gradient(135deg, #fa8d75 0%, #B5AB87 100%)' },
    champion: { gradient: 'linear-gradient(135deg, #FDC830 0%, #F37335 100%)', isPrimary: true },
    unluckyAce: { gradient: 'linear-gradient(135deg, #5a2e2e 0%, #2a1616 100%)', isPrimary: true },
    assassin: { gradient: 'linear-gradient(135deg, #141517 0%, #2c2f33 100%)' },
    sniper: { gradient: 'linear-gradient(135deg, #1a2a6c 0%, #11998e 100%)' },
    sidekick: { gradient: 'linear-gradient(135deg, #d4a373 0%, #a07a58 100%)' },
    berserker: { gradient: 'linear-gradient(135deg, #cb2d3e 0%, #c63900 100%)' },
    sweeper: { gradient: 'linear-gradient(135deg, #e65c00 0%, #F9D423 100%)' },
    soldier: { gradient: 'linear-gradient(135deg, #515e63 0%, #2f383d 100%)' },
    chihuahua: { gradient: 'linear-gradient(135deg, #a67c8e 0%, #6b4d5a 100%)' },
    rat: { gradient: 'linear-gradient(135deg, #2b302c 0%, #151a17 100%)' },
    heartbreaker: { gradient: 'linear-gradient(135deg, #604561 0%, #362436 100%)' },
    delivery: { gradient: 'linear-gradient(135deg, #705e49 0%, #453727 100%)' },
    tourist: { gradient: 'linear-gradient(135deg, #6c6675 0%, #3f3a47 100%)' },
    npc: { gradient: 'linear-gradient(135deg, #424242 0%, #222222 100%)' },
    phoenix: { gradient: 'linear-gradient(135deg, #ff512f 0%, #f09819 100%)', isPrimary: true },
    reborn: { gradient: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)', isPrimary: true },
    ace: { gradient: 'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)', isPrimary: true },
    blitz: { gradient: 'linear-gradient(135deg, #4776e6 0%, #8e54e9 100%)', isPrimary: true },
    tumbler: { gradient: 'linear-gradient(135deg, #c79081 0%, #8a5a44 100%)' },
    ringSurfer: { gradient: 'linear-gradient(135deg, #1488cc 0%, #2b32b2 100%)' },
    oneTrick: { gradient: 'linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)' },
    finisher: { gradient: 'linear-gradient(135deg, #870000 0%, #190a05 100%)' },
    collector: { gradient: 'linear-gradient(135deg, #8e6e66 0%, #5a4540 100%)' },
    support: { gradient: 'linear-gradient(135deg, #3a7d44 0%, #1f4d2b 100%)' },
    survivor: { gradient: 'linear-gradient(135deg, #3ca55c 0%, #7d7a2e 100%)' },
    vanguard: { gradient: 'linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)' },
    skirmisher: { gradient: 'linear-gradient(135deg, #536976 0%, #292e49 100%)' },
};

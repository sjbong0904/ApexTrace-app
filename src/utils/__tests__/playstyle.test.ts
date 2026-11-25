import { describe, expect, it } from 'vitest';
import type { Match } from '../../types';
import { PLAYSTYLE_ICON_PATHS } from '../../assets/playstyleIcons';
import {
    classifyPlaystyle,
    extractPlaystyleSignals,
    PLAYSTYLE_VISUALS,
    type PlaystyleBase,
    type PlaystyleKey,
    type PlaystyleSignals,
} from '../playstyle';

const asMatch = (m: Partial<Match>) =>
    ({ path: [], events: [], ringRounds: [], playerName: 'Player', ...m }) as unknown as Match;

const base = (overrides: Partial<PlaystyleBase> = {}): PlaystyleBase => ({
    timeMin: 10,
    dpm: 50,
    speed: 60,
    dist: 500,
    dpk: 200,
    kills: 0,
    damage: 200,
    kcr: 50,
    assists: 0,
    placement: 10,
    kpp: 50,
    squadKills: 2,
    ...overrides,
});

const signals = (overrides: Partial<PlaystyleSignals> = {}): PlaystyleSignals => ({
    respawnsRecv: null,
    revivesRecv: null,
    timesKnocked: null,
    burst12: null,
    knockBurst8: null,
    outsideRingSec: null,
    topWeaponShare: null,
    weaponsHeld: null,
    ...overrides,
});

const hit = (key: PlaystyleKey, x: Partial<PlaystyleBase> = {}, f: Partial<PlaystyleSignals> = {}) => {
    expect(classifyPlaystyle(base(x), signals(f))).toBe(key);
};

describe('classifyPlaystyle rules', () => {
    it('deathbox', () => hit('deathbox', { timeMin: 2, damage: 100 }));
    it('dominator', () => hit('dominator', { kills: 10, kcr: 90, damage: 2000 }));
    it('aimbot', () => hit('aimbot', { kills: 7, damage: 1400, kcr: 50 }));
    it('warlord', () => hit('warlord', { kills: 7, damage: 2500, kcr: 50 }));
    it('protagonist', () => hit('protagonist', { squadKills: 8, kills: 5, damage: 800, kcr: 50 }));
    it('phoenix', () => hit('phoenix', { placement: 1, damage: 400, kills: 3 }, { respawnsRecv: 1 }));
    it('reborn', () => hit('reborn', { placement: 3, damage: 400, kills: 2 }, { respawnsRecv: 1 }));
    it('ace', () => hit('ace', { placement: 8, kills: 3, damage: 500 }, { burst12: 3 }));
    it('blitz', () => hit('blitz', { placement: 8, kills: 2, damage: 400 }, { knockBurst8: 3 }));
    it('pacifist', () => hit('pacifist', { placement: 1, kills: 0, assists: 0, damage: 200 }));
    it('backpack', () => hit('backpack', { placement: 1, kills: 1, assists: 1, damage: 400 }));
    it('champion', () => hit('champion', { placement: 1, kills: 3, assists: 1, damage: 600 }));
    it('unluckyAce', () => hit('unluckyAce', { placement: 11, kills: 5, damage: 800, dpk: 160, kcr: 50 }));
    it('heartbreaker', () => hit('heartbreaker', { placement: 2, kills: 2, damage: 400 }));
    it('tumbler', () =>
        hit('tumbler', { placement: 8, kills: 1, damage: 300 }, { timesKnocked: 3, revivesRecv: 2 }));
    it('ringSurfer', () =>
        hit('ringSurfer', { placement: 4, kills: 1, damage: 300 }, { outsideRingSec: 60 }));
    it('observer', () =>
        hit('observer', { squadKills: 6, kpp: 15, timeMin: 6, kills: 0, damage: 200, assists: 1 }));
    it('sidekick', () => hit('sidekick', { assists: 4, kills: 0, damage: 200, placement: 8 }));
    it('atlas', () =>
        hit('atlas', { squadKills: 8, kpp: 80, kills: 3, damage: 500, dpk: 167, kcr: 50 }));
    it('assassin', () => hit('assassin', { kills: 4, dpk: 100, damage: 400, kcr: 50 }));
    it('sniper', () => hit('sniper', { damage: 2000, kills: 2, dpk: 1000, kcr: 50 }));
    it('berserker', () => hit('berserker', { timeMin: 4, dpm: 200, kills: 1, damage: 400 }));
    it('sweeper', () => hit('sweeper', { kills: 5, dpk: 160, damage: 800, kcr: 50, timeMin: 10 }));
    it('oneTrick', () =>
        hit('oneTrick', { kills: 4, dpk: 200, damage: 800, kcr: 50 }, { topWeaponShare: 0.9 }));
    it('finisher', () => hit('finisher', { kills: 3, kcr: 90, damage: 500, dpk: 167 }));
    it('collector', () =>
        hit('collector', { kills: 0, damage: 200, assists: 0 }, { weaponsHeld: 8 }));
    it('support', () => hit('support', { kills: 1, assists: 3, damage: 200 }));
    it('soldier', () => hit('soldier', { kills: 2, damage: 600, placement: 10 }));
    it('survivor', () => hit('survivor', { placement: 5, kills: 2, damage: 200, timeMin: 10 }));
    it('vanguard', () => hit('vanguard', { timeMin: 7, damage: 300, kills: 0, placement: 10 }));
    it('chihuahua', () => hit('chihuahua', { kills: 0, damage: 450, timeMin: 10, placement: 10 }));
    it('rat', () => hit('rat', { timeMin: 13, speed: 40, kills: 1, damage: 200, dist: 500 }));
    it('delivery', () => hit('delivery', { dist: 1501, damage: 100, kills: 1, timeMin: 10, speed: 60 }));
    it('tourist', () => hit('tourist', { kills: 0, damage: 100, timeMin: 10, speed: 60, dist: 500 }));
    it('skirmisher', () => hit('skirmisher', { kills: 1, damage: 200, timeMin: 10, speed: 60, dist: 500 }));
    it('npc fallback', () => hit('npc', { kills: 0, damage: 200, timeMin: 10, speed: 60, dist: 500, placement: 10 }));
});

describe('classifyPlaystyle null-skip', () => {
    it('P1 with respawnsRecv null falls to champion, not phoenix', () => {
        expect(
            classifyPlaystyle(
                base({ placement: 1, kills: 3, assists: 1, damage: 600 }),
                signals({ respawnsRecv: null }),
            ),
        ).toBe('champion');
    });

    it('ace-style inputs with burst12 null do not classify as ace', () => {
        expect(
            classifyPlaystyle(
                base({ placement: 8, kills: 3, damage: 500 }),
                signals({ burst12: null }),
            ),
        ).not.toBe('ace');
    });
});

describe('classifyPlaystyle priority', () => {
    it('P1 + respawn → phoenix', () => {
        expect(
            classifyPlaystyle(
                base({ placement: 1, kills: 3, damage: 600 }),
                signals({ respawnsRecv: 1 }),
            ),
        ).toBe('phoenix');
    });

    it('P1 + burst12=3 (no respawn) → ace', () => {
        expect(
            classifyPlaystyle(
                base({ placement: 1, kills: 3, damage: 600 }),
                signals({ respawnsRecv: null, burst12: 3 }),
            ),
        ).toBe('ace');
    });

    it('kills 10, kcr 90, damage in aimbot band → dominator', () => {
        expect(
            classifyPlaystyle(
                base({ kills: 10, kcr: 90, damage: 2000 }),
                signals(),
            ),
        ).toBe('dominator');
    });
});

describe('extractPlaystyleSignals', () => {
    it('burst window: 3 kills within 12000 ms → 3', () => {
        const match = asMatch({
            playerName: 'Player',
            events: [
                { type: 'kill', attacker: 'Player', victim: 'A', timestamp: 1000 },
                { type: 'kill', attacker: 'Player', victim: 'B', timestamp: 5000 },
                { type: 'kill', attacker: 'Player', victim: 'C', timestamp: 12000 },
            ],
        });
        expect(extractPlaystyleSignals(match, null).burst12).toBe(3);
    });

    it('burst window: 3 kills spread over 13000 ms → 2', () => {
        const match = asMatch({
            playerName: 'Player',
            events: [
                { type: 'kill', attacker: 'Player', victim: 'A', timestamp: 0 },
                { type: 'kill', attacker: 'Player', victim: 'B', timestamp: 6500 },
                { type: 'kill', attacker: 'Player', victim: 'C', timestamp: 13000 },
            ],
        });
        expect(extractPlaystyleSignals(match, null).burst12).toBe(2);
    });

    it('attacker name match via isSamePlayer with [TAG] prefix', () => {
        const match = asMatch({
            playerName: 'Player',
            events: [
                { type: 'kill', attacker: '[TAG] Player', victim: 'A', timestamp: 1000 },
                { type: 'kill', attacker: '[TAG] Player', victim: 'B', timestamp: 2000 },
                { type: 'kill', attacker: '[TAG] Player', victim: 'C', timestamp: 3000 },
            ],
        });
        expect(extractPlaystyleSignals(match, null).burst12).toBe(3);
    });

    it('empty events → burst12 null', () => {
        expect(extractPlaystyleSignals(asMatch({ events: [] }), null).burst12).toBeNull();
    });

    it('weaponCombat total < 3 → topWeaponShare null', () => {
        const match = asMatch({
            weaponCombat: {
                r301: { kills: 1, assists: 0, holdMs: 0, deaths: 0, qualify: true },
                flatline: { kills: 1, assists: 0, holdMs: 0, deaths: 0, qualify: true },
            },
        });
        expect(extractPlaystyleSignals(match, null).topWeaponShare).toBeNull();
    });

    it('weaponsHeld distinct count across primary/secondary', () => {
        const match = asMatch({
            weaponTimeline: [
                { timestamp: 1, primary: 'r301', secondary: 'wingman' },
                { timestamp: 2, primary: 'r301', secondary: 'peacekeeper' },
                { timestamp: 3, primary: 'flatline', secondary: '' },
                { timestamp: 4, primary: 'spitfire', secondary: null },
            ],
        });
        expect(extractPlaystyleSignals(match, null).weaponsHeld).toBe(5);
    });

    it('maps revives/respawns and outsideRingSec from args', () => {
        const match = asMatch({
            playerName: 'Player',
            events: [
                { type: 'respawn', victim: 'Player', timestamp: 1 },
                { type: 'revive', victim: 'Player', timestamp: 2 },
                { type: 'knockdown', attacker: 'Enemy', victim: 'Player', timestamp: 3 },
            ],
        });
        const f = extractPlaystyleSignals(match, 90_000);
        expect(f.respawnsRecv).toBe(1);
        expect(f.revivesRecv).toBe(1);
        expect(f.timesKnocked).toBe(1);
        expect(f.outsideRingSec).toBe(90);
    });
});

const ALL_PLAYSTYLE_KEYS: PlaystyleKey[] = [
    'deathbox',
    'dominator',
    'aimbot',
    'warlord',
    'protagonist',
    'phoenix',
    'reborn',
    'ace',
    'blitz',
    'pacifist',
    'backpack',
    'champion',
    'unluckyAce',
    'heartbreaker',
    'tumbler',
    'ringSurfer',
    'observer',
    'sidekick',
    'atlas',
    'assassin',
    'sniper',
    'berserker',
    'sweeper',
    'oneTrick',
    'finisher',
    'collector',
    'support',
    'soldier',
    'survivor',
    'vanguard',
    'chihuahua',
    'rat',
    'delivery',
    'tourist',
    'skirmisher',
    'npc',
];

const relativeLuminance = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrastAgainstWhite = (hex: string): number => {
    const L = relativeLuminance(hex);
    return 1.05 / (L + 0.05);
};

describe('PLAYSTYLE_VISUALS', () => {
    it('covers every classifyPlaystyle key with valid visual fields', () => {
        for (const key of ALL_PLAYSTYLE_KEYS) {
            const visual = PLAYSTYLE_VISUALS[key];
            expect(visual).toBeDefined();
            expect(['s', 'a', 'b', 'c', 'd', 'e']).toContain(visual.tier);
            expect(visual.background.length).toBeGreaterThan(0);
            expect(PLAYSTYLE_ICON_PATHS[key]?.length).toBeGreaterThan(0);
        }
    });

    it('keeps white text contrast >= 3.5 against every background hex', () => {
        for (const key of ALL_PLAYSTYLE_KEYS) {
            const hexes = PLAYSTYLE_VISUALS[key].background.match(/#[0-9a-fA-F]{6}/g) ?? [];
            expect(hexes.length).toBeGreaterThan(0);
            for (const hex of hexes) {
                expect(contrastAgainstWhite(hex)).toBeGreaterThanOrEqual(3.5);
            }
        }
    });

    it('uses 36 distinct icons across 36 keys', () => {
        expect(ALL_PLAYSTYLE_KEYS).toHaveLength(36);
        const icons = new Set(ALL_PLAYSTYLE_KEYS.map((key) => PLAYSTYLE_ICON_PATHS[key].join(' ')));
        expect(icons.size).toBe(36);
    });
});

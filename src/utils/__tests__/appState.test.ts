/** Small app-state / formatting helpers: account record, premium funnel, demo mode, images, share. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '../../types';
import { hasAccountRecord, summarizeBrBlock } from '../accountRecord';
import {
    consumeFreeReplay,
    getFreeReplayState,
    isLaunchNotifyOn,
    openPremiumDialog,
    PREMIUM_DIALOG_EVENT,
    PREMIUM_STATE_EVENT,
    setLaunchNotify,
} from '../premium';
import { filterDemoMatchesByMode, isDemoEligible, retireDemo, reviveDemo } from '../demoMode';
import { localImageUrl, previewImageUrl, REMOTE_IMAGE_ROOT, remoteImageUrl } from '../imageSource';
import { buildMatchShareFilename } from '../matchShare';

beforeEach(() => localStorage.clear());

describe('accountRecord', () => {
    it('summarizes a BR block', () => {
        expect(summarizeBrBlock({ games: 200, wins: 10, kills: 300, deaths: 150, damage_dealt: 120000, top_5s: 50 })).toEqual({
            games: 200, wins: 10, winRate: '5.0', top5Rate: '25.0', kills: 300, kd: '2.00', avgDamage: 600,
        });
    });
    it('no deaths → K/D = kills; empty blocks → null', () => {
        expect(summarizeBrBlock({ games: 1, kills: 3 })?.kd).toBe('3.00');
        expect(summarizeBrBlock({ games: 0 })).toBeNull();
        expect(summarizeBrBlock(null)).toBeNull();
        expect(hasAccountRecord(null)).toBe(false);
        expect(hasAccountRecord({ career: { battle_royale: { games: 5 } } } as never)).toBe(true);
    });
});

describe('premium', () => {
    const win = new EventTarget();
    beforeEach(() => {
        vi.stubGlobal('window', win);
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 10, 24, 12, 0, 0));
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('opens the dialog with its source', () => {
        const seen: unknown[] = [];
        const onOpen = (e: Event) => seen.push((e as CustomEvent).detail);
        win.addEventListener(PREMIUM_DIALOG_EVENT, onOpen);
        openPremiumDialog('replay');
        win.removeEventListener(PREMIUM_DIALOG_EVENT, onOpen);
        expect(seen).toEqual([{ source: 'replay' }]);
    });

    it('launch-notify toggle persists and broadcasts', () => {
        let changes = 0;
        const onState = () => { changes += 1; };
        win.addEventListener(PREMIUM_STATE_EVENT, onState);
        expect(isLaunchNotifyOn()).toBe(false);
        setLaunchNotify(true);
        expect(isLaunchNotifyOn()).toBe(true);
        setLaunchNotify(false);
        expect(isLaunchNotifyOn()).toBe(false);
        win.removeEventListener(PREMIUM_STATE_EVENT, onState);
        expect(changes).toBe(2);
    });

    it('one free replay per local day', () => {
        expect(getFreeReplayState('a')).toBe('available');
        expect(consumeFreeReplay('a')).toBe(true);
        expect(getFreeReplayState('a')).toBe('unlocked');
        expect(consumeFreeReplay('a')).toBe(true); // re-watching the same match is fine
        expect(getFreeReplayState('b')).toBe('used');
        expect(consumeFreeReplay('b')).toBe(false);

        vi.setSystemTime(new Date(2026, 10, 25, 0, 0, 1)); // refills at local midnight
        expect(getFreeReplayState('b')).toBe('available');
    });

    it('ignores a corrupt stored record', () => {
        localStorage.setItem('free_replay_day', '{not json');
        expect(getFreeReplayState('a')).toBe('available');
    });
});

describe('demoMode', () => {
    it('eligible only on a fresh device', () => {
        expect(isDemoEligible()).toBe(true);
        retireDemo();
        expect(isDemoEligible()).toBe(false);
        reviveDemo();
        expect(isDemoEligible()).toBe(true);
        localStorage.setItem('apex_pinned_uid', 'u1');
        expect(isDemoEligible()).toBe(false);
        localStorage.clear();
        localStorage.setItem('first_record_seen', '1');
        expect(isDemoEligible()).toBe(false);
    });

    it('filters by mode like the season-stats payload', () => {
        const ms = ['Ranked Trios', 'Trios', 'Duos', 'Ranked Duos', 'Mixtape'].map((mode) => ({ mode }) as Match);
        const modes = (sel: 'ALL' | 'RANKED' | 'TRIO' | 'DUO') => filterDemoMatchesByMode(ms, sel).map((m) => m.mode);
        expect(modes('ALL')).toEqual(['Ranked Trios', 'Trios', 'Duos', 'Ranked Duos']);
        expect(modes('RANKED')).toEqual(['Ranked Trios', 'Ranked Duos']);
        expect(modes('TRIO')).toEqual(['Trios']);
        expect(modes('DUO')).toEqual(['Duos']);
    });
});

describe('imageSource URLs', () => {
    const remote = `${REMOTE_IMAGE_ROOT}/events/kill%20feed.png`;

    it('maps files and remote URLs to /images paths', () => {
        expect(localImageUrl('events/kill.png')).toBe('/images/events/kill.png');
        expect(localImageUrl('/events/kill.png')).toBe('/images/events/kill.png');
        expect(localImageUrl('/images/a.png')).toBe('/images/a.png');
        expect(localImageUrl(remote)).toBe('/images/events/kill feed.png');
        expect(localImageUrl('https://example.com/x.png')).toBe('https://example.com/x.png');
        expect(previewImageUrl('preview/a.png')).toBe('/images/a.png');
    });

    it('maps local paths back to the encoded Supabase URL', () => {
        expect(remoteImageUrl('/images/events/kill feed.png')).toBe(remote);
        expect(remoteImageUrl('/images/preview/events/kill feed.png')).toBe(remote);
        expect(remoteImageUrl(remote)).toBe(remote);
        expect(remoteImageUrl('')).toBe('');
    });
});

describe('matchShare', () => {
    it('builds a filesystem-safe file name', () => {
        expect(buildMatchShareFilename("World's Edge", new Date(2026, 0, 2, 3, 4, 5)))
            .toBe('ApexTrace-Match-WorldsEdge-20260102030405.png');
        expect(buildMatchShareFilename('  ', new Date(2026, 0, 2, 3, 4, 5)))
            .toBe('ApexTrace-Match-Match-20260102030405.png');
    });
});

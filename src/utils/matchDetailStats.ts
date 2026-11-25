import type { Match } from '../types';
import { isSamePlayer } from './helpers';
import { buildMapReplay, type ReplayRingSample } from './mapReplay';

/**
 * Per-match numbers for the match detail "Details" tab. Every helper returns null when the
 * match was recorded without the signal it needs, so the UI can show "-" instead of a fake 0.
 */

/** Path samples are ~1 s apart; a longer gap is missing data, not time spent there. */
const MAX_PATH_STEP_MS = 5000;
/** Same as the replay: ring samples further apart than this are a hold, not a shrink. */
const RING_INTERP_MAX_GAP_MS = 4500;

/** Headshot hits / all damage hits, in %. Null for builds that did not count hits. */
export const getHeadshotRate = (match: Match): number | null => {
    const hits = match.damageHits;
    if (typeof hits !== 'number' || hits <= 0) return null;
    const headshots = Math.min(Number(match.headshots || 0), hits);
    return Math.round((headshots / hits) * 100);
};

/** Damage per knockdown dealt. Null when the player knocked nobody (or knocks are unknown). */
export const getDamagePerKnock = (match: Match): number | null => {
    const knocks = Number(match.knocks || 0);
    if (match.damage === null || knocks <= 0) return null;
    return Math.round(Number(match.damage || 0) / knocks);
};

/** Grenade damage; null for builds older than 0.0.16 (field missing). */
export const getGrenadeDamage = (match: Match): number | null =>
    typeof match.grenadeDamage === 'number' ? match.grenadeDamage : null;

/**
 * GEP has not been sending `ultimate_cooldown` (docs/RELEASE_NOTES.md v0.0.16), so a stored 0
 * almost always means "not collected". Only show a count once one was actually recorded.
 */
export const getUltimatesUsed = (match: Match): number | null =>
    Number(match.ultimatesUsed || 0) > 0 ? Number(match.ultimatesUsed) : null;

const hasEvents = (match: Match) => Array.isArray(match.events) && match.events.length > 0;

/** Times the local player was knocked down. */
export const getTimesKnocked = (match: Match): number | null => {
    if (hasEvents(match)) {
        return match.events.filter((e) => e.type === 'knockdown' && isSamePlayer(e.victim, match.playerName)).length;
    }
    // Summary-only row: weaponThreats only counts knocks with a known weapon, but it is all we have.
    const threats = match.weaponThreats ? Object.values(match.weaponThreats) : [];
    if (threats.length === 0) return null;
    return threats.reduce((sum, entry) => sum + (entry.knockdowns || 0), 0);
};

/** Times the local player was revived (picked up from a knock) and respawned (dropship). */
export const getRevivesReceived = (match: Match): { revives: number; respawns: number } | null => {
    if (!hasEvents(match)) return null;
    let revives = 0;
    let respawns = 0;
    for (const e of match.events) {
        if (!isSamePlayer(e.victim, match.playerName)) continue;
        if (e.type === 'revive') revives += 1;
        else if (e.type === 'respawn') respawns += 1;
    }
    return { revives, respawns };
};

const ringAt = (samples: ReplayRingSample[], t: number): ReplayRingSample | null => {
    let lo = 0;
    let hi = samples.length - 1;
    let i = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].t <= t) { i = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    // Before the first reading the zone is the whole map.
    if (i < 0) return null;
    const a = samples[i];
    const b = samples[i + 1];
    if (!b || b.t - a.t > RING_INTERP_MAX_GAP_MS) return a;
    const f = (t - a.t) / Math.max(1, b.t - a.t);
    return { t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, r: a.r + (b.r - a.r) * f };
};

/**
 * Time (ms) the player spent alive outside the closing zone. Uses the same path/ring
 * alignment as the map replay. Null when the match has no ring readings.
 */
export const getTimeOutsideRingMs = (match: Match): number | null => {
    const replay = buildMapReplay(match);
    if (!replay || replay.activeSamples.length === 0) return null;

    let outside = 0;
    for (const life of replay.lives) {
        const pts = life.points;
        for (let i = 0; i < pts.length - 1; i++) {
            const step = pts[i + 1].t - pts[i].t;
            if (step <= 0 || step > MAX_PATH_STEP_MS) continue;
            const ring = ringAt(replay.activeSamples, pts[i].t);
            if (!ring) continue;
            if (Math.hypot(pts[i].x - ring.x, pts[i].y - ring.y) > ring.r) outside += step;
        }
    }
    return outside;
};

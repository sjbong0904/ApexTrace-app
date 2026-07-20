// src/background/utils.js
console.log("🛠️ Utils Initialized");

// 1. DEFAULT CONFIGURATION — DB 로드 전 빈 객체로만 초기화
window.GAME_MODE_MAP = window.GAME_MODE_MAP || {};
window.LEGEND_MAP    = window.LEGEND_MAP    || {};
window.BG_MAP_DATA   = window.BG_MAP_DATA   || {};
window.WEAPON_MAP    = window.WEAPON_MAP    || {};
window.SEASONS       = window.SEASONS       || [];

// 2. UTILITY FUNCTIONS
const Utils = {

    cleanName: (name) => {
        if (!name) return "Unknown";
        let decoded = Utils.tryDecodeBase64(name);
        return decoded.replace(/\[[^\]]+\]\s*/g, '').replace(/\0/g, '').trim();
    },

    tryDecodeBase64: (str) => {
        if (!str || typeof str !== 'string') return str;
        try {
            const decoded = decodeURIComponent(
                atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
            );
            return decoded;
        } catch (e) {
            return str;
        }
    },

    getMapName: (rawMap) => {
        if (!rawMap) return "Unknown";
        // DB에서 로드된 맵 목록 먼저 체크
        if (window.BG_MAP_DATA?.[rawMap]) return rawMap;

        const lower = rawMap.toLowerCase();
        if (lower.includes('canyon'))                        return "Kings Canyon";
        if (lower.includes('olympus'))                       return "Olympus";
        if (lower.includes('world') || lower.includes('edge')) return "World's Edge";
        if (lower.includes('tropic') || lower.includes('storm')) return "Storm Point";
        if (lower.includes('moon') || lower.includes('broken')) return "Broken Moon";
        if (lower.includes('district'))                      return "E-District";
        return rawMap;
    },

    sendWorkerMessage: (messageId, content = {}) => {
        overwolf.windows.obtainDeclaredWindow("worker", (res) => {
            if (res.status === "success") {
                overwolf.windows.sendMessage(res.window.id, messageId, content, () => {});
            }
        });
    },

    broadcastToUiWindows: (messageId, content = {}) => {
        ['desktop', 'in_game'].forEach((windowName) => {
            overwolf.windows.obtainDeclaredWindow(windowName, (res) => {
                if (res.status === 'success' && res.window?.id) {
                    overwolf.windows.sendMessage(res.window.id, messageId, content, () => {});
                }
            });
        });
    },

    normalizeLegend: (rawName) => {
        if (!rawName) return "unknown";
        const clean = rawName.replace("#character_", "").replace("_NAME", "").toLowerCase();

        if (window.LEGEND_MAP?.[clean]) return window.LEGEND_MAP[clean];

        // 알 수 없는 레전드 코드 감지 → Discord 알림
        if (clean && clean !== "unknown") {
            if (!Utils._alertedLegends) Utils._alertedLegends = new Set();
            if (!Utils._alertedLegends.has(clean)) {
                Utils._alertedLegends.add(clean);
                if (window.DISCORD_WEBHOOK_URL) {
                    fetch(window.DISCORD_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            embeds: [{
                                title: "⚠️ Unknown Legend Detected",
                                color: 0xFF4444,
                                fields: [
                                    { name: "코드명", value: `\`${clean}\``, inline: true },
                                    { name: "조치", value: "game_constants DB 업데이트 필요", inline: true }
                                ],
                                timestamp: new Date().toISOString()
                            }]
                        })
                    }).catch(() => {});
                }
            }
        }
        return clean;
    },

    normalizeWeapon: (rawWeapon) => {
        if (!rawWeapon) return null;

        let clean = rawWeapon.toLowerCase()
            .replace('mp_weapon_', '').replace('mp_', '')
            .replace('weapon_', '').replace('auto_', '')
            .replace('_crate', '').replace('_takeover', '');

        // DB weapon_map 먼저 체크
        if (window.WEAPON_MAP?.[clean]) return window.WEAPON_MAP[clean];

        // melee → null
        if (clean.includes('melee') || clean.includes('karambit')) return null;

        // 아킴보
        if (clean.includes('mozam') && clean.includes('akimbo')) return 'mozambique_akimbo';
        if (clean.includes('p2020') && clean.includes('akimbo')) return 'p2020_akimbo';

        // 권총 & 샷건
        if (clean.includes('r301') || clean.includes('r-301') || clean.includes('rspn101') || clean.includes('carbine')) return 'r-301';
        if (clean.includes('mozam'))   return 'mozambique';
        if (clean.includes('p2020'))   return 'p2020';
        if (clean.includes('autopistol') || clean.includes('re45') || clean.includes('re-45') || clean.includes('r45')) return 're-45';
        if (clean.includes('wingman')) return 'wingman';
        if (clean.includes('eva'))     return 'eva-8';
        if (clean.includes('mastiff')) return 'mastiff';
        if (clean.includes('peacekeeper')) return 'peacekeeper';

        // SMG
        if (clean.includes('r99') || clean.includes('r-99') || clean.includes('r97')) return 'r-99';
        if (clean.includes('alternator')) return 'alternator';
        if (clean.includes('volt'))    return 'volt';
        if (clean.includes('prowler') || clean.includes('pdw')) return 'prowler';
        if (clean.includes('car') || clean.includes('c.a.r')) return 'c.a.r.';

        // AR
        if (clean.includes('flatline') || clean.includes('vinson')) return 'flatline';
        if (clean.includes('hemlok') || clean.includes('hemlock')) return 'hemlok';
        if (clean.includes('havoc') || clean.includes('energy_ar')) return 'havoc';
        if (clean.includes('nemesis')) return 'nemesis';

        // LMG
        if (clean.includes('devotion') || clean.includes('esaw') || clean.includes('devo')) return 'devotion';
        if (clean.includes('spitfire')) return 'spitfire';
        if (clean.includes('rampage') || clean.includes('dragon')) return 'rampage';
        if (clean.includes('lstar') || clean.includes('l-star')) return 'l-star';

        // 마크스맨 & 스나이퍼
        if (clean.includes('g7') || clean.includes('g2') || clean.includes('scout') || clean.includes('sniper_g7')) return 'g7scout';
        if (clean.includes('3030') || clean.includes('30-30') || clean.includes('repeater')) return '30-30';
        if (clean.includes('triple') || clean.includes('doubletake')) return 'tripletake';
        if (clean.includes('longbow') || clean.includes('dmr')) return 'longbow';
        if (clean.includes('bocek') || clean.includes('bow') || clean.includes('composite')) return 'bocek';
        if (clean.includes('charge') || clean.includes('defender')) return 'chargerifle';
        if (clean.includes('sentinel')) return 'sentinel';
        if (clean.includes('kraber') || clean === 'sniper') return 'kraber';

        return null;
    },

    normalizeMode: (rawMode) => {
        if (!rawMode) return "Battle Royale";
        const cleanMode = rawMode.replace(/^#/, "");

        if (window.GAME_MODE_MAP?.[cleanMode]) return window.GAME_MODE_MAP[cleanMode];

        const m = cleanMode.toUpperCase();
        if (m.includes('RANKED'))                          return "Ranked";
        if (m.includes('TRIO'))                            return "Trio";
        if (m.includes('DUO'))                             return "Duo";
        if (m.includes('DEATHMATCH') || m.includes('TDM')) return "Team Deathmatch";
        if (m.includes('CONTROL'))                         return "Control";
        if (m.includes('GUN'))                             return "Gun Run";
        if (m.includes('BOT'))                             return "Bot Royale";
        if (m.includes('FIRING'))                          return "Firing Range";
        if (m.includes('QUADS'))                           return "Quads";
        return "Battle Royale";
    },

    UNKNOWN_MODE_FALLBACK: "BR",

    isMissingGameMode: (mode) => {
        const normalized = String(mode ?? "").trim().toLowerCase();
        return !normalized || normalized === "unknown";
    },

    hasModeFallbackEvidence: (match) => {
        if (!match) return false;

        const hasMap = !!match.map && match.map !== "Unknown";
        const hasTeammates = Array.isArray(match.teamStats)
            && match.teamStats.some((tm) => tm?.name && tm.name !== "Unknown");

        const durationMs = Math.max(0, (match.endTime || Date.now()) - (match.startTime || 0));
        const hasActivity =
            durationMs >= 60000
            || (match.path?.length || 0) > 5
            || (match.events?.length || 0) > 0
            || (match.kills || 0) > 0
            || (match.damage || 0) > 0
            || !!(match.loadout?.primary || match.loadout?.secondary);

        return hasMap && hasTeammates && hasActivity;
    },

    applyMissingModeFallback: (match) => {
        if (!match || !Utils.isMissingGameMode(match.mode)) return match?.mode;
        if (!Utils.hasModeFallbackEvidence(match)) return match.mode;

        match.mode = Utils.UNKNOWN_MODE_FALLBACK;
        console.warn("[Match] Applied missing GEP game mode fallback: BR", {
            matchId: match.matchId,
            map: match.map,
            teammates: match.teamStats?.length || 0,
        });
        return match.mode;
    },

    hasRealMatchEvidence: (match) => {
        if (!match) return false;

        if ((match.kills || 0) > 0 || (match.damage || 0) > 0) return true;
        if ((match.path?.length || 0) > 5) return true;
        if ((match.weaponTimeline?.length || 0) > 0) return true;
        if ((match.events?.length || 0) > 0) return true;
        if (match.isDead || match._squadEliminated) return true;

        const hasKnownWeapon = (weapon) =>
            !!weapon && weapon !== "unknown" && weapon !== "Unknown";
        if (hasKnownWeapon(match.loadout?.primary) || hasKnownWeapon(match.loadout?.secondary)) {
            return true;
        }

        const hasMap = !!match.map && match.map !== "Unknown";
        const hasTeammates = Array.isArray(match.teamStats)
            && match.teamStats.some((tm) => tm?.name && tm.name !== "Unknown");
        const durationMs = Math.max(0, (match.endTime || Date.now()) - (match.startTime || 0));

        return hasMap && hasTeammates && durationMs >= 60000;
    },

    getMatchEvidenceSummary: (match) => ({
        kills: match?.kills || 0,
        damage: match?.damage || 0,
        pathPoints: match?.path?.length || 0,
        weaponChanges: match?.weaponTimeline?.length || 0,
        events: match?.events?.length || 0,
        isDead: !!match?.isDead,
        squadEliminated: !!match?._squadEliminated,
        map: match?.map,
        teammates: match?.teamStats?.length || 0,
        durationMs: match?.startTime
            ? Math.max(0, (match.endTime || Date.now()) - match.startTime)
            : 0,
    }),

    inferLegendFromAction: (actionName) => {
        if (!actionName) return null;
        return window.ACTION_TO_LEGEND?.[actionName] ?? null;
    },

    checkPrestigeUp: (oldLevel, newLevel) => (oldLevel > 450 && newLevel < 100),

    getRankRoman: (div) => ["", "I", "II", "III", "IV"][div] || "",

    /** Strip division suffix (IV → I order) from rank tier names. */
    stripRankRomanSuffix: (rankName) => {
        if (!rankName) return "";
        return String(rankName).trim().replace(/\s+(IV|III|II|I)$/i, "").trim();
    },

    stripAllRankRomanSuffixes: (rankName) => {
        let result = String(rankName ?? "").trim();
        let prev = "";
        while (prev !== result) {
            prev = result;
            result = Utils.stripRankRomanSuffix(result);
        }
        return result;
    },

    /**
     * Build a single "Tier Division" label. ALS/API may already include the roman
     * numeral while rankDiv is still set — appending blindly causes "Diamond II II".
     */
    formatFullRankName: (rankName, rankDiv) => {
        const trimmed = String(rankName ?? "Unranked").trim() || "Unranked";
        if (["Unranked", "Master", "Apex Predator", "-", "Waiting..."].includes(trimmed)) {
            return trimmed;
        }

        const roman = Utils.getRankRoman(rankDiv);
        if (!roman) {
            return trimmed.replace(/\s+(IV|III|II|I)(\s+\1)+$/i, " $1");
        }

        const base = Utils.stripAllRankRomanSuffixes(trimmed);
        if (["Master", "Apex Predator"].includes(base)) return base;
        return `${base} ${roman}`;
    },

    /** Lowest tabs.teams / TEAMS_ALIVE seen this match (may exceed 20 from GEP). */
    trackMinTeamsAlive: (match, teamsRaw) => {
        const teams = parseInt(teamsRaw, 10);
        if (!match || isNaN(teams) || teams <= 0) return null;
        match._lastTeamsAlive = teams;
        if (match._guessedRank == null || teams < match._guessedRank) {
            match._guessedRank = teams;
        }
        return teams;
    },

    /** tabs.teams minimum first; otherwise last alive teams + 1. */
    estimatePlacementFromTeamsAlive: (match, teamsAlive = match?._lastTeamsAlive) => {
        const minTeams = parseInt(match?._guessedRank, 10);
        if (!isNaN(minTeams) && minTeams > 0) return minTeams;
        const teams = parseInt(teamsAlive, 10);
        if (!isNaN(teams) && teams > 0) return teams + 1;
        return null;
    },

    isUsableWeaponId: (weapon) =>
        Boolean(weapon) && weapon !== 'unknown' && weapon !== 'none' && weapon !== 'Unknown',

    _isSamePlayerName: (name1, name2) => {
        if (!name1 || !name2) return false;
        const clean1 = String(name1).replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
        const clean2 = String(name2).replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
        return clean1 === clean2;
    },

    loadoutAtTimestamp: (match, timestamp) => {
        const timeline = Array.isArray(match?.weaponTimeline)
            ? [...match.weaponTimeline].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
            : [];
        if (timeline.length === 0) {
            return {
                primary: Utils.isUsableWeaponId(match?.loadout?.primary) ? match.loadout.primary : null,
                secondary: Utils.isUsableWeaponId(match?.loadout?.secondary) ? match.loadout.secondary : null,
            };
        }
        let primary = null;
        let secondary = null;
        for (const entry of timeline) {
            if ((entry.timestamp || 0) > timestamp) break;
            if (entry.primary !== undefined) {
                primary = Utils.isUsableWeaponId(entry.primary) ? entry.primary : null;
            }
            if (entry.secondary !== undefined) {
                secondary = Utils.isUsableWeaponId(entry.secondary) ? entry.secondary : null;
            }
        }
        return { primary, secondary };
    },

    /** Full per-match weapon combat summary (hold/kills/deaths/qualify). */
    computeMatchWeaponCombat: (match) => {
        const map = {};
        if (!match) return map;
        const ensure = (weapon) => {
            if (!map[weapon]) map[weapon] = { holdMs: 0, kills: 0, deaths: 0, assists: 0, qualify: false };
            return map[weapon];
        };
        const addHold = (weapon, ms) => {
            if (!Utils.isUsableWeaponId(weapon) || !(ms > 0)) return;
            ensure(weapon).holdMs += ms;
        };

        const start = Number(match.startTime) || 0;
        const end = Number(match.endTime) || start;
        const timeline = Array.isArray(match.weaponTimeline)
            ? [...match.weaponTimeline].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
            : [];

        if (start && end > start) {
            if (timeline.length === 0) {
                addHold(match.loadout?.primary, end - start);
                addHold(match.loadout?.secondary, end - start);
            } else {
                let primary = null;
                let secondary = null;
                let cursor = start;
                for (const entry of timeline) {
                    const t = Math.min(end, Math.max(start, entry.timestamp || start));
                    if (t > cursor) {
                        addHold(primary, t - cursor);
                        addHold(secondary, t - cursor);
                    }
                    if (entry.primary !== undefined) {
                        primary = Utils.isUsableWeaponId(entry.primary) ? entry.primary : null;
                    }
                    if (entry.secondary !== undefined) {
                        secondary = Utils.isUsableWeaponId(entry.secondary) ? entry.secondary : null;
                    }
                    cursor = Math.max(cursor, t);
                }
                if (end > cursor) {
                    const fp = Utils.isUsableWeaponId(match.loadout?.primary) ? match.loadout.primary : primary;
                    const fs = Utils.isUsableWeaponId(match.loadout?.secondary) ? match.loadout.secondary : secondary;
                    addHold(fp, end - cursor);
                    addHold(fs, end - cursor);
                }
            }
        }

        const finalPrimary = Utils.isUsableWeaponId(match.loadout?.primary) ? match.loadout.primary : null;
        const finalSecondary = Utils.isUsableWeaponId(match.loadout?.secondary) ? match.loadout.secondary : null;
        const finalSet = new Set();
        if (finalPrimary) { finalSet.add(finalPrimary); ensure(finalPrimary).qualify = true; }
        if (finalSecondary) { finalSet.add(finalSecondary); ensure(finalSecondary).qualify = true; }

        const playerName = match.playerName || '';
        const events = Array.isArray(match.events) ? match.events : [];
        for (const event of events) {
            if (!event) continue;
            const type = String(event.type || '').toLowerCase();
            const ts = Number(event.timestamp) || 0;

            if (type === 'kill' && Utils.isUsableWeaponId(event.weapon)) {
                if (!playerName || Utils._isSamePlayerName(event.attacker, playerName)) {
                    ensure(event.weapon).kills += 1;
                    ensure(event.weapon).qualify = true;
                }
            }
            if (type === 'assist' && Utils.isUsableWeaponId(event.weapon)) {
                if (!playerName || Utils._isSamePlayerName(event.attacker, playerName)) {
                    ensure(event.weapon).assists += 1;
                }
            }

            const isMyCombat = (type === 'kill' || type === 'knockdown')
                && (!playerName || Utils._isSamePlayerName(event.attacker, playerName));
            const isDamageTick = type === 'damage';
            if ((isMyCombat || isDamageTick) && ts) {
                const slots = Utils.loadoutAtTimestamp(match, ts);
                if (Utils.isUsableWeaponId(slots.primary)) ensure(slots.primary).qualify = true;
                if (Utils.isUsableWeaponId(slots.secondary)) ensure(slots.secondary).qualify = true;
            }

            if (type === 'death' && ts && playerName && Utils._isSamePlayerName(event.victim, playerName)) {
                const slots = Utils.loadoutAtTimestamp(match, ts);
                if (Utils.isUsableWeaponId(slots.primary)) ensure(slots.primary).deaths += 1;
                if (Utils.isUsableWeaponId(slots.secondary)) ensure(slots.secondary).deaths += 1;
            }
        }

        Object.keys(map).forEach((weapon) => {
            const entry = map[weapon];
            if (entry.kills > 0 && !finalSet.has(weapon) && entry.deaths === 0) {
                entry.deaths = 1;
            }
            entry.qualify = Boolean(entry.qualify);
        });

        return map;
    },

    /** Count local-player death events (finisher + inferred squad-elim). */
    countLocalPlayerDeaths: (match) => {
        if (!match) return 0;
        const playerName = match.playerName;
        const events = match.events || [];
        if (!playerName || playerName === 'Unknown') return 0;
        let count = 0;
        for (const event of events) {
            if (String(event?.type || '').toLowerCase() !== 'death') continue;
            if (Utils._isSamePlayerName(event.victim, playerName)) count += 1;
        }
        return count;
    },

    /** Prefer last combat weapon by local player; fallback to current loadout. */
    resolveAssistWeapon: (match) => {
        if (!match) return null;
        const events = match.events || [];
        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i];
            if (!event || !Utils.isUsableWeaponId(event.weapon)) continue;
            const type = String(event.type || '').toLowerCase();
            if (type !== 'kill' && type !== 'knockdown' && type !== 'assist') continue;
            return event.weapon;
        }
        const primary = match.loadout?.primary;
        const secondary = match.loadout?.secondary;
        if (Utils.isUsableWeaponId(primary)) return primary;
        if (Utils.isUsableWeaponId(secondary)) return secondary;
        return null;
    },

    ensureWeaponCombat: (match) => {
        if (!match.weaponCombat || typeof match.weaponCombat !== 'object') {
            match.weaponCombat = {};
        }
        return match.weaponCombat;
    },

    bumpWeaponCombat: (match, weapon, field) => {
        if (!match || !Utils.isUsableWeaponId(weapon)) return;
        if (field !== 'kills' && field !== 'assists') return;
        const map = Utils.ensureWeaponCombat(match);
        if (!map[weapon]) map[weapon] = { holdMs: 0, kills: 0, deaths: 0, assists: 0, qualify: false };
        map[weapon][field] = (map[weapon][field] || 0) + 1;
        if (field === 'kills') map[weapon].qualify = true;
    },

    /** Ensure assist combat-log rows match match.assists (weapon-attributed). */
    syncAssistCombatLogs: (match) => {
        if (!match) return;
        const target = Math.max(0, parseInt(match.assists, 10) || 0);
        const events = match.events || (match.events = []);
        const logged = events.filter((e) => String(e?.type || '').toLowerCase() === 'assist').length;
        const delta = Math.max(0, target - logged);
        if (delta <= 0) return;

        for (let i = 0; i < delta; i++) {
            const weapon = Utils.resolveAssistWeapon(match);
            events.push({
                type: 'assist',
                attacker: match.playerName || 'Unknown',
                victim: '',
                weapon,
                timestamp: Date.now(),
            });
            Utils.bumpWeaponCombat(match, weapon, 'assists');
        }
    },

    /** Recompute SSOT weaponCombat at finalize. */
    syncWeaponCombatFromEvents: (match) => {
        if (!match) return {};
        Utils.syncAssistCombatLogs(match);
        match.weaponCombat = Utils.computeMatchWeaponCombat(match);
        return match.weaponCombat;
    },
};

window.Utils = Utils;
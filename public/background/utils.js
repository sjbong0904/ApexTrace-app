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
};

window.Utils = Utils;
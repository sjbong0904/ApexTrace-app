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

    inferLegendFromAction: (actionName) => {
        if (!actionName) return null;
        return window.ACTION_TO_LEGEND?.[actionName] ?? null;
    },

    checkPrestigeUp: (oldLevel, newLevel) => (oldLevel > 450 && newLevel < 100),

    getRankRoman: (div) => ["", "I", "II", "III", "IV"][div] || ""
};

window.Utils = Utils;
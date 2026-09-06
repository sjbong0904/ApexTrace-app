// src/background/utils.js
// 1. DEFAULT CONFIGURATION — DB 로드 전 빈 객체로만 초기화
window.GAME_MODE_MAP = window.GAME_MODE_MAP || {};
window.LEGEND_MAP    = window.LEGEND_MAP    || {};
window.BG_MAP_DATA   = window.BG_MAP_DATA   || {};
window.WEAPON_MAP    = window.WEAPON_MAP    || {};
window.SEASONS       = window.SEASONS       || [];

// 2. UTILITY FUNCTIONS
const Utils = {

    /**
     * Match/GEP debug trail. Off by default for store/QA log cleanliness.
     * Enable: window.__APEX_DEBUG_MATCH__ = true (background console).
     * Overwolf file logs stringify objects as "[object Object]" — inline JSON when on.
     */
    matchLog: (message, details) => {
        if (!window.__APEX_DEBUG_MATCH__) return;
        const msg = String(message || '');
        const line = msg.startsWith('[Match]') ? msg : `[Match] ${msg}`;
        if (details == null) {
            console.warn(line);
            return;
        }
        try {
            console.warn(`${line} ${JSON.stringify(details)}`);
        } catch (e) {
            console.warn(line);
        }
    },

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
        if (window.MapService?.resolveMap) {
            const resolved = window.MapService.resolveMap(rawMap, rawMap);
            if (resolved) return resolved;
        }
        // DB에서 로드된 맵 목록 먼저 체크
        if (window.BG_MAP_DATA?.[rawMap]) return rawMap;

        const lower = String(rawMap).toLowerCase();
        if (!lower || lower === 'unknown' || lower === 'none') return "Unknown";
        if (lower.includes('desertlands') || lower.includes('world') || lower.includes('edge')) {
            return "World's Edge";
        }
        if (lower.includes('canyon'))                        return "Kings Canyon";
        if (lower.includes('olympus'))                       return "Olympus";
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

    /** GEP often puts fists / nades in weapon0/1 — not loadout guns. */
    isNonLoadoutWeaponRaw: (rawWeapon) => {
        if (rawWeapon == null || rawWeapon === '') return true;
        const clean = String(rawWeapon).toLowerCase();
        if (clean === 'unknown' || clean === 'none') return true;
        if (clean.includes('melee') || clean.includes('karambit')) return true;
        if (clean.includes('grenade') || clean.includes('ordnance')) return true;
        if (clean.includes('thermite') || clean.includes('arc star') || clean.includes('arcstar')) return true;
        if (clean.includes('phoenix') || clean.includes('bacta') || clean.includes('medkit')) return true;
        if (clean.includes('shield cell') || clean.includes('shield battery')) return true;
        if (clean.includes('ultimate accelerant') || clean.includes('syringe')) return true;
        return false;
    },

    normalizeWeapon: (rawWeapon) => {
        if (!rawWeapon) return null;

        let clean = rawWeapon.toLowerCase()
            .replace('mp_weapon_', '').replace('mp_', '')
            .replace('weapon_', '').replace('auto_', '')
            .replace('_crate', '').replace('_takeover', '');

        // Fists / nades before WEAPON_MAP — map must not revive Melee as a gun id.
        if (Utils.isNonLoadoutWeaponRaw(clean)) return null;

        // DB weapon_map 먼저 체크
        if (window.WEAPON_MAP?.[clean]) return window.WEAPON_MAP[clean];

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

    isFiringRangeMode: (mode) => {
        const normalized = String(mode ?? "").trim().toLowerCase();
        return normalized.includes('firing') || normalized.includes('training');
    },

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
        Utils.matchLog('Applied missing GEP game mode fallback: BR', {
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

    /**
     * Post-elim requeue / tabs-dead sessions: combat log may exist, but GEP never
     * sent tabs/weapons/location/summary → 20th + 0/0/0 + empty loadout/path.
     */
    isHollowStatGhost: (match) => {
        if (!match) return false;
        if (match._matchSummaryRank || match._isVictory || match._estimatedPlacement) return false;

        const placement = Number(match.placement) || 20;
        if (placement !== 20) return false;

        if ((match.kills || 0) > 0 || (match.damage || 0) > 0 || (match.assists || 0) > 0) {
            return false;
        }

        const hasLoadoutWeapon = Utils.isUsableWeaponId(match.loadout?.primary)
            || Utils.isUsableWeaponId(match.loadout?.secondary)
            || (Array.isArray(match.weaponTimeline) && match.weaponTimeline.some((row) =>
                Utils.isUsableWeaponId(row?.primary) || Utils.isUsableWeaponId(row?.secondary)
            ));
        if (hasLoadoutWeapon) return false;

        // 0–1 points = empty path or a leftover death-dot from a prior session.
        if ((match.path?.length || 0) > 1) return false;

        return true;
    },

    /** Local combat rows usable when tabs never moved. */
    countLocalCombatFromEvents: (match) => {
        const out = { kills: 0, assists: 0, knocks: 0 };
        if (!match) return out;
        const playerName = match.playerName;
        const events = Array.isArray(match.events) ? match.events : [];
        for (const event of events) {
            if (!event) continue;
            const type = String(event.type || '').toLowerCase();
            if (type === 'kill') {
                if (!playerName || Utils._isSamePlayerName(event.attacker, playerName)) out.kills += 1;
            } else if (type === 'assist') {
                if (!playerName || Utils._isSamePlayerName(event.attacker, playerName)) out.assists += 1;
            } else if (type === 'knockdown') {
                if (!playerName || Utils._isSamePlayerName(event.attacker, playerName)) out.knocks += 1;
            }
        }
        return out;
    },

    /** When tabs SSOT never arrived, lift kill/assist/knock counts from combat log. */
    backfillTabsFromCombatLog: (match) => {
        if (!match) return false;
        const local = Utils.countLocalCombatFromEvents(match);
        let changed = false;
        if (local.kills > (match.kills || 0)) {
            match.kills = local.kills;
            changed = true;
        }
        if (local.assists > (match.assists || 0)) {
            match.assists = local.assists;
            changed = true;
        }
        if (local.knocks > (match.knocks || 0)) {
            match.knocks = local.knocks;
            changed = true;
        }
        if (changed) {
            Utils.matchLog('Backfilled tabs from combat log', {
                matchId: match.matchId,
                kills: match.kills,
                assists: match.assists,
                knocks: match.knocks,
            });
        }
        return changed;
    },

    /**
     * Recent closed/pending sibling that already captured a finished game with stats.
     * Used so post-elim hollow fragments can be dropped without killing mid-match splits.
     */
    hasCompletedKeeperSibling: (match, maxGapMs = 5 * 60 * 1000) => {
        if (!match) return false;
        const now = Date.now();
        const start = match.startTime || now;

        const isKeeper = (row) => {
            if (!row || row.matchId === match.matchId) return false;
            if (row._discardUpload) return false;
            const closedAt = row.closedAt || row.endTime || 0;
            if (!closedAt) return false;
            if (Math.abs(start - closedAt) > maxGapMs && Math.abs(now - closedAt) > maxGapMs) {
                return false;
            }
            const hadStats = row.hadStats
                || (row.kills || 0) > 0
                || (row.damage || 0) > 0
                || (row.assists || 0) > 0;
            if (!hadStats) return false;
            // Mid-match rotate sibling is NOT a keeper — hollow half may still need backfill.
            return !!(row.completed || row.squadEliminated || row._squadEliminated
                || row._isVictory || row._matchSummaryRank || row._estimatedPlacement);
        };

        const prev = window.MatchBoundary?._lastClosedSession;
        if (isKeeper(prev)) return true;

        const pending = window.MatchUploadQueue?._pending;
        if (pending && typeof pending[Symbol.iterator] === 'function') {
            for (const row of pending) {
                if (isKeeper({
                    ...row,
                    closedAt: row.endTime || row._uploadQueuedAt || 0,
                    completed: !!(row._squadEliminated || row._isVictory
                        || row._matchSummaryRank || row._estimatedPlacement),
                    hadStats: (row.kills || 0) > 0 || (row.damage || 0) > 0 || (row.assists || 0) > 0,
                })) return true;
            }
        }
        return false;
    },

    /**
     * Discard hollow ghosts only when safe:
     *  - no local combat at all, or
     *  - local combat exists but a completed keeper sibling already covers a finished game
     *    (post-elim requeue fragment). Mid-match splits keep the hollow half for backfill.
     */
    shouldDiscardHollowStatGhost: (match) => {
        if (!Utils.isHollowStatGhost(match)) return false;

        const local = Utils.countLocalCombatFromEvents(match);
        const hasLocalCombat = local.kills > 0 || local.assists > 0 || local.knocks > 0;
        if (!hasLocalCombat) return true;

        return Utils.hasCompletedKeeperSibling(match);
    },

    /**
     * GEP tabs stuck at 20 / 0/0/0 with empty loadout, but combat log has local kill/assist.
     * Keep the match, but do not persist fake zeros as real results.
     */
    isIncompleteTabsCombatMismatch: (match) => {
        if (!match) return false;
        if (match._matchSummaryRank || match._isVictory) return false;

        const placement = Number(match.placement);
        if (Number.isFinite(placement) && placement !== 20 && placement !== 0) return false;

        if ((match.kills || 0) > 0 || (match.damage || 0) > 0 || (match.assists || 0) > 0) {
            return false;
        }

        const hasLoadoutWeapon = Utils.isUsableWeaponId(match.loadout?.primary)
            || Utils.isUsableWeaponId(match.loadout?.secondary)
            || (Array.isArray(match.weaponTimeline) && match.weaponTimeline.some((row) =>
                Utils.isUsableWeaponId(row?.primary) || Utils.isUsableWeaponId(row?.secondary)
            ));
        if (hasLoadoutWeapon) return false;

        const local = Utils.countLocalCombatFromEvents(match);
        return local.kills > 0 || local.assists > 0;
    },

    /** Null out untrusted tab stats and flag tabs_combat_mismatch. */
    applyIncompleteTabsCombatMismatch: (match) => {
        if (!match || !Utils.isIncompleteTabsCombatMismatch(match)) return false;

        const local = Utils.countLocalCombatFromEvents(match);
        match.placement = null;
        match.kills = null;
        match.assists = null;
        match.damage = null;
        match.knocks = null;
        Utils.addMissingSignal(match, 'tabs_combat_mismatch');
        delete match._estimatedPlacement;

        Utils.matchLog('Marked incomplete tabs/combat mismatch (null stats)', {
            matchId: match.matchId,
            localKills: local.kills,
            localAssists: local.assists,
            events: match.events?.length || 0,
        });
        return true;
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

    ensureMissingSignals: (match) => {
        if (!match) return [];
        if (!Array.isArray(match.missingSignals)) match.missingSignals = [];
        return match.missingSignals;
    },

    addMissingSignal: (match, signal) => {
        if (!match || !signal) return;
        const list = Utils.ensureMissingSignals(match);
        if (!list.includes(signal)) list.push(signal);
    },

    /**
     * Persist the GEP gaps that the history badge tooltip shows.
     * Incomplete stats themselves are the null placement/kills/assists/damage
     * written by applyIncompleteTabsCombatMismatch — no separate quality enum.
     */
    finalizeMatchDataQuality: (match) => {
        if (!match) return null;

        const missing = Utils.ensureMissingSignals(match);

        if (missing.includes('tabs_combat_mismatch')) {
            Utils.addMissingSignal(match, 'tabs_combat_mismatch');
            match.missingSignals = [...Utils.ensureMissingSignals(match)];
            delete match.dataQuality;
            delete match.confidence;
            Utils.matchLog('Missing signals', {
                matchId: match.matchId,
                missingSignals: match.missingSignals,
                legend: match.legend,
                placement: match.placement,
            });
            return { missingSignals: match.missingSignals };
        }

        if (!match._hadLocalLegendSelect) {
            Utils.addMissingSignal(match, 'no_legend_select');
        }
        if (!match._hadSquadLegendSelect) {
            Utils.addMissingSignal(match, 'no_squad_legend_select');
        }
        if (!match._gepPseudoMatchId && !match._sawGepPseudo) {
            Utils.addMissingSignal(match, 'pseudo_stale');
        }
        if (match._boundaryInferred) {
            Utils.addMissingSignal(match, 'boundary_inferred');
        }
        if ((match._matchSummaryRank || match._isVictory) && !match._summaryWhileSquadAlive) {
            const idx = missing.indexOf('placement_estimated');
            if (idx >= 0) missing.splice(idx, 1);
        } else if (match._estimatedPlacement || match._summaryWhileSquadAlive) {
            Utils.addMissingSignal(match, 'placement_estimated');
        }
        if (match._missingMatchStart) {
            Utils.addMissingSignal(match, 'no_match_start');
        }

        match.missingSignals = [...Utils.ensureMissingSignals(match)];
        delete match.dataQuality;
        delete match.confidence;

        Utils.matchLog('Missing signals', {
            matchId: match.matchId,
            missingSignals: match.missingSignals,
            hadLocalLegendSelect: !!match._hadLocalLegendSelect,
            hadSquadLegendSelect: !!match._hadSquadLegendSelect,
            boundaryInferred: !!match._boundaryInferred,
            legend: match.legend,
            placement: match.placement,
        });

        return { missingSignals: match.missingSignals };
    },

    isUnknownLegend: (legend) => {
        const normalized = String(legend ?? '').trim().toLowerCase();
        return !normalized || normalized === 'unknown';
    },

    /**
     * GEP often skips local legendSelect when the player keeps the same legend.
     * Fill from the previous closed session (or newest history card) only inside
     * LEGEND_PREV_MATCH_MAX_GAP_MS — never live ALS / profile.
     */
    applyLegendFromPreviousMatch: (match) => {
        // Only runs when local select is missing and legend is still Unknown.
        if (!match || match._hadLocalLegendSelect) return false;
        if (!Utils.isUnknownLegend(match.legend)) return false;

        const maxGap = window.MatchBoundary?.LEGEND_PREV_MATCH_MAX_GAP_MS ?? (20 * 60 * 1000);
        const startAt = match.startTime || Date.now();
        let skipReason = 'no_candidate';
        let skipDetail = null;

        const tryCandidate = (legend, closedAt, source) => {
            if (!legend || Utils.isUnknownLegend(legend) || !closedAt) {
                skipReason = !closedAt ? 'missing_closed_at' : 'candidate_unknown_legend';
                skipDetail = { source, legend: legend || null, closedAt: closedAt || 0 };
                return false;
            }
            const gap = startAt - closedAt;
            if (gap < 0 || gap > maxGap) {
                skipReason = gap < 0 ? 'gap_negative' : 'gap_exceeded';
                skipDetail = { source, legend, gapMs: gap, maxGapMs: maxGap };
                return false;
            }
            match.legend = legend;
            match._legendFromPrevMatch = true;
            Utils.addMissingSignal(match, 'legend_from_prev_match');
            Utils.matchLog('Legend filled from previous match', {
                matchId: match.matchId,
                legend,
                source,
                gapMs: gap,
                maxGapMs: maxGap,
            });
            return true;
        };

        const prev = window.MatchBoundary?._lastClosedSession;
        if (prev && prev.matchId !== match.matchId
            && tryCandidate(prev.legend, prev.closedAt, 'last_closed_session')) {
            return true;
        }

        const history = window.Store?.history;
        if (Array.isArray(history)) {
            for (const row of history) {
                if (!row || row.matchId === match.matchId) continue;
                const closedAt = row.endTime || row.end_time || 0;
                const legend = row.legend;
                if (tryCandidate(legend, closedAt, 'history')) return true;
                break; // newest card only
            }
        }

        Utils.matchLog('Legend prev-match skip', {
            matchId: match.matchId,
            reason: skipReason,
            maxGapMs: maxGap,
            ...(skipDetail || {}),
            hadClosedSession: !!prev,
            closedLegend: prev?.legend || null,
        });
        return false;
    },

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

    /**
     * An *estimated* placement can never be a win: rank 1 only comes from GEP
     * victory / match_summary. teams-alive == 1 while our squad is out means
     * "someone else won", so any estimate is clamped to 2nd or worse.
     */
    MIN_ESTIMATED_PLACEMENT: 2,

    /**
     * True for the pre-drop tabs sample GEP emits right after match_start
     * (`{"teams":"1"|"0","players":"?"}`). It is lobby garbage, not a live count,
     * and must never seed the teams-alive minimum (2026-09-05 false-1st bug).
     */
    isPlaceholderTabsSample: (tabs) => {
        if (!tabs || typeof tabs !== 'object') return false;
        const players = tabs.players;
        if (players === '?' || players === null) return true;
        const teams = parseInt(tabs.teams, 10);
        return !isNaN(teams) && teams < Utils.MIN_ESTIMATED_PLACEMENT;
    },

    /**
     * Lowest tabs.teams / TEAMS_ALIVE seen this match (may exceed 20 from GEP).
     * Samples below MIN_ESTIMATED_PLACEMENT are ignored: a live BR count never
     * drops to 1 while we still need an estimate (that is a victory, handled elsewhere).
     */
    trackMinTeamsAlive: (match, teamsRaw) => {
        const teams = parseInt(teamsRaw, 10);
        if (!match || isNaN(teams) || teams < Utils.MIN_ESTIMATED_PLACEMENT) return null;
        match._lastTeamsAlive = teams;
        // Keep min-teams separate from placement/_guessedRank (summary rank).
        if (match._minTeamsAlive == null || teams < match._minTeamsAlive) {
            match._minTeamsAlive = teams;
        }
        return teams;
    },

    /** tabs.teams minimum first; otherwise last alive teams + 1. Never below 2nd. */
    estimatePlacementFromTeamsAlive: (match, teamsAlive = match?._lastTeamsAlive) => {
        const floor = Utils.MIN_ESTIMATED_PLACEMENT;
        const minTeams = parseInt(match?._minTeamsAlive, 10);
        if (!isNaN(minTeams) && minTeams > 0) return Math.max(floor, minTeams);
        const teams = parseInt(teamsAlive, 10);
        if (!isNaN(teams) && teams > 0) return Math.max(floor, teams + 1);
        return null;
    },

    /** Any known teammate whose last state is not death. */
    hasLivingTeammate: (match) => {
        const teammates = match?.teamStats || [];
        return teammates.some((t) => t?.state && t.state !== 'death');
    },

    /**
     * Squad-out inferred from local death only (no GEP elimination signal).
     * Empty roster ⇒ true (solo / roster never captured) but stays *provisional*.
     */
    isSquadOutInferred: (match) => {
        if (!match?.isDead) return false;
        const teammates = match.teamStats || [];
        if (teammates.length === 0) return true;
        return !Utils.hasLivingTeammate(match);
    },

    /**
     * Placement estimate from tabs.teams (QA §5.2 이슈 A).
     *
     * Local death ≠ squad elimination. The estimate is:
     *  - never applied while a known teammate is still alive,
     *  - *provisional* while squad-out is only inferred (local dead, roster empty) —
     *    it keeps following tabs.teams minimum down as teammates keep playing,
     *  - *frozen* once `_squadEliminated` (GEP signal) or when every known teammate
     *    is dead — spectating lowers tabs.teams further and must not improve the rank.
     * Summary / victory always win and are handled by the callers.
     */
    applyPlacementEstimate: (match, teamsAlive) => {
        if (!match || match._isVictory || match._matchSummaryRank) return null;

        // Non-estimated placement (e.g. PLACEMENT event) is authoritative.
        if (match.placement > 0 && match.placement < 20 && !match._estimatedPlacement) {
            return match.placement;
        }

        const confirmed = !!match._squadEliminated;

        if (match._placementEstimateFrozen) {
            // Roster looked all-dead but a teammate is alive again (late/stale state) — back to provisional.
            if (!confirmed && Utils.hasLivingTeammate(match)) {
                delete match._placementEstimateFrozen;
            } else {
                return match._estimatedPlacement || null;
            }
        }

        if (!confirmed && !Utils.isSquadOutInferred(match)) return match._estimatedPlacement || null;

        const teammates = match.teamStats || [];
        const rosterAllDead = teammates.length > 0 && !Utils.hasLivingTeammate(match);
        const freeze = confirmed || rosterAllDead;

        const estimate = Utils.estimatePlacementFromTeamsAlive(match, teamsAlive);
        const previous = match._estimatedPlacement || null;
        const next = estimate
            ? (previous ? Math.min(previous, estimate) : estimate)
            : previous;

        if (next) {
            if (previous && next !== previous) {
                Utils.matchLog('Placement estimate refreshed (squad still active)', {
                    matchId: match.matchId,
                    previous,
                    next,
                    confirmed,
                });
            }
            match.placement = next;
            match._estimatedPlacement = next;
        }
        if (freeze) match._placementEstimateFrozen = true;
        return next;
    },

    isUsableWeaponId: (weapon) => {
        if (weapon == null) return false;
        const s = String(weapon).trim();
        if (!s) return false;
        const lower = s.toLowerCase();
        if (lower === 'unknown' || lower === 'none' || lower === 'melee') return false;
        if (lower.includes('melee') || lower.includes('karambit')) return false;
        return true;
    },

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

    /** Window for pairing tabs.assists with nearby squad elim victims from kill_feed. */
    ASSIST_VICTIM_MS: 45000,

    _normCombatName: (name) =>
        name ? String(name).replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase() : '',

    _isBlankCombatName: (name) => {
        if (!name || !String(name).trim()) return true;
        return String(name).trim().toLowerCase() === 'unknown';
    },

    _usedAssistVictimKeys: (match) => {
        const used = new Set();
        const playerName = match?.playerName || '';
        for (const event of match?.events || []) {
            const type = String(event?.type || '').toLowerCase();
            if (type !== 'assist' && type !== 'kill') continue;
            if (type === 'kill' && playerName && event.attacker
                && !Utils._isSamePlayerName(event.attacker, playerName)) {
                continue;
            }
            if (Utils._isBlankCombatName(event?.victim)) continue;
            used.add(Utils._normCombatName(event.victim));
        }
        return used;
    },

    /**
     * GEP assist events are count-only. Queue squad elim victims from kill_feed
     * so assist combat-log rows can estimate the enemy nick.
     */
    noteSquadElimVictim: (match, victim, attacker) => {
        if (!match || Utils._isBlankCombatName(victim)) return;
        const cleanVictim = String(victim).trim();
        const q = Array.isArray(match._assistVictimQueue)
            ? match._assistVictimQueue
            : (match._assistVictimQueue = []);
        const now = Date.now();
        const key = Utils._normCombatName(cleanVictim);
        // Refresh timestamp if the same victim was just eliminated again.
        const existing = q.find((row) => Utils._normCombatName(row.victim) === key);
        if (existing) {
            existing.at = now;
            if (attacker) existing.attacker = attacker;
        } else {
            q.push({ victim: cleanVictim, attacker: attacker || '', at: now });
        }
        match._assistVictimQueue = q.filter((row) => now - (row.at || 0) <= Utils.ASSIST_VICTIM_MS);
        Utils.fillAssistVictims(match);
    },

    /** Pop the newest unused squad-elim victim for an assist row. */
    takeAssistVictim: (match) => {
        if (!match) return '';
        const now = Date.now();
        const q = Array.isArray(match._assistVictimQueue) ? match._assistVictimQueue : [];
        match._assistVictimQueue = q.filter((row) => now - (row.at || 0) <= Utils.ASSIST_VICTIM_MS);
        const used = Utils._usedAssistVictimKeys(match);
        for (let i = match._assistVictimQueue.length - 1; i >= 0; i--) {
            const row = match._assistVictimQueue[i];
            const key = Utils._normCombatName(row.victim);
            if (!key || used.has(key)) {
                match._assistVictimQueue.splice(i, 1);
                continue;
            }
            match._assistVictimQueue.splice(i, 1);
            return row.victim;
        }
        return '';
    },

    /** Backfill empty assist victims after a later squad elim arrives. */
    fillAssistVictims: (match) => {
        if (!match?.events?.length) return 0;
        let filled = 0;
        for (const event of match.events) {
            if (String(event?.type || '').toLowerCase() !== 'assist') continue;
            if (!Utils._isBlankCombatName(event.victim)) continue;
            const victim = Utils.takeAssistVictim(match);
            if (!victim) break;
            event.victim = victim;
            event._victimEstimated = true;
            filled += 1;
        }
        if (filled > 0) {
            Utils.matchLog('Filled assist victims from squad elim queue', {
                matchId: match.matchId,
                filled,
            });
        }
        return filled;
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

        const backfillVictims = [];
        for (let i = 0; i < delta; i++) {
            const weapon = Utils.resolveAssistWeapon(match);
            const victim = Utils.takeAssistVictim(match);
            events.push({
                type: 'assist',
                attacker: match.playerName || 'Unknown',
                victim: victim || '',
                weapon,
                timestamp: Date.now(),
                ...(victim ? { _victimEstimated: true } : {}),
            });
            Utils.bumpWeaponCombat(match, weapon, 'assists');
            backfillVictims.push(victim || '');
        }
        // Assist counter can land before the teammate kill_feed; fill empties later.
        const victimFilled = Utils.fillAssistVictims(match);
        if (delta > 0) {
            Utils.matchLog('Synced assist combat logs from counter', {
                matchId: match.matchId,
                tabsAssists: target,
                loggedBefore: logged,
                backfilled: delta,
                victims: backfillVictims,
                victimFilled,
            });
        }
    },

    /** Victims already named on my kill rows (skip when estimating backfill victims). */
    _usedKillVictimKeys: (match) => {
        const used = new Set();
        const playerName = match?.playerName || '';
        for (const event of match?.events || []) {
            if (String(event?.type || '').toLowerCase() !== 'kill') continue;
            if (playerName && event.attacker && !Utils._isSamePlayerName(event.attacker, playerName)) continue;
            if (Utils._isBlankCombatName(event?.victim)) continue;
            used.add(Utils._normCombatName(event.victim));
        }
        return used;
    },

    /**
     * Prefer pending knocks / my knockdowns that never got a named kill row.
     * Locale-agnostic finish often only bumps tabs.kills — reuse the knock victim.
     */
    takeKillVictim: (match) => {
        if (!match) return '';
        const used = Utils._usedKillVictimKeys(match);
        const playerName = match.playerName || '';

        const pending = Array.isArray(match._pendingKnocks) ? match._pendingKnocks : [];
        for (let i = 0; i < pending.length; i++) {
            const name = pending[i];
            const key = Utils._normCombatName(name);
            if (!key || used.has(key) || Utils._isBlankCombatName(name)) continue;
            pending.splice(i, 1);
            // Drop combat-pair stage too — otherwise kill_feed still promotes a 2nd kill row.
            if (match._combatPairs && typeof match._combatPairs === 'object') {
                delete match._combatPairs[key];
            }
            return String(name).trim();
        }

        // Unmatched knockdown by me (feed logged knock, miss finish).
        for (let i = (match.events || []).length - 1; i >= 0; i--) {
            const event = match.events[i];
            if (String(event?.type || '').toLowerCase() !== 'knockdown') continue;
            if (playerName && event.attacker && !Utils._isSamePlayerName(event.attacker, playerName)) continue;
            if (Utils._isBlankCombatName(event?.victim)) continue;
            const key = Utils._normCombatName(event.victim);
            if (!key || used.has(key)) continue;
            // Only claim if no kill row already names this victim.
            used.add(key);
            return String(event.victim).trim();
        }
        return '';
    },

    /** Fill empty kill victims after a later knock/finish signal arrives. */
    fillKillVictims: (match) => {
        if (!match?.events?.length) return 0;
        const playerName = match.playerName || '';
        let filled = 0;
        for (const event of match.events) {
            if (String(event?.type || '').toLowerCase() !== 'kill') continue;
            if (playerName && event.attacker && !Utils._isSamePlayerName(event.attacker, playerName)) continue;
            if (!Utils._isBlankCombatName(event.victim)) continue;
            const victim = Utils.takeKillVictim(match);
            if (!victim) break;
            event.victim = victim;
            event._victimEstimated = true;
            filled += 1;
        }
        return filled;
    },

    /** Squad-elim death rows often lack attacker — copy from last self-knockdown. */
    fillDeathAttackers: (match) => {
        if (!match?.events?.length) return 0;
        const playerName = match.playerName || '';
        if (Utils._isBlankCombatName(playerName)) return 0;
        let filled = 0;
        const attackers = [];
        for (const event of match.events) {
            if (String(event?.type || '').toLowerCase() !== 'death') continue;
            if (!Utils._isSamePlayerName(event.victim, playerName)) continue;
            if (!Utils._isBlankCombatName(event.attacker)) continue;
            const lastKnock = [...match.events].reverse().find((e) =>
                String(e?.type || '').toLowerCase() === 'knockdown'
                && Utils._isSamePlayerName(e.victim, playerName)
                && !Utils._isBlankCombatName(e.attacker)
            );
            if (!lastKnock) continue;
            event.attacker = lastKnock.attacker;
            if (lastKnock.weapon && !event.weapon) event.weapon = lastKnock.weapon;
            event._attackerEstimated = true;
            filled += 1;
            attackers.push(lastKnock.attacker);
        }
        if (filled > 0) {
            Utils.matchLog('Filled death attackers from self-knockdown', {
                matchId: match.matchId,
                filled,
                attackers,
            });
        }
        return filled;
    },

    /**
     * Kill count SSOT is tabs/GEP kill counter. When kill_feed missed localized finishes,
     * backfill combat-log kill rows so the log length matches match.kills.
     */
    syncKillCombatLogs: (match) => {
        if (!match) return 0;
        const target = Math.max(0, parseInt(match.kills, 10) || 0);
        const events = match.events || (match.events = []);
        const playerName = match.playerName || 'Unknown';
        const logged = events.filter((e) => {
            if (String(e?.type || '').toLowerCase() !== 'kill') return false;
            if (!e.attacker || e.attacker === 'Unknown') return true;
            return Utils._isSamePlayerName(e.attacker, playerName);
        }).length;
        const delta = Math.max(0, target - logged);

        const backfillVictims = [];
        for (let i = 0; i < delta; i++) {
            const weapon = Utils.resolveAssistWeapon(match);
            const victim = Utils.takeKillVictim(match);
            events.push({
                type: 'kill',
                attacker: playerName,
                victim: victim || '',
                weapon,
                timestamp: Date.now(),
                desc: 'restored from tabs',
                _backfill: true,
                ...(victim ? { _victimEstimated: true } : {}),
            });
            Utils.bumpWeaponCombat(match, weapon, 'kills');
            backfillVictims.push(victim || '');
        }
        const victimFilled = Utils.fillKillVictims(match);
        if (delta > 0 || victimFilled > 0) {
            Utils.matchLog('Synced kill combat logs from tabs', {
                matchId: match.matchId,
                tabsKills: target,
                loggedBefore: logged,
                backfilled: delta,
                victims: backfillVictims,
                victimFilled,
            });
        }
        return delta;
    },

    /** Recompute SSOT weaponCombat at finalize. */
    syncWeaponCombatFromEvents: (match) => {
        if (!match) return {};
        Utils.syncKillCombatLogs(match);
        Utils.syncAssistCombatLogs(match);
        Utils.fillDeathAttackers(match);
        match.weaponCombat = Utils.computeMatchWeaponCombat(match);
        return match.weaponCombat;
    },
};

window.Utils = Utils;
window.matchLog = Utils.matchLog;
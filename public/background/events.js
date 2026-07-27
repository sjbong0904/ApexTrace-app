// src/background/events.js
let lastMatchEndTime = 0;
let lastBoundaryRotateAt = 0;

/**
 * Match boundaries — assumed healthy GEP contract, layered:
 *
 *  1차 (primary): match_start / match_end
 *  2차 (backup):  pseudo_match_id assign/clear/rotate,
 *                 full squad legendSelect_* fill + clear-to-null
 *  3차:           legend_selection phase / stats_reset / orphan timer
 *
 * Ideal GEP also emits per-match squad legendSelect and a new pseudo id;
 * start/end may still flake, so 2차가 메꾼다.
 */
const MatchBoundary = {
    _rotateDebounceTimer: null,
    _rotateGeneration: 0,
    _orphanFinalizeTimer: null,
    _orphanFinalizeGeneration: 0,
    _rotateInFlight: false,
    _endDebounceTimer: null,
    /** match_end 1차 종료용 delayed finalize (rotate/start가 반드시 취소) */
    _matchEndTimer: null,
    _matchEndGeneration: 0,
    /** slot index → last non-null payload (or null after clear) */
    _selectSlots: Object.create(null),
    _hadSelectPayload: false,
    _lastPseudoId: null,
    ORPHAN_CHECK_MS: 120000,

    cancelPending() {
        if (this._rotateDebounceTimer) {
            clearTimeout(this._rotateDebounceTimer);
            this._rotateDebounceTimer = null;
        }
        if (this._endDebounceTimer) {
            clearTimeout(this._endDebounceTimer);
            this._endDebounceTimer = null;
        }
        this.cancelMatchEndTimer();
        this.cancelOrphanFinalize();
    },

    cancelMatchEndTimer() {
        if (this._matchEndTimer) {
            clearTimeout(this._matchEndTimer);
            this._matchEndTimer = null;
        }
        this._matchEndGeneration += 1;
    },

    cancelOrphanFinalize() {
        if (this._orphanFinalizeTimer) {
            clearTimeout(this._orphanFinalizeTimer);
            this._orphanFinalizeTimer = null;
        }
        this._orphanFinalizeGeneration += 1;
    },

    _isLocalSelect(payload) {
        return payload?.is_local === true
            || payload?.is_local === 'true'
            || payload?.is_local === 1
            || String(payload?.is_local) === '1';
    },

    _parseSelectRaw(raw) {
        if (raw == null || raw === '' || raw === 'null') return null;
        if (typeof raw === 'object') return raw;
        try {
            const parsed = JSON.parse(raw);
            return parsed == null ? null : parsed;
        } catch (e) {
            return null;
        }
    },

    _filledSelectCount() {
        return Object.values(this._selectSlots).filter((v) => v != null).length;
    },

    _allTrackedSelectsCleared() {
        // Ideal GEP clears the squad trio together on match end.
        const trio = ['0', '1', '2'];
        const hasTrio = trio.every((k) => Object.prototype.hasOwnProperty.call(this._selectSlots, k));
        if (hasTrio) return trio.every((k) => this._selectSlots[k] == null);

        const keys = Object.keys(this._selectSlots);
        // Avoid ending on a single-slot flicker before the full clear arrives.
        if (keys.length < 2) return false;
        return keys.every((k) => this._selectSlots[k] == null);
    },

    shouldAllowRotate(match, reason) {
        if (!match || match._ending) return false;

        switch (reason) {
            case 'pseudo_match_id':
            case 'respawn':
            case 'legend_select_local':
                return true;
            case 'legend_selection_phase':
                return isMatchConcluded(match)
                    || isEliminated(match)
                    || !!match._squadEliminated
                    || (Date.now() - match.startTime > 480000);
            case 'match_start_stale':
                return isMatchConcluded(match)
                    || isEliminated(match)
                    || !!match._squadEliminated
                    || (Date.now() - match.startTime > 120000);
            case 'stats_reset':
                return !!match._squadEliminated || (Date.now() - match.startTime > 480000);
            default:
                return false;
        }
    },

    scheduleOrphanFinalize(match, delayMs = MatchBoundary.ORPHAN_CHECK_MS) {
        this.cancelOrphanFinalize();
        const gen = this._orphanFinalizeGeneration;
        const captured = match;

        this._orphanFinalizeTimer = setTimeout(() => {
            if (gen !== this._orphanFinalizeGeneration) return;
            if (!captured || captured._ending) return;
            if (window.Store?.activeMatch !== captured) return;
            // Ideal GEP clears pseudo + legendSelect on end; if those never arrive, orphan-save.
            console.log('[Match] Finalizing orphan session after elimination (no end signal)');
            window.CoreController?.endMatch?.();
        }, delayMs);
    },

    onSquadEliminated(match) {
        this.scheduleOrphanFinalize(match);
    },

    /** End active session without immediately starting the next (null select / null pseudo / match_end). */
    requestEnd(reason) {
        const match = window.Store?.activeMatch;
        if (!match || match._ending) return;

        this.cancelOrphanFinalize();
        // Don't fight an in-flight 1차 match_end finalize for the same session.
        if (this._matchEndTimer) return;

        if (this._endDebounceTimer) clearTimeout(this._endDebounceTimer);

        this._endDebounceTimer = setTimeout(() => {
            this._endDebounceTimer = null;
            const current = window.Store?.activeMatch;
            if (!current || current._ending) return;
            if (this._matchEndTimer) return;
            console.log(`[Match] Ending session (${reason})`);
            lastMatchEndTime = Date.now();
            void window.CoreController?.endMatch?.();
        }, 200);
    },

    requestRotate(match, reason) {
        if (!this.shouldAllowRotate(match, reason)) return;

        this.cancelOrphanFinalize();
        this.cancelMatchEndTimer();
        if (this._endDebounceTimer) {
            clearTimeout(this._endDebounceTimer);
            this._endDebounceTimer = null;
        }

        if (this._rotateDebounceTimer) clearTimeout(this._rotateDebounceTimer);
        const gen = ++this._rotateGeneration;
        const captured = match;

        this._rotateDebounceTimer = setTimeout(() => {
            this._rotateDebounceTimer = null;
            if (gen !== this._rotateGeneration) return;
            this._executeRotate(captured, reason, gen);
        }, 350);
    },

    _executeRotate(triggerMatch, reason, gen) {
        const lifecycle = window.MatchLifecycle;
        const controller = window.CoreController;
        if (!lifecycle?.enqueue || !controller) return;

        // Session handoff only — uploads must not delay the next capture.
        lifecycle.enqueue(async () => {
            if (gen !== this._rotateGeneration) return;

            this._rotateInFlight = true;
            let rotated = false;

            try {
                const current = window.Store?.activeMatch;

                if (current === triggerMatch && !current._ending) {
                    console.log(`[Match] Rotating session (${reason})`);
                    await controller.endMatch();
                    rotated = true;
                } else if (triggerMatch && !triggerMatch._ending) {
                    console.warn(`[Match] Finalizing captured session before rotate (${reason})`);
                    await controller.finalizeMatchSession(triggerMatch);
                    rotated = true;
                }

                if (gen !== this._rotateGeneration) return;
                if (window.Store?.activeMatch) return;

                if (rotated) {
                    lastMatchEndTime = 0;
                    lastBoundaryRotateAt = Date.now();
                    await controller.startMatch();
                }
            } finally {
                this._rotateInFlight = false;
            }
        });
    },

    ensureSessionStarted(reason) {
        if (this._rotateInFlight) return;
        if (this._rotateDebounceTimer) return;
        if (window.Store?.activeMatch) return;
        // 1차 match_end finalize가 아직 대기 중이면 그 세션을 먼저 닫게 둠.
        if (this._matchEndTimer) return;
        if (Date.now() - lastBoundaryRotateAt < 500) return;
        console.log(`[Match] Starting session (${reason})`);
        lastBoundaryRotateAt = Date.now();
        void window.CoreController?.startMatch?.();
    },

    /**
     * 2차: null after a live id ⇒ match over (if match_end flaked).
     * 2차: id A → id B ⇒ new match.
     * 2차: null → id with no session ⇒ start (if match_start flaked).
     */
    handlePseudoMatchId(rawId) {
        const nextId = rawId == null || rawId === '' || rawId === 'null' ? null : String(rawId);
        const match = window.Store?.activeMatch;
        const prevId = match?._gepPseudoMatchId ?? this._lastPseudoId;

        if (nextId === prevId) {
            if (match) match._gepPseudoMatchId = nextId;
            this._lastPseudoId = nextId;
            return;
        }

        if (prevId && !nextId) {
            console.log(`[Match] pseudo_match_id cleared (${String(prevId).slice(0, 8)}…)`);
            if (match && !match._ending) this.requestEnd('pseudo_cleared');
            if (match) match._gepPseudoMatchId = null;
            this._lastPseudoId = null;
            return;
        }

        if (prevId && nextId) {
            console.log(`[Match] pseudo_match_id changed (${String(prevId).slice(0, 8)}… → ${String(nextId).slice(0, 8)}…)`);
            if (match && !match._ending) {
                match._gepPseudoMatchId = nextId;
                this._lastPseudoId = nextId;
                this.requestRotate(match, 'pseudo_match_id');
                return;
            }
        }

        if (!prevId && nextId) {
            this.ensureSessionStarted('pseudo_assigned');
        }

        const active = window.Store?.activeMatch;
        if (active) active._gepPseudoMatchId = nextId;
        this._lastPseudoId = nextId;
    },

    /**
     * 2차: filled local (+ teammates) ⇒ ensure/rotate if start flaked.
     * 2차: all legendSelect_* → null ⇒ end if match_end flaked.
     */
    handleLegendSelectKey(key, rawValue) {
        const slot = String(key).replace(/^legendSelect_/, '');
        const payload = this._parseSelectRaw(rawValue);
        const hadAny = this._hadSelectPayload || this._filledSelectCount() > 0;

        this._selectSlots[slot] = payload;

        if (payload) {
            this._hadSelectPayload = true;
            window.CoreController?.updateMatch?.('ROSTER_INFO', payload);

            const match = window.Store?.activeMatch;
            const isLocal = this._isLocalSelect(payload);

            if (isLocal) {
                if (!match) {
                    this.ensureSessionStarted('legend_select_local');
                } else if (
                    !match._ending
                    && (match._squadEliminated || isEliminated(match) || isMatchConcluded(match))
                ) {
                    // New character-select after previous match concluded → hand off.
                    this.requestRotate(match, 'legend_select_local');
                }
            } else if (!match && this._filledSelectCount() >= 1) {
                // Teammate selects can arrive slightly before local; open session so roster sticks.
                this.ensureSessionStarted('legend_select_squad');
            }
            return;
        }

        // Cleared slot. Ideal end: every tracked slot null after we had payloads.
        if (hadAny && this._allTrackedSelectsCleared()) {
            this._hadSelectPayload = false;
            console.log('[Match] legendSelect_* cleared');
            this.requestEnd('legend_select_cleared');
        }
    },

    handleTabsReset(match, tabs) {
        const kills = parseInt(tabs.kills, 10);
        const damage = parseInt(tabs.damage, 10);
        if (isNaN(kills) && isNaN(damage)) return;

        const prevKills = match._boundaryLastKills;
        const prevDamage = match._boundaryLastDamage;

        if (prevKills != null || prevDamage != null) {
            const killsReset = !isNaN(kills) && !isNaN(prevKills)
                && prevKills >= 2
                && kills <= prevKills - 2;
            const damageReset = !isNaN(damage) && !isNaN(prevDamage)
                && prevDamage >= 200
                && damage < prevDamage * 0.4;

            if (killsReset || damageReset) {
                console.log('[Match] Stats reset detected — splitting merged GEP session');
                this.requestRotate(match, 'stats_reset');
            }
        }

        if (!isNaN(kills)) match._boundaryLastKills = kills;
        if (!isNaN(damage)) match._boundaryLastDamage = damage;
    },
};

const isSamePlayer = (name1, name2) => {
    if (!name1 || !name2) return false;
    const clean1 = name1.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    const clean2 = name2.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    return clean1 === clean2;
};

/** 경기가 완전히 끝난 상태(우승 등). isDead는 부활/관전 중일 수 있어 제외 */
const isMatchConcluded = (match) => !!match?._isVictory;

/** 팀 전멸 등 복구 불가 elimination */
const isEliminated = (match) => {
    if (!match?.isDead) return false;
    const teammates = match.teamStats || [];
    if (teammates.length === 0) return true;
    return !teammates.some(t => t.state && t.state !== 'death');
};

const resolveCombatImpact = (parsed) => {
    const raw = parsed.impact || parsed.action || '';
    const lower = String(raw).toLowerCase();
    if (!raw) return 'unknown';
    if (lower === 'kill' || lower.includes('headshot_kill') || lower.includes('finish')) return 'kill';
    if (lower.includes('knock') || lower === 'down') return 'knockdown';
    return 'unknown';
};

/**
 * Locale-agnostic finish detection: GEP often localizes bleed/ring/melee finishes
 * (e.g. action="출혈") instead of "kill". If we already knocked that victim this match,
 * treat the unknown action as a finish kill.
 */
const ensurePendingKnocks = (match) => {
    if (!Array.isArray(match._pendingKnocks)) match._pendingKnocks = [];
    return match._pendingKnocks;
};

const hasPendingKnock = (match, victim) =>
    ensurePendingKnocks(match).some((name) => isSamePlayer(name, victim));

const addPendingKnock = (match, victim) => {
    if (!victim || hasPendingKnock(match, victim)) return;
    ensurePendingKnocks(match).push(victim);
};

const clearPendingKnock = (match, victim) => {
    const pending = ensurePendingKnocks(match);
    const idx = pending.findIndex((name) => isSamePlayer(name, victim));
    if (idx >= 0) pending.splice(idx, 1);
};

/** GEP kill_feed가 동일 넉다운을 연속 발행하는 경우 방지 (구 knockdown 이벤트 + kill_feed 이중 집계 해소) */
const COMBAT_DEDUPE_MS = 4000;

const isRecentDuplicateCombat = (match, type, attacker, victim) => {
    if (!match?.events?.length || !attacker || !victim) return false;
    const now = Date.now();
    const norm = (s) => String(s).replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    const a = norm(attacker);
    const v = norm(victim);
    return match.events.some((e) => {
        if (e.type !== type || !e.attacker || !e.victim) return false;
        if (norm(e.attacker) !== a || norm(e.victim) !== v) return false;
        return (now - (e.timestamp || 0)) < COMBAT_DEDUPE_MS;
    });
};

const parseTabsPayload = (raw) => {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (e) { return null; }
};

const applyTabsToMatch = (match, tabsRaw) => {
    const tabs = parseTabsPayload(tabsRaw);
    if (!match || !tabs) return;
    if (tabs.teams) {
        const teams = window.Utils?.trackMinTeamsAlive?.(match, tabs.teams);
        if (teams && canEstimatePlacementFromTabs(match) && (match.placement === 20 || match.placement === 0)) {
            const estimate = estimatePlacementFromTabs(match, teams);
            if (estimate) {
                match.placement = estimate;
                match._estimatedPlacement = estimate;
            }
        }
    }
    if (tabs.kills !== undefined) match.kills = Math.max(match.kills || 0, parseInt(tabs.kills) || 0);
    if (tabs.assists !== undefined) match.assists = Math.max(match.assists || 0, parseInt(tabs.assists) || 0);
    if (tabs.damage !== undefined) match.damage = Math.max(match.damage || 0, parseInt(tabs.damage) || 0);
    if (tabs.knockdowns !== undefined) match.knocks = Math.max(match.knocks || 0, parseInt(tabs.knockdowns) || 0);
    const squadKills = parseInt(tabs.squad_kills || tabs.squadKills || 0);
    if (squadKills > (match.squadKills || 0)) match.squadKills = squadKills;
    if (window.Utils?.syncAssistCombatLogs) window.Utils.syncAssistCombatLogs(match);
};

const applyMatchSummaryToMatch = (match, raw) => {
    const summary = parseTabsPayload(raw);
    if (!match || !summary) return false;
    const rank = parseInt(summary.rank, 10);
    if (!isNaN(rank) && rank > 0) {
        match.placement = rank;
        match._guessedRank = rank;
        match._matchSummaryRank = rank;
    }
    const squadKills = parseInt(summary.squadKills || summary.squad_kills, 10);
    if (!isNaN(squadKills)) match.squadKills = Math.max(match.squadKills || 0, squadKills);
    return !!match._matchSummaryRank;
};

/** tabs.teams 최솟값(_guessedRank) 우선; 없으면 전멸 시점 teams alive + 1 */
const canEstimatePlacementFromTabs = (match) => {
    if (!match || match._isVictory || match._matchSummaryRank) return false;
    if (match._squadEliminated) return true;
    return isEliminated(match);
};

const estimatePlacementFromTabs = (match, teamsAlive = match?._lastTeamsAlive) => {
    if (!canEstimatePlacementFromTabs(match)) return null;
    return window.Utils?.estimatePlacementFromTeamsAlive?.(match, teamsAlive) ?? null;
};

const applyPlacementEstimate = (match) => {
    if (!match || match._isVictory || match._matchSummaryRank) return null;
    if (match.placement > 0 && match.placement < 20) return match.placement;

    const estimate = estimatePlacementFromTabs(match);
    if (estimate) {
        match._estimatedPlacement = estimate;
        match.placement = estimate;
        return estimate;
    }

    return null;
};

const parseTeamInfoState = (raw) => {
    const info = parseTabsPayload(raw);
    if (!info?.team_state) return null;
    return String(info.team_state).toLowerCase();
};

const markSquadEliminated = (match, { refreshGep = true } = {}) => {
    if (!match) return;

    if (!match._squadEliminated) {
        match._squadEliminated = true;
        window.CoreController.updateMatch('SET_DEAD', true);
        match.teamStats?.forEach((teammate) => {
            if (teammate.state !== 'death') teammate.state = 'death';
        });
        ensureDeathCombatLogForPlayer(match);
    }

    const estimate = applyPlacementEstimate(match);

    if (refreshGep && window.EventRouter?.estimatePlacementFromGep && !match._matchSummaryRank) {
        window.EventRouter.estimatePlacementFromGep(match);
    } else if (estimate) {
        console.log(`[Match] Estimated placement ${estimate} at squad elimination`);
    }

    MatchBoundary.onSquadEliminated(match);
};

const handleTeamInfoUpdate = (match, raw) => {
    if (parseTeamInfoState(raw) === 'eliminated') {
        markSquadEliminated(match);
    }
};

const applyInfoToMatch = (infoRoot, match) => {
    if (!infoRoot?.info || !match) return;

    const info = infoRoot.info;
    const data = {
        ...info.game_info,
        ...info.match_info,
        ...info.inventory,
        ...info.me,
        ...info.damage
    };

    applyTabsToMatch(match, info.match_info?.tabs || data.tabs);
    applyMatchSummaryToMatch(match, info.match_info?.match_summary || data.match_summary);

    if (data.team_info) handleTeamInfoUpdate(match, data.team_info);

    if (data.victory === 'true' || data.victory === true) {
        match._isVictory = true;
        match.placement = 1;
        match._guessedRank = 1;
    }

    if (match._squadEliminated || isEliminated(match)) {
        applyPlacementEstimate(match);
    }

    if (data.totalDamageDealt !== undefined) {
        const totalDmg = parseFloat(data.totalDamageDealt);
        if (!isNaN(totalDmg)) match.damage = Math.max(match.damage || 0, totalDmg);
    }

    if (data.team_damage_dealt && match.playerName && match.playerName !== 'Unknown') {
        try {
            const rows = typeof data.team_damage_dealt === 'string'
                ? JSON.parse(data.team_damage_dealt)
                : data.team_damage_dealt;
            if (Array.isArray(rows)) {
                const mine = rows.find((row) => isSamePlayer(row.player_name, match.playerName));
                const dealt = parseInt(mine?.damage_dealt, 10);
                if (!isNaN(dealt)) match.damage = Math.max(match.damage || 0, dealt);
            }
        } catch (e) {}
    }

    if (match._rosterCache?.length && window.MatchService?.processRoster) {
        window.MatchService.processRoster(match);
    }

    if (!match.legend || match.legend === 'Unknown' || match.legend === 'unknown') {
        const userLegend = window.Store?.user?.legend;
        if (userLegend) {
            match.legend = window.Utils?.normalizeLegend?.(userLegend) || userLegend;
        }
    }
};

const recordCombatLog = (match, eventPayload, statAction) => {
    const { type, attacker, victim } = eventPayload;
    if (isRecentDuplicateCombat(match, type, attacker, victim)) {
        console.log(`[Combat] Skipped duplicate ${type}: ${attacker} → ${victim}`);
        return false;
    }
    if (statAction === 'KILL') window.CoreController.updateMatch('KILL');
    else if (statAction === 'KNOCKDOWN') window.CoreController.updateMatch('KNOCKDOWN');
    window.CoreController.addEvent({ ...eventPayload, timestamp: Date.now() });
    if (type === 'kill' && window.Utils?.bumpWeaponCombat) {
        window.Utils.bumpWeaponCombat(match, eventPayload.weapon, 'kills');
    }
    return true;
};

/** Knockdown without finisher, or squad wipe — GEP may never emit kill_feed death for the local player. */
const ensureDeathCombatLogForPlayer = (match) => {
    if (!match?.playerName || match.playerName === 'Unknown') return false;
    if (!(match.isDead || match._squadEliminated)) return false;

    const playerName = match.playerName;
    const events = match.events || [];

    const alreadyLogged = events.some(
        (e) => e.type === 'death' && isSamePlayer(e.victim, playerName),
    );
    if (alreadyLogged) return false;

    const lastKnock = [...events].reverse().find(
        (e) => e.type === 'knockdown' && isSamePlayer(e.victim, playerName),
    );

    const logged = recordCombatLog(match, {
        type: 'death',
        attacker: lastKnock?.attacker || '',
        victim: playerName,
        weapon: lastKnock?.weapon || null,
        desc: match._squadEliminated ? 'Squad eliminated' : undefined,
    }, null);

    if (logged) {
        console.log('[Combat] Inferred death after knockdown (no finisher / squad wipe)');
    }
    return logged;
};

// 1. COMBAT LOG HANDLER
const handleCombatEvent = (parsed, activeMatch) => {
    const localRaw = parsed.local_player_name;
    const attackerRaw = parsed.attackerName || parsed.attacker || "Unknown";
    const victimRaw = parsed.victimName || parsed.victim || "Unknown";
    const weaponRaw = parsed.weaponName || parsed.weapon || "Unknown";

    const normalize = (str) => str ? str.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase() : "";
    const myNameNorm = normalize(activeMatch.playerName);
    const localNameNorm = normalize(localRaw);
    const atkNorm = normalize(attackerRaw);
    const vicNorm = normalize(victimRaw);

    if (myNameNorm && localNameNorm && myNameNorm !== localNameNorm) {
        console.warn(`[Spectator Mode] Ignoring combat event for ${localRaw}`);
        return;
    }

    const isMeAttacker = (myNameNorm && atkNorm === myNameNorm) || (localNameNorm && atkNorm === localNameNorm);
    const isMeVictim = (myNameNorm && vicNorm === myNameNorm) || (localNameNorm && vicNorm === localNameNorm);

    if (activeMatch.isDead && (isMeAttacker || isMeVictim)) {
        console.warn("Ignored Spectator/Ghost Combat event (Player is dead)");
        return;
    }

    const victim = window.Utils.cleanName(victimRaw);
    let impactKind = resolveCombatImpact(parsed);
    let promotedFromPending = false;

    // Localized finish (bleed/ring/melee text) with no English "kill" — promote via pending knockdown.
    if (impactKind === 'unknown' && isMeAttacker && victim && hasPendingKnock(activeMatch, victim)) {
        impactKind = 'kill';
        promotedFromPending = true;
        console.log(`[Combat] Promoted localized finish → kill via pending knockdown: ${victim}`);
    }

    if (impactKind === 'unknown') return;

    const isFinalKill = impactKind === 'kill';
    const type = isFinalKill ? 'kill' : 'knockdown';

    if (!isMeAttacker && type === 'kill') {
        if (attackerRaw && attackerRaw !== "Unknown" && attackerRaw.trim() !== "") {
            const isTeammateAttacker = activeMatch.teamStats && activeMatch.teamStats.some(tm =>
                isSamePlayer(tm.name, attackerRaw)
            );

            if (isTeammateAttacker) {
                const cleanAttackerName = window.Utils ? window.Utils.cleanName(attackerRaw) : attackerRaw;
                window.CoreController.updateMatch('TEAMMATE_KILL', cleanAttackerName);
            }
        }
    }

    if (isMeAttacker) {
        // Promoted finishes already counted via tabs/GEP kill counter — log only to avoid double ++.
        const statAction = isFinalKill
            ? (promotedFromPending ? null : 'KILL')
            : 'KNOCKDOWN';
        const logged = recordCombatLog(activeMatch, {
            type,
            attacker: activeMatch.playerName,
            victim,
            weapon: window.Utils.normalizeWeapon(weaponRaw)
        }, statAction);

        if (logged) {
            if (type === 'knockdown') addPendingKnock(activeMatch, victim);
            else if (type === 'kill') clearPendingKnock(activeMatch, victim);
        }
    }

    if (isMeVictim) {
        const logType = type === 'kill' ? 'death' : 'knockdown';
        const attacker = window.Utils.cleanName(attackerRaw);
        const logged = recordCombatLog(activeMatch, {
            type: logType,
            attacker,
            victim: activeMatch.playerName,
            weapon: window.Utils.normalizeWeapon(weaponRaw)
        }, null);
        if (logged && type === 'kill') window.CoreController.updateMatch('SET_DEAD', true);
    }
};


// 2. EVENT ROUTER
const EventRouter = {
    onInfoUpdates: (info) => {
        if (!info) return;

        const raw = JSON.stringify(info.info);
        if (raw.includes('weapon')) {
            console.log('[LOADOUT DEBUG] full info.info:', raw);
        }

        const matchInfoRaw = info.info?.match_info || info.match_info;
        if (matchInfoRaw && typeof matchInfoRaw === 'object' && Object.keys(matchInfoRaw).length > 0) {
            console.log('[MatchInfo DEBUG] full match_info:', JSON.stringify(matchInfoRaw));
        }

        const matchInfoTop = info.info?.match_info || info.match_info;
        if (matchInfoTop?.map_name && window.Store?.game) {
            const earlyMap = window.MapService
                ? window.MapService.resolveMap(matchInfoTop.map_id, matchInfoTop.map_name)
                : matchInfoTop.map_name;
            if (earlyMap) window.Store.game.map = earlyMap;
        }

        if (!info.info) return;

        const data = {
            ...info.info?.game_info,
            ...info.info?.match_info,
            ...info.info?.inventory,
            ...info.info?.me,
            ...info.info?.damage
        };

        let activeMatch = window.Store.activeMatch;

        if (data.phase) {
            const newPhase = data.phase.toLowerCase();
            window.CoreController.updateMatch('PHASE', newPhase);

            if (activeMatch && (newPhase === 'loading' || newPhase === 'lobby')) {
                const duration = Date.now() - activeMatch.startTime;
                if (isEliminated(activeMatch) && !activeMatch._squadEliminated) {
                    markSquadEliminated(activeMatch, { refreshGep: false });
                } else if (
                    (activeMatch.placement === 20 || activeMatch.placement === 0)
                    && (activeMatch._squadEliminated || isEliminated(activeMatch))
                ) {
                    applyPlacementEstimate(activeMatch);
                }
                if (isMatchConcluded(activeMatch) || duration > 120000) {
                    window.CoreController.endMatch();
                }
            }

            if (newPhase === 'legend_selection') {
                const shouldStartNew =
                    !activeMatch
                    || isMatchConcluded(activeMatch)
                    || isEliminated(activeMatch)
                    || !!activeMatch._squadEliminated
                    || (Date.now() - activeMatch.startTime > 480000);

                if (shouldStartNew) {
                    if (activeMatch) {
                        MatchBoundary.requestRotate(activeMatch, 'legend_selection_phase');
                    } else {
                        MatchBoundary.ensureSessionStarted('legend_selection_phase');
                    }
                }
            }
        }

        // pseudo / legendSelect are primary boundaries (even with no activeMatch yet).
        if (data.pseudo_match_id !== undefined) {
            MatchBoundary.handlePseudoMatchId(data.pseudo_match_id);
        }

        Object.keys(data).forEach((key) => {
            if (key.startsWith('legendSelect_')) {
                MatchBoundary.handleLegendSelectKey(key, data[key]);
            }
        });

        activeMatch = window.Store.activeMatch;

        if (data.map_id || data.map_name) {
            const mapName = window.MapService
                ? window.MapService.resolveMap(data.map_id, data.map_name)
                : (data.map_name || data.map_id);

            if (mapName) {
                window.Store.game.map = mapName;
                if (activeMatch && (!activeMatch.map || activeMatch.map === 'Unknown')) {
                    activeMatch.map = mapName;
                }
            }
        }

        if (data.game_mode || data.mode_name) {
            const modeName = window.Utils.normalizeMode(data.game_mode || data.mode_name);
            window.Store.game.mode = modeName;
            if (activeMatch) activeMatch.mode = modeName;
        }

        if (!activeMatch) return;

        if ((data.name || data.player) && activeMatch.playerName === 'Unknown') {
            let captured = data.name;
            if (!captured && data.player) {
                try {
                    captured = JSON.parse(data.player).player_name;
                } catch (e) {}
            }
            if (captured) {
                activeMatch.playerName = window.Utils.cleanName(captured);
                window.CoreController.updateMatch('CHECK_ROSTER_AGAIN', null);
            }
        }

        if (data.tabs) {
            const tabs = parseTabsPayload(data.tabs);
            if (tabs) {
                if (activeMatch) MatchBoundary.handleTabsReset(activeMatch, tabs);
                if (tabs.teams) window.CoreController.updateMatch('TEAMS_ALIVE', tabs.teams);
                window.CoreController.updateMatch('SYNC_STATS', {
                    kills: tabs.kills,
                    assists: tabs.assists,
                    damage: tabs.damage,
                    knockdowns: tabs.knockdowns,
                    squadKills: tabs.squad_kills || tabs.squadKills
                });
            }
        }

        if (data.team_info) {
            handleTeamInfoUpdate(activeMatch, data.team_info);
        }

        if (data.totalDamageDealt !== undefined) {
            window.CoreController.updateMatch('DAMAGE_TOTAL', data.totalDamageDealt);
        }

        if (activeMatch) {
            if (data.match_summary) applyMatchSummaryToMatch(activeMatch, data.match_summary);
            if (data.victory === 'true' || data.victory === true) {
                window.CoreController.updateMatch('VICTORY', true);
            }
        }

        if (data.ultimate_cooldown) {
            window.CoreController.updateMatch('ULTIMATE_COOLDOWN', data.ultimate_cooldown);
        }

        if (!activeMatch.isDead) {
            const weaponsStr = info.info?.me?.weapons;

            if (weaponsStr) {
                try {
                    const w = JSON.parse(weaponsStr);

                    const rawPrimary = w.weapon0 || null;
                    const rawSecondary = w.weapon1 || null;

                    const p = (() => {
                        if (!rawPrimary || rawPrimary.toLowerCase() === 'unknown') {
                            return activeMatch.loadout.primary || null;
                        }
                        return window.Utils.normalizeWeapon(rawPrimary) || activeMatch.loadout.primary || null;
                    })();

                    const s = (() => {
                        if (!rawSecondary || rawSecondary.toLowerCase() === 'unknown') {
                            return activeMatch.loadout.secondary || null;
                        }
                        return window.Utils.normalizeWeapon(rawSecondary) || activeMatch.loadout.secondary || null;
                    })();

                    window.CoreController.updateMatch('LOADOUT', {
                        primary: p,
                        secondary: s
                    });
                } catch (e) {
                    console.error("Loadout parsing error:", e, weaponsStr);
                }
            }
        }

        Object.keys(data).forEach(key => {
            if (key.startsWith('teammate_')) {
                try {
                    const t = JSON.parse(data[key]);
                    if (t.name) {
                        const cleanName = window.Utils ? window.Utils.cleanName(t.name) : t.name;
                        const tmUid = t.origin_id || t.platform_id || t.uid || null;

                        window.CoreController.updateMatch('TEAMMATE', {
                            name: cleanName,
                            uid: tmUid,
                            state: t.state,
                            legend: t.legend || 'unknown'
                        });
                    }
                } catch (e) {}
            }
        });
    },

    onNewEvents: (info) => {
        if (!info || !info.events) return;

        info.events.forEach(event => {
            const { name, data } = event;
            let parsed = {};
            try { parsed = JSON.parse(data); } catch (e) { parsed = data || {}; }

            if (name === 'kill_feed' && !parsed.impact) {
                try {
                    const rawData = typeof data === 'string' ? JSON.parse(data) : data;
                    if (rawData && rawData.impact) parsed.impact = rawData.impact;
                } catch (e) {}
            }

            if (name === 'match_start') {
                // 1차: authoritative start when GEP emits it.
                const now = Date.now();
                if (MatchBoundary._rotateInFlight) return;
                if (MatchBoundary._rotateDebounceTimer) return;
                if (MatchBoundary._matchEndTimer) return;
                if (now - lastBoundaryRotateAt < 3000) return;
                // Only suppress rapid re-start while a session is already live.
                // After end (activeMatch null), allow start even within 15s.
                const activeMatch = window.Store.activeMatch;
                if (activeMatch && now - lastMatchEndTime < 15000) return;

                if (activeMatch) {
                    const isStale = isMatchConcluded(activeMatch)
                        || isEliminated(activeMatch)
                        || !!activeMatch._squadEliminated
                        || (now - activeMatch.startTime > 120000);
                    if (isStale) {
                        MatchBoundary.requestRotate(activeMatch, 'match_start_stale');
                    }
                    return;
                }
                console.log('[Match] match_start — starting session');
                lastBoundaryRotateAt = now;
                window.CoreController.startMatch();
                return;
            }

            if (name === 'match_end') {
                // 1차: authoritative end when GEP emits it.
                const activeMatch = window.Store.activeMatch;

                if (activeMatch && (Date.now() - activeMatch.startTime < 120000)) {
                    const isTeamAlive = activeMatch.teamStats?.some(t => t.state !== 'death');
                    const isReallyOver = activeMatch._isVictory || isEliminated(activeMatch) || !isTeamAlive;
                    if (!isReallyOver) {
                        console.warn('[Match] Ignored early match_end — squad still active');
                        return;
                    }
                }

                const matchToEnd = window.Store.activeMatch;
                if (!matchToEnd) {
                    console.warn('[Match] match_end received with no active session');
                    return;
                }

                console.log('[Match] match_end — scheduling finalize');
                MatchBoundary.cancelOrphanFinalize();
                if (MatchBoundary._endDebounceTimer) {
                    clearTimeout(MatchBoundary._endDebounceTimer);
                    MatchBoundary._endDebounceTimer = null;
                }
                // Cancel any prior match_end timer; keep a single pending finalize.
                MatchBoundary.cancelMatchEndTimer();
                const endGen = MatchBoundary._matchEndGeneration;
                lastMatchEndTime = Date.now();
                MatchBoundary._matchEndTimer = setTimeout(() => {
                    MatchBoundary._matchEndTimer = null;
                    if (endGen !== MatchBoundary._matchEndGeneration) return;
                    if (matchToEnd._ending) return;
                    if (window.Store.activeMatch === matchToEnd) {
                        window.CoreController.endMatch();
                        return;
                    }

                    console.warn('[Match] Active session changed before match_end finalize — saving captured session');
                    window.CoreController.finalizeMatchSession(matchToEnd);
                }, 2000);
                return;
            }

            const activeMatch = window.Store.activeMatch;
            if (!activeMatch) return;

            if (name === 'victory' || (name === 'match_state' && data === 'victory')) {
                window.CoreController.updateMatch('VICTORY', true);
                window.CoreController.updateMatch('PLACEMENT', 1);
            }

            if (name === 'kill') {
                const totalKills = parseInt(data, 10);
                if (!isNaN(totalKills)) {
                    window.CoreController.updateMatch('SYNC_STATS', { kills: totalKills });
                }
            } else if (name === 'assist') {
                const totalAssists = parseInt(data, 10);
                if (!isNaN(totalAssists)) {
                    window.CoreController.updateMatch('SYNC_STATS', { assists: totalAssists });
                }
            } else if (name === 'damage') {
                const amount = parseFloat(parsed.damageAmount || parsed.amount);
                if (!isNaN(amount)) {
                    window.CoreController.updateMatch('DAMAGE', { amount });
                    // Debounced damage markers for weapon-qualify timestamps (hidden from Combat Log UI).
                    const now = Date.now();
                    if (!activeMatch._lastDamageLogAt || now - activeMatch._lastDamageLogAt >= 2000) {
                        activeMatch._lastDamageLogAt = now;
                        window.CoreController.addEvent({
                            type: 'damage',
                            damageAmount: amount,
                            timestamp: now,
                        });
                    }
                }
            } else if (name === 'kill_feed') {
                handleCombatEvent(parsed, activeMatch);
            } else if (name === 'death') {
                window.CoreController.updateMatch('SET_DEAD', true);
            } else if (name === 'your_squad_is_eliminated') {
                markSquadEliminated(activeMatch);
            } else if (name === 'healed_from_ko') {
                window.CoreController.updateMatch('SET_DEAD', false);
                const selfName = activeMatch.playerName && activeMatch.playerName !== 'Unknown'
                    ? activeMatch.playerName : 'Me';
                window.CoreController.addEvent({ type: 'revive', desc: 'Revived', attacker: '', victim: selfName, timestamp: Date.now() });
            } else if (name === 'respawn') {
                if (activeMatch._squadEliminated) {
                    console.log('[Match] Respawn after squad elimination — rotating session');
                    MatchBoundary.requestRotate(activeMatch, 'respawn');
                    return;
                }
                console.log("Respawn Event Detected!");
                window.CoreController.updateMatch('SET_DEAD', false);
                const selfName = activeMatch.playerName && activeMatch.playerName !== 'Unknown'
                    ? activeMatch.playerName : 'Me';
                window.CoreController.addEvent({ type: 'respawn', desc: 'Respawned from Dropship', attacker: '', victim: selfName, timestamp: Date.now() });
            } else if (name === 'match_summary') {
                if (parsed.rank) window.CoreController.updateMatch('PLACEMENT', parsed.rank);
                else applyMatchSummaryToMatch(activeMatch, data);
            }
        });
    },

    applyInfoToMatch,

    ensureDeathCombatLogForPlayer,

    estimatePlacementFromGep: (match) => {
        if (!match) return Promise.resolve(null);
        return window.EventRouter.refreshMatchFromGep(match, { maxAttempts: 1 }).then(() => {
            const est = applyPlacementEstimate(match);
            if (est) console.log(`[Match] Estimated placement ${est} at squad elimination`);
            return est;
        });
    },

    refreshMatchFromGep: (match, options = {}) => {
        const maxAttempts = options.maxAttempts ?? 1;
        const delayMs = options.delayMs ?? 0;

        const pollOnce = () => new Promise((resolve) => {
            if (!match || !overwolf?.games?.events?.getInfo) return resolve(false);
            overwolf.games.events.getInfo((infoRes) => {
                if (infoRes?.status === 'success' && infoRes.res) {
                    applyInfoToMatch(infoRes, match);
                }
                resolve(!!match._matchSummaryRank);
            });
        });

        return (async () => {
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                if (attempt > 0 && delayMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
                const hasSummary = await pollOnce();
                if (hasSummary || (match.placement > 0 && match.placement < 20 && !match._estimatedPlacement)) {
                    break;
                }
            }
            if (!match._matchSummaryRank && (match.placement === 20 || match.placement === 0)) {
                if (canEstimatePlacementFromTabs(match)) {
                    applyPlacementEstimate(match);
                }
            }
        })();
    }
};

window.EventRouter = EventRouter;
window.MatchBoundary = MatchBoundary;

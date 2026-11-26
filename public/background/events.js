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
const matchLog = (message, details) => {
    if (window.Utils?.matchLog) return window.Utils.matchLog(message, details);
};

const gepLog = (message, details) => {
    if (window.Utils?.gepLog) return window.Utils.gepLog(message, details);
};

const locationLog = (message, details) => {
    if (window.Utils?.locationLog) return window.Utils.locationLog(message, details);
};

const logInfoUpdatesDebug = (info) => {
    const split = window.Utils?.splitGepInfoForLog?.(info);
    if (!split) {
        gepLog('onInfoUpdates2', info);
        return;
    }
    if (split.withoutLocation) gepLog('onInfoUpdates2', split.withoutLocation);
    if (split.locationOnly) locationLog('onInfoUpdates2', split.locationOnly);
};

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
    /** Last closed session snapshot — mark inferred/estimated restarts (never merge). */
    _lastClosedSession: null,
    _lastLegendSelectionAt: 0,
    /** Next startMatch should seed boundary_inferred quality flags. */
    _pendingInferredStart: false,
    /** Next startMatch saw a squad legendSelect_* (boundary proof, any of 3 slots). */
    _pendingSquadLegendSelect: false,
    ORPHAN_CHECK_MS: 120000,
    /** Max gap between closed session and a legendSelect-less restart to treat as inferred. */
    BOUNDARY_ARTIFACT_GAP_MS: 75000,
    /** Gap after prior end/elim that suggests ranked requeue vs ~42s respawn. */
    BOUNDARY_INFER_GAP_MS: 90000,
    /**
     * Same-legend requeues often omit local legendSelect. Reuse previous match legend
     * only when this session starts within this gap after the previous close.
     */
    LEGEND_PREV_MATCH_MAX_GAP_MS: 20 * 60 * 1000,
    /** Hold suspicious ends before POST so false-end races can cancel. */
    SUSPICIOUS_END_HOLD_MS: 75000,

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
                // Never rotate mid-match on pseudo churn (respawn / ranked requeue GEP quirks).
                return shouldAcceptMatchBoundaryEnd(match);
            case 'respawn':
            case 'legend_select_local':
                // Local character-select after elim / victory → next lobby.
                return true;
            case 'legend_select_squad':
                // Non-local-only select must not hand off after elim (ghost #20 sessions).
                // Live requeue path uses shouldRotateForLiveLegendSelect instead.
                return false;
            case 'legend_selection_phase':
                return isMatchConcluded(match)
                    || isEliminated(match)
                    || !!match._squadEliminated
                    || (Date.now() - match.startTime > 480000);
            case 'match_start_stale':
                // GEP always re-emits match_start after legend select (and on some respawns).
                // Do NOT use empty teamStats as "over" here — that is normal for:
                //   - solo (0 teammates forever)
                //   - duo (0–1 until teammate select lands)
                //   - trio during select before teammates fill roster
                // Only rotate when the current session is actually finished; the next
                // lobby is otherwise opened by legend_select_* / stats_requeue.
                return isMatchConcluded(match)
                    || !!match._squadEliminated
                    || isEliminated(match);
            case 'stats_reset':
                // Legacy: elim or very long session. Prefer stats_requeue AND-gate below.
                return !!match._squadEliminated || (Date.now() - match.startTime > 480000);
            case 'stats_requeue':
                // Validated in handleTabsReset (phase/revive gate, or hard 0/0/0 reset).
                return true;
            case 'inferred_requeue':
                return !!match._squadEliminated
                    || isEliminated(match)
                    || isMatchConcluded(match)
                    || shouldAcceptMatchBoundaryEnd(match);
            default:
                return false;
        }
    },

    markPendingInferredStart(reason) {
        this._pendingInferredStart = true;
        matchLog(`Next session will be marked estimated (${reason})`);
    },

    consumePendingInferredStart() {
        const pending = !!this._pendingInferredStart;
        this._pendingInferredStart = false;
        return pending;
    },

    markPendingSquadLegendSelect() {
        this._pendingSquadLegendSelect = true;
    },

    consumePendingSquadLegendSelect() {
        const pending = !!this._pendingSquadLegendSelect;
        this._pendingSquadLegendSelect = false;
        return pending;
    },

    /** Boundary evidence: any of legendSelect_0..2 (squad-only GEP keys). */
    markSquadLegendSelect(match) {
        if (!match) return;
        match._hadSquadLegendSelect = true;
    },

    markInferredBoundary(match, reasons = []) {
        if (!match) return;
        match._boundaryInferred = true;
        const list = Array.isArray(reasons) ? reasons : [reasons];
        list.forEach((signal) => {
            if (signal) window.Utils?.addMissingSignal?.(match, signal);
        });
        if (!list.includes('boundary_inferred')) {
            window.Utils?.addMissingSignal?.(match, 'boundary_inferred');
        }
    },

    /** Artifact-like restart: keep as estimated instead of discarding. */
    markInferredBoundaryIfArtifact(match) {
        if (!isBoundaryArtifactSession(match)) return false;
        this.markInferredBoundary(match, ['boundary_inferred', 'no_legend_select']);
        return true;
    },

    /**
     * Ranked requeue / weak GEP start — open a new estimated session when signals agree.
     * Respawn (~42s, squad alive) must not trigger this.
     */
    scoreInferNewMatch(match, signals = {}) {
        if (!match || match._ending) return { ok: false, score: 0, gapMs: 0, blocked: 'no_match' };
        if (!signals.forceAfterElim && !shouldAcceptMatchBoundaryEnd(match) && !match._squadEliminated) {
            return { ok: false, score: 0, gapMs: 0, blocked: 'squad_still_active' };
        }

        let score = 0;
        const gapMs = signals.gapMs != null
            ? signals.gapMs
            : (MatchBoundary._lastClosedSession?.closedAt
                ? Date.now() - MatchBoundary._lastClosedSession.closedAt
                : 0);

        if (gapMs >= MatchBoundary.BOUNDARY_INFER_GAP_MS) score += 2;
        if (signals.tabsReset) score += 2;
        if (signals.mapChanged) score += 2;
        if (signals.squadChanged) score += 2;
        if (signals.legendSelection) score += 1;
        if (signals.afterElimination || match._squadEliminated) score += 1;
        if (signals.noLegendSelect && !match._hadSquadLegendSelect) score += 1;

        return { ok: score >= 3, score, gapMs, blocked: null };
    },

    shouldInferNewMatch(match, signals = {}) {
        return this.scoreInferNewMatch(match, signals).ok;
    },

    maybeInferRotate(match, signals = {}, reason = 'inferred_requeue') {
        const verdict = this.scoreInferNewMatch(match, signals);
        if (!match || !verdict.ok) {
            if (match && (signals.mapChanged || signals.squadChanged || signals.tabsReset)) {
                const skipKey = `${reason}|${verdict.blocked}|${verdict.score}|${!!signals.mapChanged}|${!!signals.squadChanged}`;
                if (this._lastInferSkipKey !== skipKey) {
                    this._lastInferSkipKey = skipKey;
                    matchLog('Infer rotate skipped', {
                        reason,
                        score: verdict.score,
                        need: 3,
                        blocked: verdict.blocked,
                        gapMs: verdict.gapMs,
                        signals,
                    });
                }
            }
            return false;
        }
        this.markPendingInferredStart(reason);
        this.requestRotate(match, reason === 'stats_reset' ? 'stats_reset' : 'inferred_requeue');
        return true;
    },

    /** Ends without victory/elim/summary may be false match_end races — hold upload briefly. */
    markSuspiciousEndIfNeeded(match) {
        if (!match) return false;
        if (match._squadEliminated || match._isVictory || match._matchSummaryRank) return false;
        if (match.placement > 0 && match.placement < 20 && !match._estimatedPlacement) return false;
        match._continuationHold = true;
        match._uploadHoldUntil = Date.now() + MatchBoundary.SUSPICIOUS_END_HOLD_MS;
        matchLog('Suspicious end — holding upload for continuation check', {
            matchId: match.matchId,
            holdMs: MatchBoundary.SUSPICIOUS_END_HOLD_MS,
        });
        return true;
    },

    hasContinuationEvidence(closedMatch) {
        if (!closedMatch) return false;
        const active = window.Store?.activeMatch;
        if (!active || active === closedMatch || active._ending) return false;

        const age = Date.now() - (active.startTime || 0);
        if (age > MatchBoundary.SUSPICIOUS_END_HOLD_MS) return false;

        const prevNames = collectSquadNames(closedMatch);
        if (prevNames.size === 0) return false;
        let overlap = 0;
        for (const n of collectSquadNames(active)) {
            if (prevNames.has(n)) overlap += 1;
        }
        return overlap >= 2;
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
            matchLog('Finalizing orphan session after elimination (no end signal)');
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
            matchLog(`Ending session (${reason})`);
            lastMatchEndTime = Date.now();
            void window.CoreController?.endMatch?.();
        }, 200);
    },

    requestRotate(match, reason) {
        if (!this.shouldAllowRotate(match, reason)) {
            matchLog('Rotate denied', {
                reason,
                matchId: match?.matchId,
                squadEliminated: !!match?._squadEliminated,
                ending: !!match?._ending,
                hadSquadLegendSelect: !!match?._hadSquadLegendSelect,
            });
            return;
        }

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
                    matchLog(`Rotating session (${reason})`);
                    await controller.endMatch();
                    rotated = true;
                } else if (triggerMatch && !triggerMatch._ending) {
                    matchLog(`Finalizing captured session before rotate (${reason})`);
                    await controller.finalizeMatchSession(triggerMatch);
                    rotated = true;
                }

                if (gen !== this._rotateGeneration) return;
                if (window.Store?.activeMatch) return;

                if (rotated) {
                    lastMatchEndTime = 0;
                    lastBoundaryRotateAt = Date.now();
                    if (
                        reason === 'stats_reset'
                        || reason === 'stats_requeue'
                        || reason === 'inferred_requeue'
                    ) {
                        this.markPendingInferredStart(reason);
                    }
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
        matchLog(`Starting session (${reason})`);
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
            if (match && nextId) {
                match._gepPseudoMatchId = nextId;
                match._sawGepPseudo = true;
            }
            this._lastPseudoId = nextId;
            return;
        }

        if (prevId && !nextId) {
            if (match && !match._ending) {
                if (shouldAcceptMatchBoundaryEnd(match)) {
                    this.requestEnd('pseudo_cleared');
                } else {
                    matchLog('Ignored pseudo_cleared — squad still active (likely respawn)');
                }
            }
            if (match) match._gepPseudoMatchId = null;
            this._lastPseudoId = null;
            return;
        }

        if (prevId && nextId) {
            if (match && !match._ending) {
                match._gepPseudoMatchId = nextId;
                match._sawGepPseudo = true;
                this._lastPseudoId = nextId;
                if (shouldAcceptMatchBoundaryEnd(match)) {
                    this.requestRotate(match, 'pseudo_match_id');
                } else {
                    // Prefer one clean session over splitting/merging across respawn.
                    matchLog('Pseudo id changed mid-match — keeping session (no merge/split)');
                }
                return;
            }
        }

        if (!prevId && nextId) {
            const prev = this._lastClosedSession;
            const gap = prev?.closedAt ? Date.now() - prev.closedAt : 0;
            if (
                !window.Store?.activeMatch
                && prev
                && gap >= this.BOUNDARY_INFER_GAP_MS
                && this._lastLegendSelectionAt < (prev.closedAt || 0)
            ) {
                this.markPendingInferredStart('pseudo_assigned_requeue');
            }
            this.ensureSessionStarted('pseudo_assigned');
        }

        const active = window.Store?.activeMatch;
        if (active) {
            active._gepPseudoMatchId = nextId;
            if (nextId) active._sawGepPseudo = true;
        }
        this._lastPseudoId = nextId;
    },

    /**
     * 2차: any filled legendSelect_* ⇒ boundary proof (squad-only, max 3).
     * is_local is only for assigning *our* legend in history — not required for boundary.
     * 2차: all legendSelect_* → null ⇒ end if match_end flaked.
     */
    /**
     * Live session got a new local pick (different legend) and the select-lobby
     * squad does not overlap prior teammates — ranked requeue without match_end.
     * Snapshot BEFORE ROSTER_INFO mutates the active match.
     */
    shouldRotateForLiveLegendSelect(match, payload, isLocal) {
        if (!match || !payload || !isLocal || match._ending) return false;
        if (match._squadEliminated || isEliminated(match) || isMatchConcluded(match)) return false;
        if (!match._hadLocalLegendSelect) return false;
        if (!window.Utils?.hasRealMatchEvidence?.(match)) return false;

        const newLegend = window.Utils.normalizeLegend(
            payload.legendName || payload.legend || payload.characterName
        );
        const oldLegend = match.legend;
        if (window.Utils.isUnknownLegend?.(newLegend) || window.Utils.isUnknownLegend?.(oldLegend)) {
            return false;
        }
        if (String(newLegend).toLowerCase() === String(oldLegend).toLowerCase()) return false;

        const selfName = normalizeBoundaryName(match.playerName)
            || normalizeBoundaryName(payload.playerName);
        const oldTeammates = [...collectSquadNames(match)].filter((n) => n && n !== selfName);

        const newNames = new Set();
        for (const p of Object.values(this._selectSlots)) {
            if (!p?.playerName) continue;
            const n = normalizeBoundaryName(p.playerName);
            if (n) newNames.add(n);
        }
        const newTeammates = [...newNames].filter((n) => n !== selfName);

        // Only local slot filled so far → new lobby starting (overlap treated as 0).
        if (newTeammates.length === 0) return true;

        let overlap = 0;
        for (const n of newTeammates) {
            if (oldTeammates.includes(n)) overlap += 1;
        }
        return overlap === 0;
    },

    handleLegendSelectKey(key, rawValue) {
        const slot = String(key).replace(/^legendSelect_/, '');
        const payload = this._parseSelectRaw(rawValue);
        const hadAny = this._hadSelectPayload || this._filledSelectCount() > 0;

        this._selectSlots[slot] = payload;

        if (payload) {
            this._hadSelectPayload = true;
            const isLocal = this._isLocalSelect(payload);
            const rotateReason = isLocal ? 'legend_select_local' : 'legend_select_squad';
            const legendName = payload.legendName || payload.legend || payload.characterName;
            const pre = window.Store?.activeMatch;

            // Requeue select while prior session still "live" (GEP skipped match_end).
            // Do not ROSTER_INFO onto the old match — that would overwrite its legend.
            if (
                pre
                && !pre._ending
                && this.shouldRotateForLiveLegendSelect(pre, payload, isLocal)
            ) {
                const newLegend = window.Utils?.normalizeLegend?.(legendName) || legendName;
                matchLog('Live legendSelect requeue — splitting session', {
                    matchId: pre.matchId,
                    prevLegend: pre.legend || null,
                    nextLegend: newLegend,
                    slot,
                });
                this.markPendingSquadLegendSelect();
                this.markPendingInferredStart('legend_select_requeue');
                const rosters = Object.values(this._selectSlots).filter(Boolean);
                if (window.Store) {
                    window.Store.preMatchRoster = rosters.slice();
                }
                this.requestRotate(pre, rotateReason);
                return;
            }

            // After local death (or elim/victory): local select hands off to the next lobby.
            // Includes knocked_out-only squads — GEP often skips your_squad_is_eliminated.
            if (
                pre
                && !pre._ending
                && (
                    pre._squadEliminated
                    || isEliminated(pre)
                    || isMatchConcluded(pre)
                    || (isLocal && pre.isDead && !hasLivingTeammate(pre))
                )
            ) {
                if (isLocal) {
                    matchLog('Local legendSelect after match end — rotating session', {
                        matchId: pre.matchId,
                        legend: legendName,
                        slot,
                        squadEliminated: !!pre._squadEliminated,
                        victory: !!pre._isVictory,
                        localDead: !!pre.isDead,
                    });
                    this.markPendingSquadLegendSelect();
                    const rosters = Object.values(this._selectSlots).filter(Boolean);
                    if (window.Store) {
                        window.Store.preMatchRoster = rosters.slice();
                    }
                    this.requestRotate(pre, 'legend_select_local');
                    return;
                }
                matchLog('Ignored non-local legendSelect after match end', {
                    matchId: pre.matchId,
                    slot,
                    playerName: payload.playerName || null,
                    legend: legendName || null,
                    squadEliminated: !!pre._squadEliminated,
                    victory: !!pre._isVictory,
                });
                return;
            }

            // Log before ROSTER_INFO — processRoster also sets _hadLocalLegendSelect.
            if (isLocal && pre && !pre._loggedLocalLegendSelect) {
                pre._loggedLocalLegendSelect = true;
                matchLog('Local legendSelect', {
                    matchId: pre.matchId,
                    legend: legendName,
                    slot,
                });
            }

            window.CoreController?.updateMatch?.('ROSTER_INFO', payload);

            const match = window.Store?.activeMatch;
            if (!match) {
                // One squad select is enough to open a new match boundary.
                this.markPendingSquadLegendSelect();
                this.ensureSessionStarted(rotateReason);
            } else {
                this.markSquadLegendSelect(match);
            }

            const active = window.Store?.activeMatch;
            if (active) {
                this.markSquadLegendSelect(active);
                if (isLocal) {
                    active._hadLocalLegendSelect = true;
                    if (!active._loggedLocalLegendSelect) {
                        active._loggedLocalLegendSelect = true;
                        matchLog('Local legendSelect', {
                            matchId: active.matchId,
                            legend: legendName,
                            slot,
                        });
                    }
                }
            }
            return;
        }

        // Cleared slot. Ideal end: every tracked slot null after we had payloads.
        // Ignore mid-match clears while squad can still respawn the local player.
        if (hadAny && this._allTrackedSelectsCleared()) {
            this._hadSelectPayload = false;
            const match = window.Store?.activeMatch;
            if (match && shouldAcceptMatchBoundaryEnd(match)) {
                this.requestEnd('legend_select_cleared');
            } else if (match) {
                matchLog('Ignored legendSelect clear — squad still active (likely respawn)');
            }
        }
    },

    /**
     * Ranked requeue often keeps one GEP session with no legendSelect/roster.
     * Split when:
     *   A) hard reset — kills+damage+teams all 0 after real combat tabs (ignore revive/phase)
     *   B) soft drop — kills/damage↓ + aircraft/freefly (or landed+teams rebound) + no recent revive
     *   C) elim fallback — squad already ended + stats↓
     */
    handleTabsReset(match, tabs) {
        const kills = parseInt(tabs.kills, 10);
        const damage = parseInt(tabs.damage, 10);
        const teams = parseInt(tabs.teams, 10);
        if (isNaN(kills) && isNaN(damage) && isNaN(teams)) return;

        const prevKills = match._boundaryLastKills;
        const prevDamage = match._boundaryLastDamage;
        const prevTeams = match._boundaryLastTeams;

        const killsDrop = !isNaN(kills) && prevKills != null && !isNaN(prevKills) && kills < prevKills;
        const damageDrop = !isNaN(damage) && prevDamage != null && !isNaN(prevDamage) && damage < prevDamage;
        const statsDecreased = killsDrop || damageDrop;

        // Lobby/requeue wipe: prior combat tabs → absolute zero. GEP often skips match_end.
        const hardZeroReset = !isNaN(kills) && !isNaN(damage) && !isNaN(teams)
            && kills === 0 && damage === 0 && teams === 0
            && (
                (prevKills != null && !isNaN(prevKills) && prevKills > 0)
                || (prevDamage != null && !isNaN(prevDamage) && prevDamage > 0)
            );

        if (hardZeroReset) {
            matchLog('Requeue hard zero tabs — splitting session', {
                phase: String(match._currentPhase || '').toLowerCase(),
                recentRevive: !!match._lastRespawnOrReviveAt
                    && (Date.now() - match._lastRespawnOrReviveAt) < 90000,
                prev: { kills: prevKills, damage: prevDamage, teams: prevTeams },
                next: { kills, damage, teams },
                msSinceRevive: match._lastRespawnOrReviveAt
                    ? Date.now() - match._lastRespawnOrReviveAt
                    : null,
            });
            this.markPendingInferredStart('stats_requeue_hard_zero');
            this.requestRotate(match, 'stats_requeue');
        } else if (statsDecreased) {
            const phase = String(match._currentPhase || '').toLowerCase();
            const teamsRebound = !isNaN(teams) && prevTeams != null && !isNaN(prevTeams)
                && (teams >= 15 || teams >= prevTeams + 8);
            const phaseOk = phase === 'aircraft'
                || phase === 'freefly'
                || (phase === 'landed' && teamsRebound);
            const recentRevive = !!match._lastRespawnOrReviveAt
                && (Date.now() - match._lastRespawnOrReviveAt) < 90000;

            if (phaseOk && !recentRevive) {
                matchLog('Requeue stats drop — splitting estimated session', {
                    phase,
                    killsDrop,
                    damageDrop,
                    teamsRebound,
                    prev: { kills: prevKills, damage: prevDamage, teams: prevTeams },
                    next: { kills, damage, teams },
                });
                this.markPendingInferredStart('stats_requeue');
                this.requestRotate(match, 'stats_requeue');
            } else if (
                (match._squadEliminated || isEliminated(match))
                && !recentRevive
            ) {
                // Fallback when phase/teams signals are weak but squad already ended.
                matchLog('Stats drop after elimination — splitting session', {
                    phase,
                    teamsRebound,
                    recentRevive,
                });
                this.markPendingInferredStart('stats_reset_after_elim');
                this.requestRotate(match, 'stats_reset');
            } else {
                matchLog('Stats drop ignored (requeue gate)', {
                    phase,
                    phaseOk,
                    teamsRebound,
                    recentRevive,
                    killsDrop,
                    damageDrop,
                    prev: { kills: prevKills, damage: prevDamage, teams: prevTeams },
                    next: { kills, damage, teams },
                    msSinceRevive: match._lastRespawnOrReviveAt
                        ? Date.now() - match._lastRespawnOrReviveAt
                        : null,
                });
            }
        }

        if (!isNaN(kills)) match._boundaryLastKills = kills;
        if (!isNaN(damage)) match._boundaryLastDamage = damage;
        if (!isNaN(teams)) match._boundaryLastTeams = teams;
    },

    noteRespawnOrRevive(match, source = 'unknown') {
        if (!match) return;
        match._lastRespawnOrReviveAt = Date.now();
        matchLog('Respawn/revive noted (blocks requeue 90s)', {
            source,
            matchId: match.matchId,
            squadEliminated: !!match._squadEliminated,
        });
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

/** 팀 전멸 등 복구 불가 elimination (knocked_out 포함 — 전원 다운이면 경계로 본다). */
const isEliminated = (match) => {
    if (!match?.isDead) return false;
    if (window.Utils?.isSquadOutInferred) return window.Utils.isSquadOutInferred(match);
    const teammates = match.teamStats || [];
    if (teammates.length === 0) return true;
    return !teammates.some((t) => {
        if (window.Utils?.isTeammateCombatCapable) return window.Utils.isTeammateCombatCapable(t);
        const s = String(t?.state || '').toLowerCase();
        return s && s !== 'death' && s !== 'knocked_out';
    });
};

const hasLivingTeammate = (match) => {
    if (window.Utils?.hasLivingTeammate) return window.Utils.hasLivingTeammate(match);
    const teammates = match?.teamStats || [];
    return teammates.some((t) => {
        if (window.Utils?.isTeammateCombatCapable) return window.Utils.isTeammateCombatCapable(t);
        const s = String(t?.state || '').toLowerCase();
        return s && s !== 'death' && s !== 'knocked_out';
    });
};

/**
 * Trust GEP match_end / pseudo clear / legendSelect clear only when the match
 * is truly over. Mid-match death→respawn often emits the same end signals while
 * teammates are still alive — those must not split the session.
 * Empty teamStats ⇒ accept end (solo / early race; no squad evidence to keep).
 */
const shouldAcceptMatchBoundaryEnd = (match) => {
    if (!match) return true;
    if (isMatchConcluded(match) || match._squadEliminated || isEliminated(match)) return true;
    const teammates = match.teamStats || [];
    if (teammates.length === 0) return true;
    return !hasLivingTeammate(match);
};

const normalizeBoundaryName = (name) => {
    if (!name || name === 'Unknown') return '';
    return String(name).replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
};

const collectSquadNames = (match) => {
    const names = new Set();
    const self = normalizeBoundaryName(match?.playerName);
    if (self) names.add(self);
    (match?.teamStats || []).forEach((tm) => {
        const n = normalizeBoundaryName(tm?.name);
        if (n) names.add(n);
    });
    return names;
};

/** Remember a closed session for inferred-boundary / estimated marking (never merge). */
const rememberClosedSession = (match) => {
    if (!match) return;
    const legend = match.legend && !window.Utils?.isUnknownLegend?.(match.legend)
        ? match.legend
        : null;
    const kills = match.kills || 0;
    const damage = match.damage || 0;
    const assists = match.assists || 0;
    MatchBoundary._lastClosedSession = {
        closedAt: Date.now(),
        startTime: match.startTime || 0,
        matchId: match.matchId,
        /** Boundary proof: any legendSelect_* on the squad. */
        hadSquadLegendSelect: !!match._hadSquadLegendSelect,
        /** Content: we resolved the local player's legend. */
        hadLocalLegendSelect: !!match._hadLocalLegendSelect,
        /** Usable legend for same-pick requeue fallback (not ALS). */
        legend,
        map: match.map || null,
        names: [...collectSquadNames(match)],
        kills,
        damage,
        assists,
        hadStats: kills > 0 || damage > 0 || assists > 0,
        /** Finished game — safe sibling for discarding post-elim hollow ghosts. */
        completed: !!(
            match._squadEliminated
            || match._isVictory
            || match._matchSummaryRank
            || match._estimatedPlacement
        ),
        squadEliminated: !!match._squadEliminated,
    };
    matchLog('Remembered closed session', {
        matchId: match.matchId,
        legend,
        hadLocalLegendSelect: !!match._hadLocalLegendSelect,
        hadSquadLegendSelect: !!match._hadSquadLegendSelect,
        map: match.map || null,
        hadStats: kills > 0 || damage > 0 || assists > 0,
        completed: !!(
            match._squadEliminated
            || match._isVictory
            || match._matchSummaryRank
            || match._estimatedPlacement
        ),
    });
};

/**
 * Respawn/false-end often opens a second session without any squad legendSelect, same squad.
 * Mark as estimated (do not discard) — Unknown legend beats inventing a profile pick.
 */
const isBoundaryArtifactSession = (match) => {
    // Boundary: one squad legendSelect_* is enough to treat this as a real select boundary.
    if (!match || match._hadSquadLegendSelect) return false;
    const prev = MatchBoundary._lastClosedSession;
    if (!prev?.hadSquadLegendSelect || !prev.closedAt) return false;

    const gap = (match.startTime || 0) - prev.closedAt;
    if (gap < 0 || gap > MatchBoundary.BOUNDARY_ARTIFACT_GAP_MS) return false;

    const prevDuration = Math.max(0, prev.closedAt - (prev.startTime || 0));
    if (prevDuration < 120000) return false;

    // A real character select after the previous close ⇒ stronger new-match signal.
    if (MatchBoundary._lastLegendSelectionAt > prev.closedAt) return false;

    const prevNames = new Set(prev.names || []);
    if (prevNames.size === 0) return false;
    let overlap = 0;
    for (const n of collectSquadNames(match)) {
        if (prevNames.has(n)) overlap += 1;
    }
    return overlap >= 2;
};

const squadNamesChangedSignificantly = (match, prevNames) => {
    if (!match || !prevNames?.length) return false;
    const prev = new Set(prevNames);
    const cur = collectSquadNames(match);
    if (cur.size === 0 || prev.size === 0) return false;
    let overlap = 0;
    for (const n of cur) {
        if (prev.has(n)) overlap += 1;
    }
    const union = new Set([...prev, ...cur]).size;
    return overlap <= 1 && union >= 3;
};

const resolveCombatImpact = (parsed) => {
    // Prefer GEP impact when present (locale-independent). action is often localized.
    const impact = String(parsed.impact || '').toLowerCase();
    if (impact === 'kill' || impact.includes('headshot_kill') || impact.includes('finish')) return 'kill';
    if (impact.includes('knock') || impact === 'down') return 'knockdown';

    const raw = parsed.action || '';
    const lower = String(raw).toLowerCase();
    if (!raw) return 'unknown';
    // English / mixed tokens only — do not special-case other languages here.
    if (lower === 'kill' || lower.includes('headshot_kill') || lower.includes('finish')) return 'kill';
    if (lower.includes('knock') || lower === 'down') return 'knockdown';
    return 'unknown';
};

/**
 * Locale-agnostic combat pairing:
 *  - 1st opaque feed (me → victim) ⇒ knockdown
 *  - 2nd opaque feed (me → same victim) or pending knock ⇒ kill
 * Kill *counts* stay on tabs/kill events; feed only builds the combat log.
 */
const COMBAT_PAIR_MS = 120000;
const normalizeCombatName = (str) =>
    str ? String(str).replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase() : '';

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

const ensureCombatPairs = (match) => {
    if (!match._combatPairs || typeof match._combatPairs !== 'object') {
        match._combatPairs = Object.create(null);
    }
    return match._combatPairs;
};

const getCombatPair = (match, victim) => {
    const key = normalizeCombatName(victim);
    if (!key) return null;
    const pair = ensureCombatPairs(match)[key];
    if (!pair) return null;
    if (Date.now() - (pair.at || 0) > COMBAT_PAIR_MS) {
        delete ensureCombatPairs(match)[key];
        return null;
    }
    return pair;
};

const setCombatPair = (match, victim, stage) => {
    const key = normalizeCombatName(victim);
    if (!key) return;
    ensureCombatPairs(match)[key] = { stage, at: Date.now() };
};

const clearCombatPair = (match, victim) => {
    const key = normalizeCombatName(victim);
    if (!key) return;
    delete ensureCombatPairs(match)[key];
};

const hasRecentSelfKnockdown = (match, playerName) => {
    if (!match?.events?.length || !playerName) return false;
    const now = Date.now();
    return match.events.some((e) =>
        e?.type === 'knockdown'
        && isSamePlayer(e.victim, playerName)
        && (now - (e.timestamp || 0)) < COMBAT_PAIR_MS
    );
};

/** Teammate knock→finish pairs (attacker|victim). Keep separate from local _pendingKnocks. */
const ensureSquadCombatPairs = (match) => {
    if (!match._squadCombatPairs || typeof match._squadCombatPairs !== 'object') {
        match._squadCombatPairs = Object.create(null);
    }
    return match._squadCombatPairs;
};

const squadCombatPairKey = (attacker, victim) => {
    const a = normalizeCombatName(attacker);
    const v = normalizeCombatName(victim);
    if (!a || !v) return '';
    return `${a}|${v}`;
};

const getSquadCombatPair = (match, attacker, victim) => {
    const key = squadCombatPairKey(attacker, victim);
    if (!key) return null;
    const pair = ensureSquadCombatPairs(match)[key];
    if (!pair) return null;
    if (Date.now() - (pair.at || 0) > COMBAT_PAIR_MS) {
        delete ensureSquadCombatPairs(match)[key];
        return null;
    }
    return pair;
};

const setSquadCombatPair = (match, attacker, victim, stage) => {
    const key = squadCombatPairKey(attacker, victim);
    if (!key) return;
    ensureSquadCombatPairs(match)[key] = { stage, at: Date.now() };
};

const clearSquadCombatPair = (match, attacker, victim) => {
    const key = squadCombatPairKey(attacker, victim);
    if (!key) return;
    delete ensureSquadCombatPairs(match)[key];
};

const hasPendingSquadKnock = (match, attacker, victim) =>
    getSquadCombatPair(match, attacker, victim)?.stage === 'knocked';

/** Resolve opaque (localized) feed using knock→kill pairing — no language dictionary. */
const resolveLocaleAgnosticImpact = (match, {
    isMeAttacker,
    isMeVictim,
    isTeammateAttacker,
    attacker,
    victim,
    impactKind,
}) => {
    if (impactKind !== 'unknown') return { kind: impactKind, promoted: false };

    if (isMeAttacker && victim) {
        if (hasPendingKnock(match, victim) || getCombatPair(match, victim)?.stage === 'knocked') {
            return { kind: 'kill', promoted: true };
        }
        // First opaque hit on this victim ⇒ knockdown (seeds pair for a later finish).
        return { kind: 'knockdown', promoted: false };
    }

    // Squadmates: promote opaque finish only after an english knockdown seed.
    // Do not invent knockdown from opaque — avoids kill+출혈 double-count after clear.
    if (isTeammateAttacker && attacker && victim) {
        if (hasPendingSquadKnock(match, attacker, victim)) {
            return { kind: 'kill', promoted: true };
        }
        return { kind: 'unknown', promoted: false };
    }

    if (isMeVictim) {
        if (hasRecentSelfKnockdown(match, match.playerName)) {
            return { kind: 'kill', promoted: true };
        }
        return { kind: 'knockdown', promoted: false };
    }

    return { kind: 'unknown', promoted: false };
};

/** GEP kill_feed가 동일 넉다운을 연속 발행하는 경우 방지 (구 knockdown 이벤트 + kill_feed 이중 집계 해소) */
const COMBAT_DEDUPE_MS = 4000;
/** tabs kill backfill ↔ kill_feed finish can be a few seconds apart */
const KILL_MERGE_MS = 8000;

const isBlankCombatVictim = (name) =>
    !name || !String(name).trim() || String(name).trim().toLowerCase() === 'unknown';

/**
 * tabs/kill counter often backfills a kill row (empty or estimated victim) a tick
 * before kill_feed 출혈/finish arrives — merge into that row instead of duplicating.
 */
const findMergeableLocalKill = (match, victim) => {
    if (!match?.events?.length) return null;
    const playerName = match.playerName;
    if (!playerName || playerName === 'Unknown') return null;
    const now = Date.now();
    for (let i = match.events.length - 1; i >= 0; i--) {
        const event = match.events[i];
        if (event?.type !== 'kill') continue;
        if (!isSamePlayer(event.attacker, playerName)) continue;
        if ((now - (event.timestamp || 0)) > KILL_MERGE_MS) break;
        if (isBlankCombatVictim(event.victim)) return event;
        if (victim && isSamePlayer(event.victim, victim)) return event;
    }
    return null;
};

const isRecentDuplicateCombat = (match, type, attacker, victim) => {
    if (!match?.events?.length || !attacker) return false;
    const now = Date.now();
    const norm = (s) => String(s).replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    const a = norm(attacker);
    const v = norm(victim);
    const victimBlank = !v;
    return match.events.some((e) => {
        if (e.type !== type || !e.attacker) return false;
        if (norm(e.attacker) !== a) return false;
        if ((now - (e.timestamp || 0)) >= COMBAT_DEDUPE_MS) return false;
        // kill: blank victim matches any recent kill by same attacker (tabs backfill race).
        if (type === 'kill' && (victimBlank || isBlankCombatVictim(e.victim))) return true;
        if (!e.victim || victimBlank) return false;
        return norm(e.victim) === v;
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
    // GEP's first post-match_start sample is `{"teams":"1"|"0","players":"?"}` — lobby
    // garbage. Feeding it into the teams-alive minimum produced false 1st places.
    const placeholderTabs = !!window.Utils?.isPlaceholderTabsSample?.(tabs);
    if (tabs.teams && !placeholderTabs) {
        const teams = window.Utils?.trackMinTeamsAlive?.(match, tabs.teams);
        // Provisional while only the local player is dead; frozen once the squad is out.
        if (teams) window.Utils?.applyPlacementEstimate?.(match, teams);
    }
    if (tabs.kills !== undefined) match.kills = Math.max(match.kills || 0, parseInt(tabs.kills) || 0);
    if (tabs.assists !== undefined) match.assists = Math.max(match.assists || 0, parseInt(tabs.assists) || 0);
    if (tabs.damage !== undefined) match.damage = Math.max(match.damage || 0, parseInt(tabs.damage) || 0);
    if (tabs.knockdowns !== undefined) match.knocks = Math.max(match.knocks || 0, parseInt(tabs.knockdowns) || 0);
    const squadKills = parseInt(tabs.squad_kills || tabs.squadKills || 0);
    if (squadKills > (match.squadKills || 0)) match.squadKills = squadKills;
    // Keep combat-log rows aligned with tabs SSOT (kills/assists).
    if (window.Utils?.syncKillCombatLogs) window.Utils.syncKillCombatLogs(match);
    if (window.Utils?.syncAssistCombatLogs) window.Utils.syncAssistCombatLogs(match);
};

const applyMatchSummaryToMatch = (match, raw) => {
    const summary = parseTabsPayload(raw);
    if (!match || !summary) return false;
    const rank = parseInt(summary.rank, 10);
    if (!isNaN(rank) && rank > 0
        && window.Utils?.isImpossibleSummaryRank?.(match, rank, summary.teams)) {
        // Stale summary (previous match's rank/squadKills replayed by GEP): keep the
        // teams-alive estimate and ignore the whole payload, squadKills included.
        const staleKey = `${rank}/${summary.squadKills ?? summary.squad_kills ?? ''}`;
        if (match._rejectedSummaryKey !== staleKey) {
            match._rejectedSummaryKey = staleKey;
            console.warn(`[MatchAudit] match_summary rejected (rank below teams alive) ${JSON.stringify({
                matchId: match.matchId,
                rank,
                squadKills: summary.squadKills ?? summary.squad_kills ?? null,
                minTeamsAlive: match._minTeamsAlive ?? null,
                lastTeamsAlive: match._lastTeamsAlive ?? null,
                estimate: match._estimatedPlacement ?? null,
                squadEliminated: !!match._squadEliminated,
            })}`);
        }
        return !!match._matchSummaryRank;
    }
    if (!isNaN(rank) && rank > 0) {
        const prevEstimated = match._estimatedPlacement;
        // Summary shown after leaving early carries the rank *at that moment*, not the
        // squad's final result — keep it, but flag it as estimated (QA §5.2 이슈 A).
        if (!match._matchSummaryRank && !match._squadEliminated && !match._isVictory
            && hasLivingTeammate(match)) {
            match._summaryWhileSquadAlive = true;
            matchLog('match_summary while squad still alive — rank flagged as estimate', {
                matchId: match.matchId,
                rank,
                isDead: !!match.isDead,
            });
        }
        const prevSummaryRank = match._matchSummaryRank;
        match.placement = rank;
        match._guessedRank = rank;
        match._matchSummaryRank = rank;
        if (prevSummaryRank !== rank) {
            // Always-on audit (WARN survives in background.html.log) — pairs with
            // "[MatchAudit] placement resolved" so summary delivery can be verified per match.
            console.warn(`[MatchAudit] match_summary applied ${JSON.stringify({
                matchId: match.matchId,
                rank,
                previousSummaryRank: prevSummaryRank ?? null,
                previousEstimate: prevEstimated ?? null,
                squadEliminated: !!match._squadEliminated,
                isDead: !!match.isDead,
                ending: !!match._ending,
            })}`);
        }
        // Summary beats tabs/teams estimates for both value and quality flags.
        delete match._estimatedPlacement;
        if (Array.isArray(match.missingSignals)) {
            match.missingSignals = match.missingSignals.filter((s) => s !== 'placement_estimated');
        }
        if (prevEstimated && prevEstimated !== rank) {
            matchLog('match_summary overrode placement estimate', {
                matchId: match.matchId,
                rank,
                previousEstimate: prevEstimated,
            });
        }
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

/** Shared gate lives in Utils — provisional until squad-out is confirmed, then frozen. */
const applyPlacementEstimate = (match) => {
    if (!match || match._isVictory || match._matchSummaryRank) return null;
    return window.Utils?.applyPlacementEstimate?.(match) ?? null;
};

/**
 * Session must end (lobby/loading timeout) while teammates are still alive — the
 * local player left early. Store the current teams-alive estimate as a *flagged*
 * lower bound instead of a bare 20th.
 */
const applyLeftEarlyPlacement = (match) => {
    if (!match || match._isVictory || match._matchSummaryRank || match._squadEliminated) return null;
    if (!hasLivingTeammate(match)) return null;
    if (match.placement > 0 && match.placement < 20 && !match._estimatedPlacement) return match.placement;

    const estimate = window.Utils?.estimatePlacementFromTeamsAlive?.(match);
    if (!estimate) return null;
    const previous = match._estimatedPlacement || null;
    const next = previous ? Math.min(previous, estimate) : estimate;
    match.placement = next;
    match._estimatedPlacement = next;
    match._placementEstimateFrozen = true;
    matchLog('Left match while squad alive — placement stored as estimate', {
        matchId: match.matchId,
        estimate: next,
        minTeamsAlive: match._minTeamsAlive ?? null,
    });
    return next;
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
        // Elimination signal after a summary ⇒ the player stayed; that summary was final.
        delete match._summaryWhileSquadAlive;
        // Freeze roster so spectated enemy names cannot enter teamStats.
        match._squadRosterFrozen = true;
        matchLog('Squad eliminated — roster frozen', {
            matchId: match.matchId,
            teammates: (match.teamStats || []).map((t) => t?.name).filter(Boolean),
        });
        window.CoreController.updateMatch('SET_DEAD', true);
        match.teamStats?.forEach((teammate) => {
            if (teammate.state !== 'death') teammate.state = 'death';
        });
        ensureDeathCombatLogForPlayer(match);
    }

    applyPlacementEstimate(match);

    if (refreshGep && window.EventRouter?.estimatePlacementFromGep && !match._matchSummaryRank) {
        window.EventRouter.estimatePlacementFromGep(match);
    }

    MatchBoundary.onSquadEliminated(match);
};

const handleTeamInfoUpdate = (match, raw) => {
    if (parseTeamInfoState(raw) === 'eliminated') {
        markSquadEliminated(match);
    }
};

const parseGepJson = (raw) => {
    if (raw == null || raw === '' || raw === 'null') return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
};

/** GEP `ring` category → MatchService.recordRing (see that method for storage shape). */
const handleRingUpdate = (ringInfo, match) => {
    if (!ringInfo || typeof ringInfo !== 'object') return;
    [['next_ring', 'next'], ['active_ring', 'active']].forEach(([key, kind]) => {
        if (!Object.prototype.hasOwnProperty.call(ringInfo, key)) return;
        const parsed = parseGepJson(ringInfo[key]);
        if (!parsed) {
            window.Utils?.ringLog?.(`${key} empty/unparsable`, { raw: ringInfo[key] });
            return;
        }
        if (!match || match._ending) {
            window.Utils?.ringLog?.(`${key} with no active match — dropped`, parsed);
            return;
        }
        window.CoreController?.updateMatch?.('RING', { kind, x: parsed.x, y: parsed.y, radius: parsed.radius });
    });
};

const PLAYER_STATS_KEYS = [
    'player_stats_career',
    'player_stats_br_ranked_latest',
    'player_stats_br_unranked_latest',
    'player_stats_br_ranked_history',
    'player_stats_br_unranked_history',
];

/** GEP key → POST /account-stats snapshot field. */
const PLAYER_STATS_UPLOAD_FIELDS = {
    player_stats_career: 'career',
    player_stats_br_ranked_latest: 'brRankedLatest',
    player_stats_br_unranked_latest: 'brUnrankedLatest',
    player_stats_br_ranked_history: 'brRankedHistory',
    player_stats_br_unranked_history: 'brUnrankedHistory',
};

const ACCOUNT_STATS_DEBOUNCE_MS = 4000;
const ACCOUNT_STATS_RETRY_MS = 15000;

/**
 * Uploads changed player_stats keys to POST /account-stats (debounced).
 * Separate from the match upload: `br_ranked_latest` (RP) lands up to ~80s after match_end.
 * See docs/GEP-REQUESTS.md §player_stats.
 */
const AccountStatsSync = {
    _dirty: new Set(),
    _timer: null,
    _inFlight: false,

    markDirty(key) {
        if (!PLAYER_STATS_UPLOAD_FIELDS[key]) return;
        this._dirty.add(key);
        this.schedule(ACCOUNT_STATS_DEBOUNCE_MS);
    },

    schedule(delayMs) {
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            this._timer = null;
            void this.flush();
        }, delayMs);
    },

    async flush() {
        if (this._inFlight || this._dirty.size === 0) return;
        const localUser = window.Store?.system?.localUser;
        const store = window.Store?.playerStats;
        // Identity can arrive after the lobby snapshot; handleWorkerIdentity calls flush again.
        if (!localUser?.uid || !store || !window.CloudRepository?.saveAccountStats) return;

        const keys = [...this._dirty];
        const snapshot = {};
        keys.forEach((key) => {
            if (store[key] != null) snapshot[PLAYER_STATS_UPLOAD_FIELDS[key]] = store[key];
        });
        this._dirty.clear();
        if (Object.keys(snapshot).length === 0) return;

        this._inFlight = true;
        try {
            const res = await window.CloudRepository.saveAccountStats(localUser.uid, {
                name: localUser.name || null,
                legend: store.lastLegend || null,
                snapshot,
            });
            window.Utils?.playerStatsLog?.('Uploaded', {
                keys,
                ok: !!res?.success,
                rpApplied: res?.rpApplied ?? null,
                rpPending: res?.rpPending ?? null,
            });
            if (!res?.success) {
                keys.forEach((key) => this._dirty.add(key));
                this.schedule(ACCOUNT_STATS_RETRY_MS);
            } else if (res.rpApplied && typeof window.CoreController?.onRemoteRpApplied === 'function') {
                window.CoreController.onRemoteRpApplied(res.rpApplied);
            }
        } finally {
            this._inFlight = false;
        }
        if (this._dirty.size > 0) this.schedule(ACCOUNT_STATS_DEBOUNCE_MS);
    },
};
window.AccountStatsSync = AccountStatsSync;

/** GEP career.level is total level (prestige included); profile fields keep ALS's split. */
const splitTotalLevel = (totalLevel) => {
    const total = Number(totalLevel);
    if (!Number.isFinite(total) || total < 1) return null;
    const prestige = Math.min(Math.floor((total - 1) / 500), 3);
    return { prestige, level: total - prestige * 500 };
};

/** Reflect the local player's GEP values on Store.user so the profile card updates live. */
const applyPlayerStatsToLocalUser = (store) => {
    const localUid = window.Store?.system?.localUser?.uid;
    const user = window.Store?.user;
    if (!localUid || !user || String(user.uid) !== String(localUid)) return;

    const career = store.player_stats_career;
    const split = career ? splitTotalLevel(career.level) : null;
    const next = { ...user };
    if (split) {
        next.level = split.level;
        next.prestige = split.prestige;
    }
    if (career) {
        next.currentXp = career.current_xp ?? next.currentXp ?? null;
        next.neededXp = career.needed_xp ?? next.neededXp ?? null;
    }
    const rp = Number(store.player_stats_br_ranked_latest?.rank_score);
    if (Number.isFinite(rp)) next.rankScore = rp;
    // Replace (not mutate) so the UI poll sees a new object.
    window.Store.user = next;
};

/** Same rule as the proxy's rankedDeltaBetween: exactly one ranked game apart, same season. */
const localRankedDelta = (prev, next) => {
    if (!prev || !next || Number(prev.season) !== Number(next.season)) return null;
    if (Number(next.games) !== Number(prev.games) + 1) return null;
    const prevRp = Number(prev.rank_score);
    const nextRp = Number(next.rank_score);
    if (!Number.isFinite(prevRp) || !Number.isFinite(nextRp)) return null;
    return { rankScore: nextRp, rpChange: nextRp - prevRp };
};

const LOCAL_RP_WINDOW_MS = 60 * 60 * 1000;

/** `public.seasons` row (one per split) containing `ms`, from the list loaded at startup. */
const splitIdAt = (ms) => {
    const t = Number(ms);
    if (!Number.isFinite(t) || t <= 0) return null;
    const row = (Array.isArray(window.SEASONS) ? window.SEASONS : []).find((s) =>
        t >= Number(s.startTime || 0) && (s.endTime == null || t < Number(s.endTime)));
    return row ? row.id : null;
};

/**
 * GEP `season` has no split: across a ranked reset the snapshots still look one game
 * apart. Same guard as the proxy's sameSplit — unknown boundaries mean no local pin.
 */
const sameSplitLocal = (prevAtMs, nextAtMs) => {
    const prevId = splitIdAt(prevAtMs);
    return prevId != null && prevId === splitIdAt(nextAtMs);
};

/**
 * Pin a fresh `br_ranked_latest` delta on the local ranked match right away, so the RP
 * chart moves with the profile instead of after the /account-stats round trip.
 * Mirrors the proxy's match pick: unprocessed ranked match still running at the previous
 * ranked snapshot and already started now. The server's rpApplied later confirms it.
 */
const isRankedMatch = (m) => String(m?.mode ?? '').toLowerCase().includes('ranked');

/**
 * Ended ranked match that owns a delta observed at `now` (latest start first), or null.
 * Ended matches only: the delta usually lands ~80s after match_end, possibly while the
 * next ranked match is already in the dropship, so a running match is never a target.
 * `excludeMatchId` = the match the previous delta belonged to. GEP can also send the
 * delta ~10s before match_end (still running → server pending_rp); if that match's
 * upload then fails it stays unprocessed and would steal the next match's delta.
 */
const pickLocalRpTarget = ({ history, activeMatch, localUid, now, prevRankedAt, excludeMatchId }) => {
    const minEnd = Math.max(now - LOCAL_RP_WINDOW_MS, prevRankedAt || 0);
    const excluded = (m) => excludeMatchId != null && String(m.matchId) === String(excludeMatchId);
    const ended = [];
    for (const m of (Array.isArray(history) ? history : [])) {
        if (!m?.matchId || m.rpProcessed || !isRankedMatch(m) || excluded(m)) continue;
        if (m.platformId && String(m.platformId) !== String(localUid)) continue;
        if ((m.endTime || 0) < minEnd || (m.startTime || 0) > now) continue;
        ended.push(m);
    }
    if (activeMatch?._ending && activeMatch.matchId && isRankedMatch(activeMatch) && !excluded(activeMatch)) {
        ended.push(activeMatch);
    }
    ended.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    return ended[0] || null;
};

/** Match id a fresh delta belongs to: the pinned target, else the running ranked match. */
const rpOwnerId = (target, activeMatch) => {
    if (target?.matchId) return String(target.matchId);
    if (activeMatch?.matchId && !activeMatch._ending && isRankedMatch(activeMatch)) return String(activeMatch.matchId);
    return null;
};

/** Returns the id of the match this delta was attributed to (for the next delta's exclusion). */
const applyLocalRankedDelta = (delta, prevRankedAt, activeMatch, prevOwnerId = null) => {
    const localUid = window.Store?.system?.localUser?.uid;
    if (!delta || !localUid) return null;
    const now = Date.now();
    if (!sameSplitLocal(prevRankedAt, now)) return null;
    const target = pickLocalRpTarget({
        history: window.Store.history,
        activeMatch,
        localUid,
        now,
        prevRankedAt,
        excludeMatchId: prevOwnerId,
    });
    if (target) {
        window.Utils?.playerStatsLog?.('rp_local_pin', { matchId: target.matchId, ...delta });
        window.CoreController?.onRemoteRpApplied?.({ matchId: target.matchId, ...delta });
    }
    return rpOwnerId(target, activeMatch);
};

/**
 * GEP `player_stats` category. Keeps the latest snapshot on Store (lobby updates included),
 * copies it onto the active match, and queues changed keys for POST /account-stats.
 */
const handlePlayerStatsUpdate = (statsInfo, match) => {
    if (!statsInfo || typeof statsInfo !== 'object' || !window.Store) return;
    const store = window.Store.playerStats || (window.Store.playerStats = {});
    PLAYER_STATS_KEYS.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(statsInfo, key)) return;
        const parsed = parseGepJson(statsInfo[key]);
        if (!parsed) return;
        const prev = store[key];
        store[key] = parsed;
        store.updatedAt = Date.now();
        // GEP re-sends identical career values after match_end; only upload real changes.
        if (!prev || JSON.stringify(prev) !== JSON.stringify(parsed)) AccountStatsSync.markDirty(key);
        if (key === 'player_stats_br_ranked_latest' && prev && JSON.stringify(prev) !== JSON.stringify(parsed)) {
            const prevRankedAt = store.brRankedAt;
            store.brRankedAt = Date.now();
            store.brRankedOwnerId = applyLocalRankedDelta(
                localRankedDelta(prev, parsed), prevRankedAt, match, store.brRankedOwnerId);
        } else if (key === 'player_stats_br_ranked_latest' && !prev) {
            store.brRankedAt = Date.now();
        }

        if (key === 'player_stats_br_ranked_history' || key === 'player_stats_br_unranked_history') {
            window.Utils?.playerStatsLog?.(key, { seasons: Array.isArray(parsed) ? parsed.length : null });
        } else if (key === 'player_stats_career') {
            const changed = !prev || prev.level !== parsed.level || prev.current_xp !== parsed.current_xp;
            if (changed) {
                window.Utils?.playerStatsLog?.('career', {
                    level: parsed.level,
                    current_xp: parsed.current_xp,
                    needed_xp: parsed.needed_xp,
                    total_xp: parsed.total_xp,
                    inMatch: !!match,
                });
            }
        } else if (!prev || JSON.stringify(prev) !== JSON.stringify(parsed)) {
            window.Utils?.playerStatsLog?.(key, {
                season: parsed.season,
                games: parsed.games,
                // Undocumented but present on ranked keys; equals ALS RP.
                rank_score: parsed.rank_score ?? null,
                inMatch: !!match,
            });
        }
    });

    if (match && !match._ending) {
        const career = store.player_stats_career;
        match.playerStats = {
            level: career?.level ?? null,
            currentXp: career?.current_xp ?? null,
            neededXp: career?.needed_xp ?? null,
            totalXp: career?.total_xp ?? null,
            career: career || null,
            brRankedLatest: store.player_stats_br_ranked_latest || null,
            brUnrankedLatest: store.player_stats_br_unranked_latest || null,
            capturedAt: store.updatedAt,
        };
        if (!match.playerStatsStart && career) {
            match.playerStatsStart = { level: career.level, currentXp: career.current_xp, totalXp: career.total_xp };
        }
        // Profile avatar fallback = legend of the most recent match (GEP legendSelect only).
        if (match.legend && match.legend !== 'Unknown') store.lastLegend = match.legend;
    }

    applyPlayerStatsToLocalUser(store);
};

const applyInfoToMatch = (infoRoot, match) => {
    if (!match) return;
    // onInfoUpdates2 nests under `.info`; overwolf.games.events.getInfo returns `{ success, res }`.
    // Without `.res` the post-match_end refresh polling silently applied nothing.
    const info = infoRoot?.info || infoRoot?.res || infoRoot;
    if (!info || typeof info !== 'object') return;

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
        match._matchSummaryRank = match._matchSummaryRank || 1;
        delete match._estimatedPlacement;
    }

    // Never let tabs/teams estimates override an authoritative summary rank.
    if (!match._matchSummaryRank && !match._isVictory
        && (match._squadEliminated || isEliminated(match))) {
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

    // Never invent legend from profile/ALS — ranked requeue often omits legendSelect
    // and a wrong fallback pollutes the match worse than Unknown.
};

const recordCombatLog = (match, eventPayload, statAction) => {
    const { type, attacker, victim } = eventPayload;
    if (isRecentDuplicateCombat(match, type, attacker, victim)) {
        return false;
    }
    // Kill *count* SSOT is tabs / GEP kill counter — never ++ kills from kill_feed.
    if (statAction === 'KNOCKDOWN') window.CoreController.updateMatch('KNOCKDOWN');
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

    return logged;
};

// 1. COMBAT LOG HANDLER
const handleCombatEvent = (parsed, activeMatch) => {
    const localRaw = parsed.local_player_name;
    const attackerRaw = parsed.attackerName || parsed.attacker || "Unknown";
    const victimRaw = parsed.victimName || parsed.victim || "Unknown";
    const weaponRaw = parsed.weaponName || parsed.weapon || "Unknown";

    const myNameNorm = normalizeCombatName(activeMatch.playerName);
    const localNameNorm = normalizeCombatName(localRaw);
    const atkNorm = normalizeCombatName(attackerRaw);
    const vicNorm = normalizeCombatName(victimRaw);

    if (myNameNorm && localNameNorm && myNameNorm !== localNameNorm) {
        return;
    }

    const isMeAttacker = (myNameNorm && atkNorm === myNameNorm) || (localNameNorm && atkNorm === localNameNorm);
    const isMeVictim = (myNameNorm && vicNorm === myNameNorm) || (localNameNorm && vicNorm === localNameNorm);

    if (activeMatch.isDead && (isMeAttacker || isMeVictim)) {
        return;
    }

    const cleanCombatLabel = (raw) => {
        if (raw == null || raw === '' || String(raw).trim() === '' || String(raw).trim().toLowerCase() === 'unknown') {
            return '';
        }
        const cleaned = window.Utils.cleanName(raw);
        if (!cleaned || cleaned.toLowerCase() === 'unknown') return '';
        return cleaned;
    };

    const cleanAttackerName = cleanCombatLabel(attackerRaw) || (
        attackerRaw && attackerRaw !== 'Unknown' ? window.Utils.cleanName(attackerRaw) : ''
    );
    const isLocalAttacker = !!(activeMatch.playerName && isSamePlayer(attackerRaw, activeMatch.playerName));
    const knownSquadName = window.MatchService?.constructor?._isKnownSquadName
        || window.MatchService?._isKnownSquadName;
    const isTeammateAttacker = !isMeAttacker && !isLocalAttacker && !!cleanAttackerName && (
        !!knownSquadName?.(activeMatch, attackerRaw)
        || (activeMatch.teamStats || []).some((tm) => isSamePlayer(tm.name, attackerRaw))
    );

    let victim = cleanCombatLabel(victimRaw);
    // Opaque finish with empty victimName — reuse pending knock on same fight.
    if (!victim && isMeAttacker && activeMatch._pendingKnocks?.length === 1) {
        victim = activeMatch._pendingKnocks[0];
    }
    const resolved = resolveLocaleAgnosticImpact(activeMatch, {
        isMeAttacker,
        isMeVictim,
        isTeammateAttacker,
        attacker: cleanAttackerName,
        victim,
        impactKind: resolveCombatImpact(parsed),
    });
    const impactKind = resolved.kind;

    if (impactKind === 'unknown') return;

    const isFinalKill = impactKind === 'kill';
    const type = isFinalKill ? 'kill' : 'knockdown';

    if (isTeammateAttacker) {
        const cleanVictimName = victim || cleanCombatLabel(victimRaw);
        if (type === 'knockdown' && cleanVictimName) {
            setSquadCombatPair(activeMatch, cleanAttackerName, cleanVictimName, 'knocked');
        } else if (type === 'kill') {
            window.CoreController.updateMatch('TEAMMATE_KILL', cleanAttackerName);
            // Assist events are count-only — estimate victim from squad elims.
            if (window.Utils?.noteSquadElimVictim && cleanVictimName) {
                window.Utils.noteSquadElimVictim(activeMatch, cleanVictimName, cleanAttackerName);
            }
            if (cleanVictimName) {
                clearSquadCombatPair(activeMatch, cleanAttackerName, cleanVictimName);
            }
        }
    }

    if (isMeAttacker) {
        const weapon = window.Utils.normalizeWeapon(weaponRaw);

        // kill_counter/tabs backfill often lands before kill_feed finish → one Unknown + one named.
        if (type === 'kill') {
            const mergeTarget = findMergeableLocalKill(activeMatch, victim);
            if (mergeTarget) {
                const prevVictim = mergeTarget.victim;
                if (victim && isBlankCombatVictim(mergeTarget.victim)) {
                    mergeTarget.victim = victim;
                    delete mergeTarget._victimEstimated;
                }
                if (weapon && (!mergeTarget.weapon || mergeTarget.weapon === 'Unknown')) {
                    mergeTarget.weapon = weapon;
                }
                const wasBackfill = !!mergeTarget._backfill;
                delete mergeTarget._backfill;
                delete mergeTarget.desc;
                if (victim) {
                    clearPendingKnock(activeMatch, victim);
                    clearCombatPair(activeMatch, victim);
                }
                matchLog('Merged kill into recent combat row', {
                    matchId: activeMatch.matchId,
                    victim: mergeTarget.victim || victim || '',
                    prevVictim: prevVictim || '',
                    weapon: mergeTarget.weapon || weapon || null,
                    wasBackfill,
                });
                if (window.Utils?.fillKillVictims) window.Utils.fillKillVictims(activeMatch);
                return;
            }
        }

        // Kill counts come from tabs — feed only writes the combat log.
        const logged = recordCombatLog(activeMatch, {
            type,
            attacker: activeMatch.playerName,
            victim: victim || '',
            weapon,
        }, type === 'knockdown' ? 'KNOCKDOWN' : null);

        if (logged) {
            if (type === 'knockdown' && victim) {
                addPendingKnock(activeMatch, victim);
                setCombatPair(activeMatch, victim, 'knocked');
            } else if (type === 'kill') {
                if (victim) {
                    clearPendingKnock(activeMatch, victim);
                    clearCombatPair(activeMatch, victim);
                }
                if (window.Utils?.fillKillVictims) window.Utils.fillKillVictims(activeMatch);
            }
        }
    }

    if (isMeVictim) {
        const logType = type === 'kill' ? 'death' : 'knockdown';
        let attacker = cleanCombatLabel(attackerRaw);
        if (!attacker && logType === 'death') {
            const lastKnock = [...(activeMatch.events || [])].reverse().find((e) =>
                e?.type === 'knockdown' && isSamePlayer(e.victim, activeMatch.playerName) && e.attacker
            );
            attacker = lastKnock?.attacker || '';
        }
        const logged = recordCombatLog(activeMatch, {
            type: logType,
            attacker,
            victim: activeMatch.playerName,
            weapon: window.Utils.normalizeWeapon(weaponRaw),
        }, null);
        if (logged && type === 'kill') {
            window.CoreController.updateMatch('SET_DEAD', true);
            if (window.Utils?.fillDeathAttackers) window.Utils.fillDeathAttackers(activeMatch);
        }
    }
};


// 2. EVENT ROUTER
const EventRouter = {
    /** Pure; exposed for tests. */
    pickLocalRpTarget,

    onInfoUpdates: (info) => {
        if (!info) return;

        logInfoUpdatesDebug(info);

        // onInfoUpdates2 / getInfo may nest under .info or pass categories at the root.
        const infoRoot = info.info || info;
        const matchInfoTop = infoRoot.match_info || info.match_info;
        if (matchInfoTop?.map_name && window.Store?.game) {
            const earlyMap = window.MapService
                ? window.MapService.resolveMap(matchInfoTop.map_id, matchInfoTop.map_name)
                : matchInfoTop.map_name;
            if (earlyMap) window.Store.game.map = earlyMap;
        }

        if (!infoRoot || typeof infoRoot !== 'object') return;

        const data = {
            ...infoRoot.game_info,
            ...infoRoot.match_info,
            ...infoRoot.inventory,
            ...infoRoot.me,
            ...infoRoot.damage
        };

        let activeMatch = window.Store.activeMatch;

        // Apply summary as early as possible so later estimate/phase logic cannot win the race.
        if (activeMatch && data.match_summary) {
            applyMatchSummaryToMatch(activeMatch, data.match_summary);
        }

        if (data.phase) {
            const newPhase = data.phase.toLowerCase();
            window.CoreController.updateMatch('PHASE', newPhase);

            if (activeMatch && (newPhase === 'loading' || newPhase === 'lobby')) {
                const duration = Date.now() - activeMatch.startTime;
                if (isEliminated(activeMatch) && !activeMatch._squadEliminated) {
                    markSquadEliminated(activeMatch, { refreshGep: false });
                } else if (activeMatch._squadEliminated || isEliminated(activeMatch)) {
                    applyPlacementEstimate(activeMatch);
                }
                if (isMatchConcluded(activeMatch) || duration > 120000) {
                    // Back in lobby with teammates alive ⇒ left early. Rank is unknowable
                    // from here on; keep a flagged estimate rather than a bare 20th.
                    if (!isMatchConcluded(activeMatch) && hasLivingTeammate(activeMatch)) {
                        applyLeftEarlyPlacement(activeMatch);
                    }
                    window.CoreController.endMatch();
                }
            }

            if (newPhase === 'legend_selection') {
                MatchBoundary._lastLegendSelectionAt = Date.now();
                if (!activeMatch) {
                    MatchBoundary.ensureSessionStarted('legend_selection_phase');
                } else if (
                    isMatchConcluded(activeMatch)
                    || isEliminated(activeMatch)
                    || !!activeMatch._squadEliminated
                ) {
                    // Finished match: close only. Auto-start here created empty #20 sessions
                    // when party/spectate entered select before the local player did.
                    if (!activeMatch._ending) {
                        matchLog('legend_selection phase — ending finished session (no auto-start)', {
                            matchId: activeMatch.matchId,
                            squadEliminated: !!activeMatch._squadEliminated,
                        });
                        void window.CoreController?.endMatch?.();
                    }
                } else if (Date.now() - activeMatch.startTime > 480000) {
                    MatchBoundary.requestRotate(activeMatch, 'legend_selection_phase');
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
                if (activeMatch) {
                    if (
                        activeMatch.map
                        && !window.MapService?.isUnknownMap?.(activeMatch.map)
                        && activeMatch.map !== 'Unknown'
                        && mapName !== activeMatch.map
                    ) {
                        MatchBoundary.maybeInferRotate(activeMatch, {
                            mapChanged: true,
                            afterElimination: !!activeMatch._squadEliminated,
                            noLegendSelect: !activeMatch._hadSquadLegendSelect,
                        }, 'inferred_requeue');
                    }
                    const mapUnknown = window.MapService?.isUnknownMap?.(activeMatch.map)
                        || activeMatch.map === 'Unknown';
                    if (!activeMatch.map || mapUnknown || mapName !== activeMatch.map) {
                        activeMatch.map = mapName;
                    }
                }
            }
        }

        if (data.game_mode || data.mode_name) {
            const modeName = window.Utils.normalizeMode(data.game_mode || data.mode_name);
            window.Store.game.mode = modeName;
            if (activeMatch) activeMatch.mode = modeName;

            // GEP emits #PL_FIRINGRANGE only after leaving the range — cancel that upload.
            if (window.Utils.isFiringRangeMode?.(modeName)) {
                window.CoreController?.cancelPendingUploadForFiringRange?.();
            }
        }

        // player_stats arrives in the lobby too (no active match needed).
        if (infoRoot.player_stats) handlePlayerStatsUpdate(infoRoot.player_stats, activeMatch);
        if (infoRoot.ring) handleRingUpdate(infoRoot.ring, activeMatch);

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
            if (activeMatch && !activeMatch._ending) {
                const names = [...collectSquadNames(activeMatch)];
                if (!activeMatch._boundarySquadSnapshot && names.length >= 2) {
                    activeMatch._boundarySquadSnapshot = names;
                } else if (
                    activeMatch._boundarySquadSnapshot
                    && squadNamesChangedSignificantly(activeMatch, activeMatch._boundarySquadSnapshot)
                ) {
                    MatchBoundary.maybeInferRotate(activeMatch, {
                        squadChanged: true,
                        afterElimination: !!activeMatch._squadEliminated,
                        noLegendSelect: !activeMatch._hadSquadLegendSelect,
                    }, 'inferred_requeue');
                }
            }
        }

        if (data.totalDamageDealt !== undefined) {
            window.CoreController.updateMatch('DAMAGE_TOTAL', data.totalDamageDealt);
        }

        if (activeMatch) {
            // match_summary already applied at top of handler; re-apply in case roster/start raced.
            if (data.match_summary) applyMatchSummaryToMatch(activeMatch, data.match_summary);
            if (data.victory === 'true' || data.victory === true) {
                window.CoreController.updateMatch('VICTORY', true);
            }
        }

        if (data.ultimate_cooldown) {
            window.CoreController.updateMatch('ULTIMATE_COOLDOWN', data.ultimate_cooldown);
        }

        if (activeMatch && !activeMatch.isDead) {
            const weaponsStr = infoRoot.me?.weapons;

            if (weaponsStr) {
                try {
                    const w = JSON.parse(weaponsStr);

                    const rawPrimary = w.weapon0 ?? null;
                    const rawSecondary = w.weapon1 ?? null;

                    // Melee/nades clear the slot (null). Do not keep previous gun via `|| previous`
                    // when GEP explicitly reports fists — that caused phantom loadout rows.
                    const resolveSlot = (raw, previous) => {
                        if (raw == null || raw === '') return previous || null;
                        if (window.Utils?.isNonLoadoutWeaponRaw?.(raw)) return null;
                        const lower = String(raw).toLowerCase();
                        if (lower === 'unknown') return previous || null;
                        const normalized = window.Utils.normalizeWeapon(raw);
                        if (normalized && window.Utils.isUsableWeaponId(normalized)) return normalized;
                        // Unmapped real gun name — keep previous rather than writing junk ids.
                        return previous || null;
                    };

                    window.CoreController.updateMatch('LOADOUT', {
                        primary: resolveSlot(rawPrimary, activeMatch.loadout.primary),
                        secondary: resolveSlot(rawSecondary, activeMatch.loadout.secondary),
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

        gepLog('onNewEvents', info);

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
                if (now - lastBoundaryRotateAt < 3000) return;

                const activeMatch = window.Store.activeMatch;

                // False match_end often precedes respawn match_start — cancel pending end.
                if (MatchBoundary._matchEndTimer) {
                    if (activeMatch && !shouldAcceptMatchBoundaryEnd(activeMatch)) {
                        matchLog('Cancelled pending match_end — continuation match_start');
                        MatchBoundary.cancelMatchEndTimer();
                        if (MatchBoundary._endDebounceTimer) {
                            clearTimeout(MatchBoundary._endDebounceTimer);
                            MatchBoundary._endDebounceTimer = null;
                        }
                        return;
                    }
                    return;
                }

                // Only suppress rapid re-start while a session is already live.
                // After end (activeMatch null), allow start even within 15s.
                if (activeMatch && now - lastMatchEndTime < 15000) return;

                if (activeMatch) {
                    // Gate via shouldAllowRotate — empty teamStats must not force rotate
                    // (solo/duo/pre-roster trio all look empty; see match_start_stale).
                    if (MatchBoundary.shouldAllowRotate(activeMatch, 'match_start_stale')) {
                        MatchBoundary.requestRotate(activeMatch, 'match_start_stale');
                    } else {
                        matchLog('match_start ignored — session already live', {
                            matchId: activeMatch.matchId,
                            reason: 'match_start_stale',
                            squadEliminated: !!activeMatch._squadEliminated,
                            eliminated: isEliminated(activeMatch),
                            victory: !!activeMatch._isVictory,
                            teamStatsLen: Array.isArray(activeMatch.teamStats) ? activeMatch.teamStats.length : 0,
                            hadLocalLegendSelect: !!activeMatch._hadLocalLegendSelect,
                            hadSquadLegendSelect: !!activeMatch._hadSquadLegendSelect,
                            legend: activeMatch.legend || null,
                            ageMs: Date.now() - (activeMatch.startTime || 0),
                        });
                    }
                    return;
                }
                const prevClosed = MatchBoundary._lastClosedSession;
                const gap = prevClosed?.closedAt ? now - prevClosed.closedAt : 0;
                if (
                    prevClosed
                    && gap >= MatchBoundary.BOUNDARY_INFER_GAP_MS
                    && MatchBoundary._lastLegendSelectionAt < (prevClosed.closedAt || 0)
                ) {
                    MatchBoundary.markPendingInferredStart('match_start_requeue');
                }
                matchLog('match_start — starting session');
                lastBoundaryRotateAt = now;
                window.CoreController.startMatch();
                return;
            }

            if (name === 'match_end') {
                // 1차: authoritative end when GEP emits it.
                const activeMatch = window.Store.activeMatch;

                if (activeMatch && !shouldAcceptMatchBoundaryEnd(activeMatch)) {
                    matchLog('Ignored match_end — squad still active (likely respawn)', {
                        matchId: activeMatch.matchId,
                        squadEliminated: !!activeMatch._squadEliminated,
                    });
                    return;
                }

                const matchToEnd = window.Store.activeMatch;
                if (!matchToEnd) {
                    matchLog('match_end received with no active session');
                    return;
                }

                matchLog('match_end — scheduling finalize', { matchId: matchToEnd.matchId });
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
                    // Re-check: teammates may still be alive (respawn race during the delay).
                    if (!shouldAcceptMatchBoundaryEnd(matchToEnd)) {
                        matchLog('Cancelled match_end finalize — squad still active', {
                            matchId: matchToEnd.matchId,
                        });
                        return;
                    }
                    if (window.Store.activeMatch === matchToEnd) {
                        matchLog('Ending session (match_end)', { matchId: matchToEnd.matchId });
                        window.CoreController.endMatch();
                        return;
                    }

                    matchLog('Ending session (match_end captured)', { matchId: matchToEnd.matchId });
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
                    // GEP flags are "true"/"false" strings. Recorded for future stats (not shown yet).
                    window.CoreController.updateMatch('DAMAGE_HIT_FLAGS', {
                        amount,
                        headshot: String(parsed.headshot).toLowerCase() === 'true',
                        grenade: String(parsed.grenade).toLowerCase() === 'true',
                    });
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
                MatchBoundary.noteRespawnOrRevive(activeMatch, 'healed_from_ko');
                window.CoreController.updateMatch('SET_DEAD', false);
                const selfName = activeMatch.playerName && activeMatch.playerName !== 'Unknown'
                    ? activeMatch.playerName : 'Me';
                window.CoreController.addEvent({ type: 'revive', desc: 'Revived', attacker: '', victim: selfName, timestamp: Date.now() });
            } else if (name === 'respawn') {
                MatchBoundary.noteRespawnOrRevive(activeMatch, 'respawn');
                if (activeMatch._squadEliminated) {
                    matchLog('Respawn after squad elimination — rotating session');
                    MatchBoundary.requestRotate(activeMatch, 'respawn');
                    return;
                }
                window.CoreController.updateMatch('SET_DEAD', false);
                const selfName = activeMatch.playerName && activeMatch.playerName !== 'Unknown'
                    ? activeMatch.playerName : 'Me';
                window.CoreController.addEvent({ type: 'respawn', desc: 'Respawned from Dropship', attacker: '', victim: selfName, timestamp: Date.now() });
            } else if (name === 'match_summary') {
                // Always go through summary helper so _matchSummaryRank is set (not PLACEMENT-only).
                const applied = applyMatchSummaryToMatch(activeMatch, parsed?.rank ? parsed : data);
                if (!applied && parsed?.rank) {
                    applyMatchSummaryToMatch(activeMatch, { rank: parsed.rank, squadKills: parsed.squadKills });
                }
            }
        });
    },

    applyInfoToMatch,

    ensureDeathCombatLogForPlayer,

    estimatePlacementFromGep: (match) => {
        if (!match) return Promise.resolve(null);
        return window.EventRouter.refreshMatchFromGep(match, { maxAttempts: 1 }).then(() => {
            return applyPlacementEstimate(match);
        });
    },

    refreshMatchFromGep: (match, options = {}) => {
        const maxAttempts = options.maxAttempts ?? 1;
        const delayMs = options.delayMs ?? 0;

        const pollOnce = () => new Promise((resolve) => {
            if (!match || !overwolf?.games?.events?.getInfo) return resolve(false);
            overwolf.games.events.getInfo((infoRes) => {
                if (infoRes?.res && (infoRes.success === true || infoRes.status === 'success')) {
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
                // Keep polling while we only have a tabs/teams estimate — summary often arrives late.
                if (hasSummary || match._isVictory) break;
                if (match.placement > 0 && match.placement < 20 && !match._estimatedPlacement) {
                    break;
                }
            }
            if (!match._matchSummaryRank && !match._isVictory
                && (match.placement === 20 || match.placement === 0)) {
                if (canEstimatePlacementFromTabs(match)) {
                    applyPlacementEstimate(match);
                }
            }
        })();
    }
};

MatchBoundary.rememberClosedSession = rememberClosedSession;
MatchBoundary.isBoundaryArtifactSession = isBoundaryArtifactSession;

window.EventRouter = EventRouter;
window.MatchBoundary = MatchBoundary;

// src/background/services/matchService.js

// 🌟 [추가됨] 클랜 태그([ ])와 공백, 대소문자를 모두 무시하고 동일 인물인지 판별하는 스마트 비교 함수
const isSamePlayer = (name1, name2) => {
    if (!name1 || !name2) return false;
    const clean1 = name1.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    const clean2 = name2.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
    return clean1 === clean2;
};

// 1. INTERNAL UTILS & FACTORY
const MatchFactory = {
    createEmpty: (initialUser) => {
        return {
            matchId: Date.now().toString(),
            platformId: initialUser?.uid || null, 
            playerName: initialUser?.name || "Unknown",
            map: window.Store?.game?.map || "Unknown",
            mode: window.Store?.game?.mode || "Battle Royale",
            // Never seed from profile/ALS — GEP select or prev-match fallback only.
            legend: null,
            placement: 20,
            kills: 0, assists: 0, deaths: 0, damage: 0, knocks: 0, squadKills: 0, ultimatesUsed: 0, headshots: 0,
            isDead: false,
            rank: {
                name: initialUser?.rankName || "-",
                score: initialUser?.rankScore || 0,
                startScore: initialUser?.rankScore || 0 
            },
            startTime: Date.now(), endTime: 0,
            loadout: { primary: null, secondary: null },
            weaponCombat: {},
            path: [], events: [], teamStats: [], weaponTimeline: [],
            _lastLocationTime: 0, _lastKnownTeams: 20, _guessedRank: null,
            _rosterCache: [], _isVictory: false,
            _squadNames: new Set(initialUser?.name ? [initialUser.name] : []),
            _unknownKillers: [],
            _pendingKnocks: [],
            _combatPairs: Object.create(null),
            _squadCombatPairs: Object.create(null),
            _assistVictimQueue: [],
            _pathSegment: 0,
            _pathRecording: true
        };
    }
};

// 2. MATCH SERVICE CLASS
class MatchService {
    constructor() { this.data = null; this.isStarted = false; }

    createSession(initialUser) {
        this.data = MatchFactory.createEmpty(initialUser);
        this.isStarted = true;
        return this.data;
    }

    updateSession(matchRef, updateType, data) {
        if (!this.isStarted || !this.data || matchRef !== this.data) return;
        const match = this.data;

        switch (updateType) {
            case 'ROSTER_INFO':{
                if (!this.acceptSquadRosterEntry(match, data)) break;
                this.updateRosterCache(match, data);
                this.processRoster(match);
                const mainUid = data.origin_id || data.platform_id || data.uid || data.platformId;
                if (mainUid && !match.platformId) match.platformId = mainUid;
                if (data.playerName) this.registerSquadMember(match, data.playerName);
                break;
            }

            case 'CHECK_ROSTER_AGAIN': this.processRoster(match); break;
            case 'PHASE': match._currentPhase = data; break;
            case 'SET_DEAD': {
                const wasDead = !!match.isDead;
                match.isDead = !!data;
                if (data) {
                    match._pathRecording = false;
                } else if (wasDead) {
                    match._pathSegment = (match._pathSegment || 0) + 1;
                    match._pathRecording = true;
                }
                break;
            }
            case 'KILL': match.kills++; this.recalculateSquadKills(match); break;
            case 'ASSIST': match.assists++; break;
            case 'KNOCKDOWN': match.knocks++; break;
            
            case 'DAMAGE_TOTAL':{
                const totalDmg = parseFloat(data);
                if (!isNaN(totalDmg)) match.damage = Math.max(match.damage, totalDmg);
                break;
            }
            case 'DAMAGE_HIT':
            case 'DAMAGE':{
                const hitDmg = parseFloat(data.amount || data);
                if (!isNaN(hitDmg)) match.damage += hitDmg;
                break;
            }
            case 'LEGEND': match.legend = data; break;

            case 'TEAMS_ALIVE':{
                const teams = window.Utils?.trackMinTeamsAlive?.(match, data);
                if (teams) {
                    if (match._isVictory) {
                        match.placement = 1;
                    } else if (!match._matchSummaryRank) {
                        // Local death alone never fixes the rank — see Utils.applyPlacementEstimate.
                        window.Utils?.applyPlacementEstimate?.(match, teams);
                    }
                }
                break;
            }
                
            case 'PLACEMENT':{
                const newRank = parseInt(data);
                if (!isNaN(newRank) && newRank > 0) {
                    // Victory / match_summary are authoritative; do not clobber them with weaker updates.
                    if (match._isVictory) {
                        match.placement = 1;
                        break;
                    }
                    if (match._matchSummaryRank) {
                        match.placement = match._matchSummaryRank;
                        break;
                    }
                    match.placement = newRank;
                }
                break;
            }

            case 'LOADOUT': {
                const usable = (w) => (window.Utils?.isUsableWeaponId?.(w) ? w : null);
                const previousPrimary = usable(match.loadout.primary);
                const previousSecondary = usable(match.loadout.secondary);
                // null means cleared (Melee). Only fall back when field omitted.
                const nextPrimary = data.primary !== undefined ? usable(data.primary) : previousPrimary;
                const nextSecondary = data.secondary !== undefined ? usable(data.secondary) : previousSecondary;
                const changed = previousPrimary !== nextPrimary || previousSecondary !== nextSecondary;

                // Never record empty/empty (Melee/Melee) or duplicate usable pairs.
                if (changed && (nextPrimary || nextSecondary)) {
                    match.weaponTimeline = match.weaponTimeline || [];
                    match.weaponTimeline.push({
                        timestamp: Date.now(),
                        action: 'loadout_change',
                        previousPrimary,
                        previousSecondary,
                        primary: nextPrimary,
                        secondary: nextSecondary
                    });
                    window.Utils?.matchLog?.('Loadout timeline push', {
                        matchId: match.matchId,
                        previousPrimary,
                        previousSecondary,
                        primary: nextPrimary,
                        secondary: nextSecondary,
                        timelineLen: match.weaponTimeline.length,
                    });
                } else if (changed) {
                    window.Utils?.matchLog?.('Loadout timeline skip (empty/empty)', {
                        matchId: match.matchId,
                        previousPrimary,
                        previousSecondary,
                        rawPrimary: data.primary,
                        rawSecondary: data.secondary,
                    });
                }

                match.loadout.primary = nextPrimary;
                match.loadout.secondary = nextSecondary;
                break;
            }
                
            case 'TEAMMATE':{
                if (!this.acceptSquadRosterEntry(match, {
                    playerName: data.name,
                    is_local: false,
                    is_teammate: true,
                })) break;
                const existing = match.teamStats.find(t => isSamePlayer(t.name, data.name));
                if (existing) {
                    if (data.name.includes('[') && !existing.name.includes('[')) existing.name = data.name;
                    if (data.legend && data.legend !== 'unknown') existing.legend = data.legend;
                    if (data.state) existing.state = data.state;
                    if (data.uid) existing.uid = data.uid;
                } else {
                    match.teamStats.push({ 
                        name: data.name, 
                        uid: data.uid || data.platformId || null,
                        legend: data.legend || 'unknown', 
                        state: data.state || 'alive', kills: 0
                    });
                }
                if (data.name) this.registerSquadMember(match, data.name);
                break;
            }

            case 'TEAMMATE_KILL':{
                const shooter = match.teamStats.find(t => isSamePlayer(t.name, data));
                if (shooter) {
                    shooter.kills = (shooter.kills || 0) + 1;
                    this.recalculateSquadKills(match);
                }
                break;
            }

            case 'SQUAD_KILL_CHECK': this.checkSquadKill(match, data); break;
            
            case 'PATH':{
                if (!data || (data.x === 0 && data.y === 0)) return;
                if (match.isDead || match._pathRecording === false) return;

                const phase = String(data.phase || match._currentPhase || '').toLowerCase();
                // Pre-drop phases only ever carry the previous match's cached coordinate.
                if (MatchService.PRE_MATCH_PHASES.has(phase)) return;

                const point = { x: Math.round(data.x), y: Math.round(data.y) };

                // First point of the session — GEP keeps serving the last match's death spot
                // until the new match writes a location (QA §5.2 이슈 B).
                if (match.path.length === 0) {
                    if (MatchService._isStaleSessionStart(match, point)) return;
                    // Require movement before trusting the very first coordinate.
                    const first = match._firstLocationSample;
                    if (!first) {
                        match._firstLocationSample = point;
                        return;
                    }
                    if (first.x === point.x && first.y === point.y) return;
                }

                const now = Date.now();
                if (now - (match._lastLocationTime || 0) > 1000) {
                    if (!match.startPos) match.startPos = { x: point.x, y: point.y, z: data.z || 0 };
                    match.endPos = { x: point.x, y: point.y, z: data.z || 0 };
                    match.path.push({
                        x: point.x,
                        y: point.y,
                        t: now,
                        p: phase || 'unknown',
                        s: match._pathSegment || 0
                    });
                    match._lastLocationTime = now;
                }
                break;
            }

            case 'ULTIMATE_COOLDOWN':{
                const current = parseInt(data);
                const last = match._lastUltValue || 0;
                if (!isNaN(current) && !match.isDead) {
                    if (last >= 90 && current <= 5) match.ultimatesUsed++;
                    match._lastUltValue = current;
                }
                break;
            }

            case 'EVENT': this.addEvent(match, data); break;

            case 'SYNC_STATS':{
                if (data.kills !== undefined) match.kills = Math.max(match.kills || 0, parseInt(data.kills) || 0);
                if (data.damage !== undefined) match.damage = Math.max(match.damage || 0, parseInt(data.damage) || 0);
                if (data.assists !== undefined) match.assists = Math.max(match.assists || 0, parseInt(data.assists) || 0);
                if (data.knockdowns !== undefined) match.knocks = Math.max(match.knocks || 0, parseInt(data.knockdowns) || 0);
                if (data.teams) this.updateSession(matchRef, 'TEAMS_ALIVE', data.teams);
                const apiSquadKills = parseInt(data.squadKills || data.squad_kills || 0);
                if (apiSquadKills > match.squadKills) match.squadKills = apiSquadKills;
                if (window.Utils?.syncKillCombatLogs) window.Utils.syncKillCombatLogs(match);
                if (window.Utils?.syncAssistCombatLogs) window.Utils.syncAssistCombatLogs(match);
                break;
            }

            case 'VICTORY':
                match.placement = 1;
                match._guessedRank = 1;
                match._isVictory = true;
                match._matchSummaryRank = match._matchSummaryRank || 1;
                delete match._estimatedPlacement;
                break;
        }
    }

    registerSquadMember(match, newName) {
        if (!newName) return;
        match._squadNames.add(newName);
        if (match._unknownKillers.length > 0) {
            const backlogKills = match._unknownKillers.filter(k => isSamePlayer(k, newName) || k.includes(newName) || newName.includes(k));
            if (backlogKills.length > 0) {
                match.squadKills += backlogKills.length;
                match._unknownKillers = match._unknownKillers.filter(k => !backlogKills.includes(k));
            }
        }
    }

    checkSquadKill(match, { attackerName }) {
        if (!attackerName) return;
        let isSquadMember = false;
        match._squadNames.forEach(member => {
            if (isSamePlayer(member, attackerName) || attackerName.includes(member) || member.includes(attackerName)) isSquadMember = true;
        });
        if (isSquadMember) match.squadKills++;
        else match._unknownKillers.push(attackerName);
    }

    static _isLocalRosterPayload(playerData, match) {
        if (!playerData) return false;
        if (
            playerData.is_local === true
            || playerData.is_local === '1'
            || playerData.is_local === 'true'
            || String(playerData.is_local) === '1'
        ) return true;
        const hasMyName = match?.playerName && match.playerName !== 'Unknown';
        return !!(hasMyName && playerData.playerName && isSamePlayer(playerData.playerName, match.playerName));
    }

    static _isKnownSquadName(match, name) {
        if (!name || !match) return false;
        if (match.playerName && match.playerName !== 'Unknown' && isSamePlayer(match.playerName, name)) {
            return true;
        }
        if (match.teamStats?.some((tm) => isSamePlayer(tm.name, name))) return true;
        if (match._rosterCache?.some((p) => p?.playerName && isSamePlayer(p.playerName, name))) {
            return true;
        }
        if (match._squadNames) {
            for (const member of match._squadNames) {
                if (isSamePlayer(member, name)) return true;
            }
        }
        return false;
    }

    /**
     * Block spectated / enemy names from entering squad roster.
     * BR squad max = local + 2 teammates; freeze after squad elimination.
     */
    acceptSquadRosterEntry(match, playerData) {
        if (!match || !playerData) return false;
        const name = playerData.playerName || playerData.name;
        if (!name) return false;

        if (MatchService._isLocalRosterPayload(playerData, match)) return true;
        if (MatchService._isKnownSquadName(match, name)) return true;

        if (match._squadRosterFrozen || match._squadEliminated) {
            window.Utils.matchLog('Rejected roster entry after squad freeze (likely spectator)', name);
            return false;
        }

        const nonLocalCached = (match._rosterCache || []).filter(
            (p) => p && !MatchService._isLocalRosterPayload(p, match)
        );
        const teammateCount = Math.max(nonLocalCached.length, match.teamStats?.length || 0);
        if (teammateCount >= 2) {
            window.Utils.matchLog('Rejected roster entry — squad already full (likely spectator)', name);
            return false;
        }

        return true;
    }

    updateRosterCache(match, playerData) {
        if (!playerData) return; 
        if (!match._rosterCache) match._rosterCache = [];
        
        const index = match._rosterCache.findIndex(p => p && (
            (playerData.selectionOrder !== undefined && p.selectionOrder == playerData.selectionOrder) || 
            (p.playerName && isSamePlayer(p.playerName, playerData.playerName))
        ));
        
        if (index !== -1) match._rosterCache[index] = { ...match._rosterCache[index], ...playerData };
        else match._rosterCache.push(playerData);
    }

    processRoster(match) {
        if (!match._rosterCache || match._rosterCache.length === 0) return;

        const hasMyName = match.playerName !== 'Unknown';

        let myData = match._rosterCache.find(p => p && (
            p.is_local === true || p.is_local === "1" || p.is_local === "true" || 
            (hasMyName && p.playerName && isSamePlayer(p.playerName, match.playerName))
        ));

        if (myData) {
            const rawLegend = myData.legendName || myData.legend || myData.characterName;
            if (rawLegend) {
                const legend = window.Utils.normalizeLegend(rawLegend);
                if (match.legend !== legend) match.legend = legend;
                match._hadLocalLegendSelect = true;
                // Local legend implies squad character-select boundary evidence.
                match._hadSquadLegendSelect = true;
            }

            if (!hasMyName || (myData.playerName && myData.playerName.includes('['))) {
                match.playerName = window.Utils.cleanName(myData.playerName);
            }
            
            const myMainUid = myData.origin_id || myData.platform_id || myData.uid || myData.platformId;
            if (!match.platformId && myMainUid) match.platformId = myMainUid;
        }

        const oldStats = [...match.teamStats]; 
        match.teamStats = []; 

        // Drop spectator pollution; keep at most 2 teammates.
        const teammates = match._rosterCache
            .filter((p) => p && p !== myData)
            .filter((p) => {
                if (MatchService._isKnownSquadName(match, p.playerName) || oldStats.some((o) => isSamePlayer(o.name, p.playerName))) {
                    return true;
                }
                if (match._squadRosterFrozen || match._squadEliminated) return false;
                return true;
            })
            .slice(0, 2);
        
        teammates.forEach(tm => {
            if (!tm) return; 
            const tmName = tm.playerName;
            const existing = oldStats.find(old => isSamePlayer(old.name, tmName));
            const tmUid = tm.origin_id || tm.platform_id || tm.uid || tm.platformId || (existing ? existing.uid : null);
            
            const finalName = tmName.includes('[') ? tmName : (existing && existing.name.includes('[') ? existing.name : tmName);

            match.teamStats.push({
                name: finalName,
                uid: tmUid || null,
                legend: window.Utils.normalizeLegend(tm.legendName || tm.legend || tm.characterName),
                state: existing ? existing.state : 'alive',
                kills: existing ? existing.kills : 0
            });
        });
    }

    recalculateSquadKills(match) {
        const myKills = match.kills || 0;
        const teammatesKills = match.teamStats.reduce((sum, t) => sum + (t.kills || 0), 0);
        match.squadKills = Math.max(match.squadKills, myKills + teammatesKills);
    }

    /** Phases where `location` is not the player in this match yet. */
    static PRE_MATCH_PHASES = new Set(['lobby', 'legend_selection', 'loading']);

    /** First coordinate equals the previous session's last GEP reading ⇒ stale carry-over. */
    static _isStaleSessionStart(match, point) {
        const prev = window.Store?.lastSessionEndPos;
        if (!prev) return false;
        const stale = Math.abs(prev.x - point.x) <= 1 && Math.abs(prev.y - point.y) <= 1;
        if (stale && !match._loggedStaleStart) {
            match._loggedStaleStart = true;
            window.Utils?.matchLog?.('Rejected stale first location (previous session end)', {
                matchId: match.matchId,
                point,
                prev: { x: prev.x, y: prev.y },
            });
        }
        return stale;
    }

    static _isSquadOut(match) {
        if (!match) return false;
        if (match._squadEliminated) return true;
        if (window.Utils?.isSquadOutInferred) return window.Utils.isSquadOutInferred(match);
        if (!match.isDead) return false;
        const teammates = match.teamStats || [];
        if (teammates.length === 0) return true;
        if (window.Utils?.hasLivingTeammate) return !window.Utils.hasLivingTeammate(match);
        return !teammates.some((t) => t.state && t.state !== 'death' && t.state !== 'knocked_out');
    }

    static resolveFinalPlacement(match) {
        if (!match) return 20;
        if (match._isVictory) return 1;
        if (match._matchSummaryRank) return match._matchSummaryRank;
        // Everything below is an estimate. Rank 1 only ever comes from the two
        // authoritative signals above, so clamp estimates to 2nd or worse.
        const floor = window.Utils?.MIN_ESTIMATED_PLACEMENT ?? 2;
        const asEstimate = (value) => Math.max(floor, value);
        if (match.placement > 0 && match.placement < 20) return asEstimate(match.placement);
        if (match._estimatedPlacement) return asEstimate(match._estimatedPlacement);
        // Prefer observed min tabs.teams even when squad-out inference missed
        // (e.g. teammates stuck in knocked_out and placement stayed at default 20).
        const fromTeams = window.Utils?.estimatePlacementFromTeamsAlive?.(match);
        if (fromTeams) return asEstimate(fromTeams);
        return match.placement && match.placement < 20 ? asEstimate(match.placement) : 20;
    }

    static isGhostMatch(match, durationSeconds) {
        if (window.Utils?.shouldDiscardHollowStatGhost?.(match)) return true;
        if (window.Utils?.hasRealMatchEvidence?.(match)) return false;

        const isEmptyStats = (match.kills || 0) === 0 && (match.damage || 0) === 0;
        const isUnknownLegend = !match.legend || match.legend === 'Unknown' || match.legend === 'unknown';

        if (durationSeconds < 30 && isEmptyStats) return true;
        return isUnknownLegend && isEmptyStats;
    }
    
    static stripRuntimeFields(match) {
        const runtimeKeys = [
            'isDead', '_ending', '_saved', '_isVictory', '_guessedRank', '_lastLocationTime',
            '_lastKnownTeams', '_lastUltValue', '_currentPhase', '_rosterCache', '_squadNames',
            '_unknownKillers', 'startPos', 'endPos', '_pathSegment', '_pathRecording',
            '_squadEliminated', '_lastTeamsAlive', '_minTeamsAlive',
            '_matchSummaryRank', '_estimatedPlacement', '_placementEstimateFrozen', '_summaryWhileSquadAlive',
            '_lastSeenLoc', '_firstLocationSample', '_loggedStaleStart',
            '_pendingKnocks', '_combatPairs', '_squadCombatPairs', '_assistVictimQueue', '_lastDamageLogAt', '_gepPseudoMatchId',
            '_boundaryLastKills', '_boundaryLastDamage', '_boundaryLastTeams',
            '_discardUpload', '_uploadQueuedAt', '_hadLocalLegendSelect',
            '_loggedLocalLegendSelect',
            '_legendFromPrevMatch',
            '_hadSquadLegendSelect',
            '_sawGepPseudo', '_boundaryInferred', '_missingMatchStart',
            '_uploadHoldUntil', '_continuationHold', '_boundarySquadSnapshot',
            '_lastRespawnOrReviveAt', '_squadRosterFrozen',
        ];
        runtimeKeys.forEach((k) => { delete match[k]; });
        if (match.teamStats) {
            match.teamStats.forEach((tm) => { delete tm.state; });
        }
    }

    addEvent(match, newEvent) { 
        if (!newEvent || !newEvent.type) return;
        const isSupportEvent = newEvent.type === 'revive' || newEvent.type === 'respawn';
        const playerName = match.playerName && match.playerName !== 'Unknown' ? match.playerName : null;

        let attacker = newEvent.attacker;
        let victim = newEvent.victim;

        if (isSupportEvent) {
            if (attacker === undefined || attacker === null || attacker === 'Unknown') attacker = '';
            if (victim === 'Me' && playerName) victim = playerName;
        }

        match.events.push({
            type: newEvent.type,
            attacker: attacker !== undefined && attacker !== null && attacker !== ''
                ? attacker
                : (isSupportEvent ? '' : 'Unknown'),
            victim: victim !== undefined && victim !== null && victim !== ''
                ? victim
                : 'Unknown',
            weapon: newEvent.weapon || null,
            desc: newEvent.desc || undefined,
            timestamp: newEvent.timestamp || Date.now()
        });
    }

    async finalizeAndUpload(matchRef) {
        if (!this.data || matchRef !== this.data) {
            return this.finalizeDetached(matchRef);
        }
        const match = this.data;
        this.isStarted = false;
        this.data = null;
        return this._finalizeMatchObject(match);
    }

    /** activeMatch 스냅샷 — MatchService.data와 분리된 뒤에도 안전하게 업로드 */
    async finalizeDetached(match) {
        if (!match) return { saved: false, reason: "NO_MATCH" };
        if (this.data === match) {
            this.isStarted = false;
            this.data = null;
        }
        return this._finalizeMatchObject(match);
    }

    async _finalizeMatchObject(match) {
        match.endTime = Date.now();

        if (match._saved) return { saved: false, reason: "ALREADY_SAVED" };

        if (!match.platformId) return { saved: false, reason: "NO_UID" };

        // Boundary-inferred / legendSelect-less restarts are kept as estimated matches.
        if (window.MatchBoundary?.markInferredBoundaryIfArtifact?.(match)) {
            window.Utils.matchLog('Marked boundary-inferred session as estimated (keeping record)', {
                matchId: match.matchId,
                ...(window.Utils?.getMatchEvidenceSummary?.(match) || {}),
            });
        }

        if (window.EventRouter?.refreshMatchFromGep) {
            await window.EventRouter.refreshMatchFromGep(match, { maxAttempts: 5, delayMs: 1000 });
        }

        // Late #PL_FIRINGRANGE often arrives during this refresh window after match_end.
        if (match._discardUpload || window.Utils?.isFiringRangeMode?.(match.mode)
            || window.Utils?.isFiringRangeMode?.(window.Store?.game?.mode)) {
            match.mode = 'Firing Range';
            window.Utils.matchLog('Rejected Firing Range session before upload', {
                matchId: match.matchId,
            });
            return { saved: false, reason: "FIRING_RANGE" };
        }

        if (window.Utils?.applyMissingModeFallback) {
            window.Utils.applyMissingModeFallback(match);
        }

        const placementBeforeResolve = match.placement;
        match.placement = MatchService.resolveFinalPlacement(match);
        if (match._matchSummaryRank || match._isVictory) {
            match.placement = match._isVictory ? 1 : match._matchSummaryRank;
            delete match._estimatedPlacement;
        } else if (match.placement > 0 && match.placement !== 20) {
            // Estimated result: keep the estimate flag in sync with the clamped value so
            // history shows it as estimated (never as a win).
            if (match._estimatedPlacement && match._estimatedPlacement !== match.placement) {
                match._estimatedPlacement = match.placement;
            }
            match._guessedRank = match._guessedRank == null
                ? match.placement
                : Math.min(match._guessedRank, match.placement);
        }

        // Always-on audit line (background.html.log keeps WARN). Lets us see, per match,
        // whether the final rank came from summary/victory or from a teams-alive estimate.
        console.warn(`[MatchAudit] placement resolved ${JSON.stringify({
            matchId: match.matchId,
            placement: match.placement,
            source: match._isVictory ? 'victory' : (match._matchSummaryRank ? 'match_summary' : 'estimate'),
            rawBefore: placementBeforeResolve,
            minTeamsAlive: match._minTeamsAlive ?? null,
            lastTeamsAlive: match._lastTeamsAlive ?? null,
            squadEliminated: !!match._squadEliminated,
            isDead: !!match.isDead,
        })}`);

        if (window.EventRouter?.ensureDeathCombatLogForPlayer) {
            window.EventRouter.ensureDeathCombatLogForPlayer(match);
        }

        if (window.Utils?.countLocalPlayerDeaths) {
            match.deaths = window.Utils.countLocalPlayerDeaths(match);
        }

        if (window.Utils?.syncWeaponCombatFromEvents) {
            window.Utils.syncWeaponCombatFromEvents(match);
        }

        // Incomplete tabs/combat mismatch: never invent kills from the log.
        // Other hollow split halves may still backfill before the ghost gate.
        const incompleteMismatch = !!window.Utils?.isIncompleteTabsCombatMismatch?.(match);
        if (!incompleteMismatch
            && window.Utils?.isHollowStatGhost?.(match)
            && !window.Utils?.shouldDiscardHollowStatGhost?.(match)) {
            window.Utils.backfillTabsFromCombatLog?.(match);
        }

        const durationSeconds = (match.endTime - match.startTime) / 1000;
        if (match.kills != null
            && (!match.squadKills || match.squadKills < match.kills)) {
            match.squadKills = match.kills;
        }

        if (MatchService.isGhostMatch(match, durationSeconds)) {
            const hollow = !!window.Utils?.shouldDiscardHollowStatGhost?.(match);
            window.Utils.matchLog(hollow ? 'Rejected hollow-stat ghost session' : 'Rejected ghost session', {
                matchId: match.matchId,
                hollow,
                ...(window.Utils?.getMatchEvidenceSummary?.(match) || { durationSeconds }),
            });
            return { saved: false, reason: hollow ? "HOLLOW_STAT_GHOST" : "GHOST" };
        }

        if (match._discardUpload || window.Utils?.isFiringRangeMode?.(match.mode)
            || window.Utils?.isFiringRangeMode?.(window.Store?.game?.mode)) {
            match.mode = 'Firing Range';
            window.Utils.matchLog('Rejected Firing Range session before upload', {
                matchId: match.matchId,
            });
            return { saved: false, reason: "FIRING_RANGE" };
        }

        if (window.Utils?.applyLegendFromPreviousMatch) {
            window.Utils.applyLegendFromPreviousMatch(match);
        }

        // Persist null placement/stats instead of fake 20 / 0/0/0.
        window.Utils?.applyIncompleteTabsCombatMismatch?.(match);

        if (window.Utils?.finalizeMatchDataQuality) {
            window.Utils.finalizeMatchDataQuality(match);
        }

        match._saved = true;

        delete match._rosterCache; delete match._squadNames; delete match._unknownKillers;
        MatchService.stripRuntimeFields(match);

        // ✅ teamStats uid 사후 보정
        if (window.CloudRepository) {
            const unresolvedTeammates = match.teamStats.filter(tm => !tm.uid && tm.name);

            if (unresolvedTeammates.length > 0) {
                let historyCache = null;

                await Promise.all(unresolvedTeammates.map(async (tm) => {
                    const uid = await window.CloudRepository.findUidByName(tm.name);
                    if (uid) {
                        tm.uid = uid;
                        return;
                    }

                    if (!historyCache) {
                        historyCache = await window.CloudRepository.fetchHistoryFile(match.platformId) || [];
                    }
                    for (const pastMatch of historyCache) {
                        const found = pastMatch.teamStats?.find(t => isSamePlayer(t.name, tm.name) && t.uid);
                        if (found) {
                            tm.uid = found.uid;
                            break;
                        }
                    }
                }));
            }
        }

        const cleanMatchData = JSON.parse(JSON.stringify(match).replace(/\\u0000/g, ''));

        if (window.CloudRepository) {
            try {
                await window.CloudRepository.appendMatchHistory(cleanMatchData.platformId, cleanMatchData);
                return { saved: true, uid: cleanMatchData.platformId };
            } catch (e) {
                return { saved: false, reason: "UPLOAD_ERROR" };
            }
        }
        return { saved: false, reason: "NO_REPO" };
    }
}

window.MatchService = new MatchService();
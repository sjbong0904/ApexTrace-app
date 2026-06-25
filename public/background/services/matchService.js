// src/background/services/matchService.js

console.log("Initializing Match Service (Unified ID Mode & Clan Tag Fix)");

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
            legend: initialUser?.legend || null,
            placement: 20,
            kills: 0, assists: 0, damage: 0, knocks: 0, squadKills: 0, ultimatesUsed: 0, headshots: 0,
            isDead: false,
            rank: {
                name: initialUser?.rankName || "-",
                score: initialUser?.rankScore || 0,
                startScore: initialUser?.rankScore || 0 
            },
            startTime: Date.now(), endTime: 0,
            loadout: { primary: null, secondary: null },
            path: [], events: [], teamStats: [], weaponTimeline: [],
            _lastLocationTime: 0, _lastKnownTeams: 20, _guessedRank: 20,
            _rosterCache: [], _isVictory: false,
            _squadNames: new Set(initialUser?.name ? [initialUser.name] : []),
            _unknownKillers: [],
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
                const teams = parseInt(data);
                if (!isNaN(teams) && teams > 0 && teams <= 20) {
                    match._lastTeamsAlive = teams;
                    if (teams < match._guessedRank) match._guessedRank = teams;
                    if (match._isVictory) {
                        match.placement = 1;
                    } else if (match._squadEliminated && (match.placement === 20 || match.placement === 0)) {
                        match.placement = Math.min(20, teams + 1);
                    }
                }
                break;
            }
                
            case 'PLACEMENT':{
                const newRank = parseInt(data);
                if (!isNaN(newRank) && newRank > 0) {
                    // 🌟 [수정됨] 우승 상태라면 강제로 1등 유지
                    match.placement = match._isVictory ? 1 : newRank;
                }
                break;
            }

            case 'LOADOUT': {
                const previousPrimary = match.loadout.primary || null;
                const previousSecondary = match.loadout.secondary || null;
                const nextPrimary = data.primary || previousPrimary;
                const nextSecondary = data.secondary || previousSecondary;
                const changed = previousPrimary !== nextPrimary || previousSecondary !== nextSecondary;

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
                }

                match.loadout.primary = nextPrimary;
                match.loadout.secondary = nextSecondary;
                break;
            }
                
            case 'TEAMMATE':{
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
                const now = Date.now();
                if (now - (match._lastLocationTime || 0) > 1000) {
                    match.path.push({
                        x: Math.round(data.x),
                        y: Math.round(data.y),
                        t: now,
                        p: match._currentPhase || 'unknown',
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
                break;
            }

            case 'VICTORY':
                match.placement = 1; 
                match._guessedRank = 1;
                match._isVictory = true; // 🌟 [수정됨] 우승 플래그 활성화
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
            const legend = window.Utils.normalizeLegend(myData.legendName);
            if (match.legend !== legend) match.legend = legend;
            
            if (!hasMyName || (myData.playerName && myData.playerName.includes('['))) {
                match.playerName = window.Utils.cleanName(myData.playerName);
            }
            
            const myMainUid = myData.origin_id || myData.platform_id || myData.uid || myData.platformId;
            if (!match.platformId && myMainUid) match.platformId = myMainUid;
        }

        const oldStats = [...match.teamStats]; 
        match.teamStats = []; 

        const teammates = match._rosterCache.filter(p => p !== myData);
        
        teammates.forEach(tm => {
            if (!tm) return; 
            const tmName = tm.playerName;
            const existing = oldStats.find(old => isSamePlayer(old.name, tmName));
            const tmUid = tm.origin_id || tm.platform_id || tm.uid || tm.platformId || (existing ? existing.uid : null);
            
            const finalName = tmName.includes('[') ? tmName : (existing && existing.name.includes('[') ? existing.name : tmName);

            match.teamStats.push({
                name: finalName,
                uid: tmUid || null,
                legend: window.Utils.normalizeLegend(tm.legendName),
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

    static resolveFinalPlacement(match) {
        if (!match) return 20;
        if (match._isVictory) return 1;
        if (match._matchSummaryRank) return match._matchSummaryRank;
        if (match.placement > 0 && match.placement < 20) return match.placement;
        if (match._estimatedPlacement) return match._estimatedPlacement;
        if (match._squadEliminated && match._lastTeamsAlive) {
            return Math.min(20, match._lastTeamsAlive + 1);
        }
        return match.placement || 20;
    }

    static isGhostMatch(match, durationSeconds) {
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
            '_squadEliminated', '_lastTeamsAlive', '_matchSummaryRank', '_estimatedPlacement', '_teamStates'
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

        if (window.EventRouter?.refreshMatchFromGep) {
            await window.EventRouter.refreshMatchFromGep(match, { maxAttempts: 5, delayMs: 1000 });
        }

        if (window.Utils?.applyMissingModeFallback) {
            window.Utils.applyMissingModeFallback(match);
        }

        match.placement = MatchService.resolveFinalPlacement(match);
        if (match.placement < 20) {
            match._guessedRank = Math.min(match._guessedRank || 20, match.placement);
        }

        const durationSeconds = (match.endTime - match.startTime) / 1000;
        if (!match.squadKills || match.squadKills < match.kills) match.squadKills = match.kills;

        if (MatchService.isGhostMatch(match, durationSeconds)) {
            console.warn('[Match] Rejected ghost session', {
                matchId: match.matchId,
                ...(window.Utils?.getMatchEvidenceSummary?.(match) || { durationSeconds }),
            });
            return { saved: false, reason: "GHOST" };
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
                        console.log(`✅ uid resolved (address-book): ${tm.name} → ${uid}`);
                        return;
                    }

                    if (!historyCache) {
                        historyCache = await window.CloudRepository.fetchHistoryFile(match.platformId) || [];
                    }
                    for (const pastMatch of historyCache) {
                        const found = pastMatch.teamStats?.find(t => isSamePlayer(t.name, tm.name) && t.uid);
                        if (found) {
                            tm.uid = found.uid;
                            console.log(`✅ uid resolved (archive): ${tm.name} → ${found.uid}`);
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
// src/background/events.js
let lastMatchEndTime = 0;

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
        const teams = parseInt(tabs.teams, 10);
        if (!isNaN(teams) && teams > 0) {
            match._lastTeamsAlive = teams;
            if (teams < (match._guessedRank || 20)) match._guessedRank = teams;
            if (match._squadEliminated && (match.placement === 20 || match.placement === 0)) {
                match.placement = Math.min(20, teams + 1);
                match._estimatedPlacement = match.placement;
            }
        }
    }
    if (tabs.kills !== undefined) match.kills = Math.max(match.kills || 0, parseInt(tabs.kills) || 0);
    if (tabs.assists !== undefined) match.assists = Math.max(match.assists || 0, parseInt(tabs.assists) || 0);
    if (tabs.damage !== undefined) match.damage = Math.max(match.damage || 0, parseInt(tabs.damage) || 0);
    if (tabs.knockdowns !== undefined) match.knocks = Math.max(match.knocks || 0, parseInt(tabs.knockdowns) || 0);
    const squadKills = parseInt(tabs.squad_kills || tabs.squadKills || 0);
    if (squadKills > (match.squadKills || 0)) match.squadKills = squadKills;
};

const applyMatchSummaryToMatch = (match, raw) => {
    const summary = parseTabsPayload(raw);
    if (!match || !summary) return false;
    const rank = parseInt(summary.rank, 10);
    if (!isNaN(rank) && rank > 0 && rank <= 20) {
        match.placement = rank;
        match._guessedRank = rank;
        match._matchSummaryRank = rank;
    }
    const squadKills = parseInt(summary.squadKills || summary.squad_kills, 10);
    if (!isNaN(squadKills)) match.squadKills = Math.max(match.squadKills || 0, squadKills);
    return !!match._matchSummaryRank;
};

const syncTeamRosterFromInfo = (matchInfo, match) => {
    if (!matchInfo || !match) return;
    if (!match._teamStates) match._teamStates = {};

    Object.keys(matchInfo).forEach((key) => {
        if (!key.startsWith('roster_')) return;
        const raw = matchInfo[key];
        if (!raw || raw === 'null') return;
        try {
            const player = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!player || player.team_id == null) return;
            const teamId = String(player.team_id);
            const isMine = player.isTeammate === true || player.isTeammate === '1'
                || player.is_local === true || player.is_local === '1';
            const state = String(player.state || 'alive').toLowerCase();
            const isAlive = state !== 'death';
            if (!match._teamStates[teamId]) match._teamStates[teamId] = { alive: false, isMine: false };
            if (isMine) match._teamStates[teamId].isMine = true;
            if (isAlive) match._teamStates[teamId].alive = true;
        } catch (e) {}
    });
};

const estimatePlacementFromTeamStates = (match) => {
    if (!match?._teamStates) return null;
    let aliveOtherTeams = 0;
    Object.values(match._teamStates).forEach((team) => {
        if (!team.isMine && team.alive) aliveOtherTeams++;
    });
    if (aliveOtherTeams <= 0) return null;
    return Math.min(20, aliveOtherTeams + 1);
};

const applyPlacementEstimate = (match) => {
    if (!match || match._isVictory || match._matchSummaryRank) return null;
    if (match.placement > 0 && match.placement < 20) return match.placement;

    const rosterEstimate = estimatePlacementFromTeamStates(match);
    if (rosterEstimate) {
        match._estimatedPlacement = rosterEstimate;
        match.placement = rosterEstimate;
        return rosterEstimate;
    }

    if (match._squadEliminated && match._lastTeamsAlive) {
        const teamsEstimate = Math.min(20, match._lastTeamsAlive + 1);
        match._estimatedPlacement = teamsEstimate;
        match.placement = teamsEstimate;
        return teamsEstimate;
    }

    return null;
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
    syncTeamRosterFromInfo(info.match_info, match);

    if (data.victory === 'true' || data.victory === true) {
        match._isVictory = true;
        match.placement = 1;
        match._guessedRank = 1;
    }

    if (match._squadEliminated) {
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
    return true;
};

// 1. COMBAT LOG HANDLER
const handleCombatEvent = (parsed, activeMatch) => {
    const localRaw = parsed.local_player_name;
    const attackerRaw = parsed.attackerName || parsed.attacker || "Unknown";
    const victimRaw = parsed.victimName || parsed.victim || "Unknown";
    const weaponRaw = parsed.weaponName || parsed.weapon || "Unknown";

    const impactKind = resolveCombatImpact(parsed);
    if (impactKind === 'unknown') return;

    const isFinalKill = impactKind === 'kill';
    const type = isFinalKill ? 'kill' : 'knockdown';

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
        const victim = window.Utils.cleanName(victimRaw);
        recordCombatLog(activeMatch, {
            type,
            attacker: activeMatch.playerName,
            victim,
            weapon: window.Utils.normalizeWeapon(weaponRaw)
        }, isFinalKill ? 'KILL' : 'KNOCKDOWN');
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

        const activeMatch = window.Store.activeMatch;

        if (data.phase) {
            const newPhase = data.phase.toLowerCase();
            window.CoreController.updateMatch('PHASE', newPhase);

            if (activeMatch && (newPhase === 'loading' || newPhase === 'lobby')) {
                const duration = Date.now() - activeMatch.startTime;
                if (isMatchConcluded(activeMatch) || duration > 120000) {
                    window.CoreController.endMatch();
                }
            }

            if (newPhase === 'legend_selection') {
                const shouldStartNew =
                    !activeMatch
                    || isMatchConcluded(activeMatch)
                    || isEliminated(activeMatch)
                    || (Date.now() - activeMatch.startTime > 480000);

                if (shouldStartNew) {
                    if (activeMatch) window.CoreController.endMatch();
                    setTimeout(() => window.CoreController.startMatch(), 500);
                }
            }
        }

        Object.keys(data).forEach(key => {
            if (key.startsWith('legendSelect_')) {
                try {
                    const p = JSON.parse(data[key]);
                    window.CoreController.updateMatch('ROSTER_INFO', p);
                } catch (e) {}
            }
        });

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

        if (data.totalDamageDealt !== undefined) {
            window.CoreController.updateMatch('DAMAGE_TOTAL', data.totalDamageDealt);
        }

        if (activeMatch) {
            syncTeamRosterFromInfo(info.info?.match_info, activeMatch);
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
                const now = Date.now();
                if (now - lastMatchEndTime < 15000) return;

                const activeMatch = window.Store.activeMatch;
                if (activeMatch) {
                    const isStale = isMatchConcluded(activeMatch)
                        || isEliminated(activeMatch)
                        || (now - activeMatch.startTime > 120000);
                    if (isStale) {
                        window.CoreController.endMatch().then(() => window.CoreController.startMatch());
                    }
                    return;
                }
                console.log("Match Start Event!");
                window.CoreController.startMatch();
                return;
            }

            if (name === 'match_end') {
                const activeMatch = window.Store.activeMatch;

                if (activeMatch && (Date.now() - activeMatch.startTime < 120000)) {
                    const isTeamAlive = activeMatch.teamStats?.some(t => t.state !== 'death');
                    const isReallyOver = activeMatch._isVictory || isEliminated(activeMatch) || !isTeamAlive;
                    if (!isReallyOver) {
                        console.warn('[Match] Ignored early match_end — squad still active');
                        return;
                    }
                }

                lastMatchEndTime = Date.now();
                const matchToEnd = window.Store.activeMatch;
                if (!matchToEnd) {
                    console.warn('[Match] match_end received with no active session');
                    return;
                }

                console.log('[Match] match_end received — scheduling finalize');
                setTimeout(() => {
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
                }
            } else if (name === 'kill_feed') {
                handleCombatEvent(parsed, activeMatch);
            } else if (name === 'death') {
                window.CoreController.updateMatch('SET_DEAD', true);
            } else if (name === 'your_squad_is_eliminated') {
                window.CoreController.updateMatch('SET_DEAD', true);
                activeMatch._squadEliminated = true;
                activeMatch.teamStats?.forEach((teammate) => {
                    if (teammate.state !== 'death') teammate.state = 'death';
                });
                window.EventRouter.estimatePlacementFromGep(activeMatch);
            } else if (name === 'healed_from_ko') {
                window.CoreController.updateMatch('SET_DEAD', false);
                window.CoreController.addEvent({ type: 'revive', desc: 'Revived', victim: 'Me', timestamp: Date.now() });
            } else if (name === 'respawn') {
                console.log("Respawn Event Detected!");
                window.CoreController.updateMatch('SET_DEAD', false);
                window.CoreController.addEvent({ type: 'respawn', desc: 'Respawned from Dropship', victim: 'Me', timestamp: Date.now() });
            } else if (name === 'match_summary') {
                if (parsed.rank) window.CoreController.updateMatch('PLACEMENT', parsed.rank);
                else applyMatchSummaryToMatch(activeMatch, data);
            }
        });
    },

    applyInfoToMatch,

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
                applyPlacementEstimate(match);
            }
        })();
    }
};

window.EventRouter = EventRouter;

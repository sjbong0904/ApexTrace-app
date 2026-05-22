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
            ...info.info?.me
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
            try {
                const tabs = JSON.parse(data.tabs);
                if (tabs.teams) window.CoreController.updateMatch('TEAMS_ALIVE', tabs.teams);
                window.CoreController.updateMatch('SYNC_STATS', {
                    kills: tabs.kills,
                    assists: tabs.assists,
                    damage: tabs.damage,
                    knockdowns: tabs.knockdowns,
                    squadKills: tabs.squad_kills || tabs.squadKills
                });
            } catch (e) {}
        }

        if (data.totalDamageDealt !== undefined && !activeMatch.isDead) {
            window.CoreController.updateMatch('DAMAGE_TOTAL', data.totalDamageDealt);
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
                    if (!isReallyOver) return;
                }

                lastMatchEndTime = Date.now();
                const matchToEnd = window.Store.activeMatch;
                setTimeout(() => {
                    if (window.Store.activeMatch === matchToEnd) {
                        window.CoreController.endMatch();
                    }
                }, 2000);
                return;
            }

            const activeMatch = window.Store.activeMatch;
            if (!activeMatch) return;

            if (name === 'victory' || (name === 'match_state' && data === 'victory')) {
                window.CoreController.updateMatch('VICTORY', true);
                window.CoreController.updateMatch('PLACEMENT', 1);
            }

            if (name === 'kill_feed') {
                handleCombatEvent(parsed, activeMatch);
            } else if (name === 'healed_from_ko') {
                window.CoreController.updateMatch('SET_DEAD', false);
                window.CoreController.addEvent({ type: 'revive', desc: 'Revived', victim: 'Me', timestamp: Date.now() });
            } else if (name === 'respawn') {
                console.log("Respawn Event Detected!");
                window.CoreController.updateMatch('SET_DEAD', false);
                window.CoreController.addEvent({ type: 'respawn', desc: 'Respawned from Dropship', victim: 'Me', timestamp: Date.now() });
            } else if (name === 'match_summary') {
                if (parsed.rank) window.CoreController.updateMatch('PLACEMENT', parsed.rank);
            }
        });
    }
};

window.EventRouter = EventRouter;

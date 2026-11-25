(function() { 
    const getProxyBaseUrl = () =>
        window.PROXY_BASE_URL ?? "https://trace-proxy-server.vercel.app/api";

    const requestProxy = async (endpoint, method, body = null) => {
        try {
            const PROXY_BASE_URL = getProxyBaseUrl();
            const url = `${PROXY_BASE_URL}${endpoint}`;
            const options = { method };
            if (body) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(body);
            }

            const res = await fetch(url, options);
            
            if (!res.ok) {
                console.warn(`[Repository] Proxy Error (${res.status}): ${url}`);
                return null;
            }
            return await res.json();
        } catch (e) {
            console.error(`[Repository] Network Error (${endpoint}):`, e);
            return null;
        }
    };

    // Skip identical consecutive writes so GEP roster spam does not hammer the proxy.
    const lastProfileWrite = new Map();
    const profileWriteFingerprint = (data) => JSON.stringify({
        name: data.name ?? null,
        linked_uid: data.linked_uid ?? null,
        hw: data.hw ?? null,
        platform: data.platform ?? null,
        level: data.level ?? null,
        prestige: data.prestige ?? null,
        rank_score: data.rank_score ?? null,
        rank_name: data.rank_name ?? null,
        legend: data.legend ?? null,
        avatar: data.avatar ?? null,
        role: data.role ?? null,
    });

    const AddressBookModule = {
        findCandidatesByName: async (name) => {
            const PROXY_BASE_URL = getProxyBaseUrl();
            if (!name || name.trim().length < 1) return [];
            
            const cleanName = window.Utils ? window.Utils.stripNameDecorations(name) : name;
            
            try {
                const encodedName = encodeURIComponent(cleanName);
                const res = await fetch(`${PROXY_BASE_URL}/search-candidates?query=${encodedName}`);
                
                if (!res.ok) return [];

                const json = await res.json();
                
                if (json.success && Array.isArray(json.data)) {
                    return json.data; 
                }
                return [];
            } catch (e) {
                console.error("[Repository] Search Error:", e);
                return [];
            }
        },

        fetchUserByUid: async (uid) => {
            if (!uid) return null;
            const res = await requestProxy(`/address-book?uid=${uid}`, 'GET');
            return res ? res.data : null;
        },

        update: async (name, uid, stats = {}) => {
            if (!uid) return;
            const updateData = { 
                uid: String(uid),
                updated_at: new Date().toISOString() 
            };

            if (name && name.trim().length > 0) {
                updateData.name = window.Utils ? window.Utils.stripNameDecorations(name) : name;
            }

            if (stats.linked_uid) updateData.linked_uid = String(stats.linked_uid);
            if (stats.hw !== undefined && stats.hw !== null) updateData.hw = String(stats.hw);
            if (stats.level !== undefined) updateData.level = stats.level;
            if (stats.prestige !== undefined) updateData.prestige = stats.prestige;
            if (stats.rankScore !== undefined) updateData.rank_score = stats.rankScore;
            if (stats.rankName) updateData.rank_name = stats.rankName;
            if (stats.legend) updateData.legend = stats.legend;
            if (stats.avatar) updateData.avatar = stats.avatar;

            const fingerprint = profileWriteFingerprint(updateData);
            if (lastProfileWrite.get(String(uid)) === fingerprint) return;
            await requestProxy('/address-book', 'POST', { updates: [updateData] });
            lastProfileWrite.set(String(uid), fingerprint);
        },

        bulkUpdate: async (rosterList) => {
            if (!rosterList?.length) return;
    
            const updates = [];
    
            rosterList.forEach(u => {
                const cleanName = window.Utils ? window.Utils.stripNameDecorations(u.name) : u.name;
                if (cleanName && cleanName.trim().length > 0) {
                    updates.push({
                        uid: String(u.uid),
                        name: cleanName,
                        linked_uid: u.linked_uid ? String(u.linked_uid) : null,
                        hw: (u.hw !== undefined && u.hw !== null) ? String(u.hw) : null,
                        platform: u.platform ?? null,
                        updated_at: new Date().toISOString()
                    });
                }
            });

            // A full roster (~60) in one POST pushed the proxy past its 10s limit (504).
            // Send sequential chunks so each function invocation stays well under it.
            const CHUNK_SIZE = 20;
            for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
                const chunk = updates.slice(i, i + CHUNK_SIZE);
                try {
                    await requestProxy('/address-book', 'POST', { updates: chunk });
                } catch (e) {
                    console.error(`[Repository] Bulk Update Failed (chunk ${i / CHUNK_SIZE + 1}):`, e);
                }
            }
        },
    };

    const HistoryStorageModule = {
        fetch: async (uid, options = {}) => {
            try {
                const PROXY_BASE_URL = getProxyBaseUrl();
                const view = options.view ?? 'summary';
                const res = await fetch(`${PROXY_BASE_URL}/history?uid=${encodeURIComponent(uid)}&view=${encodeURIComponent(view)}`);
                if (!res.ok) return [];
                const json = await res.json();
                return json.history || [];
            } catch (e) {
                return [];
            }
        },

        fetchDetail: async (uid, matchId) => {
            try {
                const PROXY_BASE_URL = getProxyBaseUrl();
                const res = await fetch(
                    `${PROXY_BASE_URL}/history?uid=${encodeURIComponent(uid)}&matchId=${encodeURIComponent(matchId)}&view=detail`,
                );
                if (!res.ok) return null;
                const json = await res.json();
                return Array.isArray(json.history) ? (json.history[0] ?? null) : null;
            } catch (e) {
                return null;
            }
        },

        save: async (uid, matchData) => {
            const mode = (matchData.mode || "").toLowerCase();
            if (mode.includes('firing') || mode.includes('training')) {
                return [];
            }

            const result = await requestProxy('/history', 'POST', { uid, match: matchData });
            
            if (result && result.success) {
                // GEP RP that arrived before this upload (pending_rp) was pinned server-side.
                if (result.rpApplied && typeof window.CoreController?.onRemoteRpApplied === 'function') {
                    window.CoreController.onRemoteRpApplied(result.rpApplied);
                }
                window.Utils.matchLog('Saved via proxy', {
                    matchId: matchData?.matchId,
                    missingSignals: matchData?.missingSignals,
                    legend: matchData?.legend,
                    placement: matchData?.placement,
                });
                return result.history;
            } else {
                window.Utils.matchLog('Save failed via proxy', {
                    matchId: matchData?.matchId,
                });
                return [];
            }
        }
    };

    const DailyRankSnapshotModule = {
        upsert: async (uid, user, source = 'als') => {
            if (!uid || !user) return null;
            const rankScore = Number(user.rankScore ?? user.rank_score);
            if (!Number.isFinite(rankScore)) return null;

            const snapshotDate = new Date().toISOString().slice(0, 10);
            const payload = {
                uid: String(uid),
                snapshot_date: snapshotDate,
                rank_score: rankScore,
                rank_name: user.rankName || user.rank_name || null,
                level: user.level ?? null,
                prestige: user.prestige ?? null,
                legend: user.legend ?? null,
                source
            };

            try {
                const PROXY_BASE_URL = getProxyBaseUrl();
                const res = await fetch(`${PROXY_BASE_URL}/rank-snapshots`, {
                    method: 'POST',
                    // Keep this a simple request so missing/deploying proxy routes do not fail at CORS preflight.
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                    body: JSON.stringify({ snapshot: payload })
                });

                // The proxy endpoint may be deployed separately from this extension.
                if (res.status === 404) return null;
                if (!res.ok) return null;

                return await res.json();
            } catch {
                return null;
            }
        }
    };

    /** GEP player_stats snapshots of the local player (POST/GET /account-stats). */
    const AccountStatsModule = {
        save: async (uid, { name = null, legend = null, snapshot } = {}) => {
            if (!uid || !snapshot) return null;
            try {
                const res = await fetch(`${getProxyBaseUrl()}/account-stats`, {
                    method: 'POST',
                    // Simple request (no CORS preflight), same as /rank-snapshots.
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                    body: JSON.stringify({ uid: String(uid), name, legend, snapshot }),
                });
                if (res.status === 404) return null; // proxy not deployed yet
                return await res.json().catch(() => null);
            } catch (e) {
                console.warn('[Repository] account-stats save failed:', e);
                return null;
            }
        },

        fetch: async (uid) => {
            if (!uid) return null;
            const res = await requestProxy(`/account-stats?uid=${encodeURIComponent(uid)}`, 'GET');
            return res?.success ? (res.data ?? null) : null;
        },
    };

    window.CloudRepository = {
        saveAccountStats: AccountStatsModule.save,
        fetchAccountStats: AccountStatsModule.fetch,
        findUidByName: async (name) => {
            const candidates = await AddressBookModule.findCandidatesByName(name);
            return candidates.length > 0 ? candidates[0].uid : null;
        },
        findCandidatesByName: AddressBookModule.findCandidatesByName,
        fetchUserByUid: AddressBookModule.fetchUserByUid,
        updateAddressBook: AddressBookModule.update,
        updateAddressBookBulk: AddressBookModule.bulkUpdate,
        
        fetchHistoryFile: HistoryStorageModule.fetch,
        fetchMatchDetail: HistoryStorageModule.fetchDetail,
        appendMatchHistory: HistoryStorageModule.save, 
        upsertDailyRankSnapshot: DailyRankSnapshotModule.upsert,
        
        listArchives: async () => [],
        loadArchiveFile: async () => []
    };

})();
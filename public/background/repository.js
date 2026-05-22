// src/background/repository.js
console.log("Initializing Cloud Repository (Proxy Mode)");

(function() { 
    const getProxyBaseUrl = () =>
        window.PROXY_BASE_URL ?? "https://apex-trace.vercel.app/api";

    // 공통 Fetch 헬퍼
    const requestProxy = async (endpoint, method, body = null) => {
        try {
            const separator = endpoint.includes('?') ? '&' : '?';
            const PROXY_BASE_URL = getProxyBaseUrl();
            const url = `${PROXY_BASE_URL}${endpoint}${separator}t=${Date.now()}`;
            const options = { method };
            if (body) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(body);
            }

            const res = await fetch(url, options);
            
            // 404 등 에러 처리
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

    const AddressBookModule = {
        // 이름으로 후보군 찾기 (Autocomplete)
        findCandidatesByName: async (name) => {
            const PROXY_BASE_URL = getProxyBaseUrl();
            if (!name || name.trim().length < 1) return [];
            
            const cleanName = window.Utils ? window.Utils.cleanName(name) : name;
            
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

        // 🌟 [수정] 단일 유저 업데이트: 정제된 객체(stats)를 받아 DB 스키마에 맞게 매핑
        update: async (name, uid, stats = {}) => {
            if (!uid) return;
            const updateData = { 
                uid: String(uid), // 🌟 확실한 형변환
                updated_at: new Date().toISOString() 
            };

            if (name && name.trim().length > 0) {
                updateData.name = window.Utils ? window.Utils.cleanName(name) : name;
            } else {
                console.warn(`[Repository] Skipping nickname update for ${uid} (Invalid Name)`);
            }

            // 🌟 융합 시스템: linked_uid와 hw를 텍스트 타입으로 안전하게 삽입
            if (stats.linked_uid) updateData.linked_uid = String(stats.linked_uid);
            if (stats.hw !== undefined && stats.hw !== null) updateData.hw = String(stats.hw);

            // API에서 가져온 상세 스탯 업데이트
            if (stats.level !== undefined) updateData.level = stats.level;
            if (stats.prestige !== undefined) updateData.prestige = stats.prestige;
            if (stats.rankScore !== undefined) updateData.rank_score = stats.rankScore;
            if (stats.rankName) updateData.rank_name = stats.rankName;
            if (stats.legend) updateData.legend = stats.legend;
            if (stats.avatar) updateData.avatar = stats.avatar;

            await requestProxy('/address-book', 'POST', { updates: [updateData] });
        },

        bulkUpdate: async (rosterList) => {
            if (!rosterList?.length) return;
    
            const updates = [];
    
            rosterList.forEach(u => {
                const cleanName = window.Utils ? window.Utils.cleanName(u.name) : u.name;
                if (cleanName && cleanName.trim().length > 0) {
                    updates.push({
                        uid: String(u.uid),
                        name: cleanName,
                        linked_uid: u.linked_uid ? String(u.linked_uid) : null,
                        hw: (u.hw !== undefined && u.hw !== null) ? String(u.hw) : null,
                        platform: u.platform ?? null,  // ✅ 추가
                        updated_at: new Date().toISOString()
                    });
                }
            });

            if (updates.length > 0) {
                try {
                    console.log(`[Repository] Sending ${updates.length} updates to DB...`);
                    await requestProxy('/address-book', 'POST', { updates });
                    console.log(`[Repository] Bulk Update Success.`);
                } catch (e) {
                    console.error(`[Repository] Bulk Update Failed:`, e);
                }
            } else {
                console.warn(`[Repository] No valid updates to send.`);
            }
        },
    };

    const HistoryStorageModule = {
        // 히스토리 불러오기 (백엔드가 융합해서 주므로 uid만 던지면 됨)
        fetch: async (uid) => {
            try {
                const res = await fetch(`${PROXY_BASE_URL}/history?uid=${uid}`);
                if (!res.ok) return [];
                const json = await res.json();
                return json.history || [];
            } catch (e) {
                return [];
            }
        },

        // 히스토리 저장하기 (백엔드가 메인 UID 찾아서 저장해 줌)
        save: async (uid, matchData) => {
            const mode = (matchData.mode || "").toLowerCase();
            if (mode.includes('firing') || mode.includes('training')) return [];

            console.log("☁️ Uploading match to Proxy...");
            const result = await requestProxy('/history', 'POST', { uid, match: matchData });
            
            if (result && result.success) {
                console.log("✅ Match Saved via Proxy.");
                return result.history;
            } else {
                console.warn("❌ Match Save Failed (Server may be busy).");
                return [];
            }
        }
    };

    // EXPORT
    window.CloudRepository = {
        findUidByName: async (name) => {
            const candidates = await AddressBookModule.findCandidatesByName(name);
            return candidates.length > 0 ? candidates[0].uid : null;
        },
        findCandidatesByName: AddressBookModule.findCandidatesByName,
        fetchUserByUid: AddressBookModule.fetchUserByUid,
        updateAddressBook: AddressBookModule.update,
        updateAddressBookBulk: AddressBookModule.bulkUpdate,
        
        fetchHistoryFile: HistoryStorageModule.fetch,
        appendMatchHistory: HistoryStorageModule.save, 
        
        listArchives: async () => [],
        loadArchiveFile: async () => []
    };

})();
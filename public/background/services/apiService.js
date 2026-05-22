// src/background/services/apiService.js
const getApiBaseUrl = () => window.PROXY_BASE_URL ?? "https://apex-trace.vercel.app/api";

const APIService = {
    fetchUserStats: async (query, type) => {
        const API_BASE_URL = getApiBaseUrl();
        if (!query) return null;
        const safeQuery = encodeURIComponent(query);
        const url = `${API_BASE_URL}/apex-stats?query=${safeQuery}&type=${type}&t=${Date.now()}`;
        
        try {
            // ✅ GET 요청에 Content-Type 제거
            const response = await fetch(url);
            
            if (!response.ok) return null;
            const text = await response.text();
            if (!text) return null;

            let json;
            try { json = JSON.parse(text); } catch (e) { return null; }

            if (!json.success || !json.data) return null;
            return json.data;

        } catch (error) { 
            console.error("[APIService] Stats Fetch Error:", error);
            return null; 
        }
    },

    getArchivedMatches: async (uid, lastMatchTime) => {
        if (!uid || !lastMatchTime) return null;
        const API_BASE_URL = getApiBaseUrl();
        const safeUid = encodeURIComponent(uid);
        const url = `${API_BASE_URL}/history?uid=${safeUid}&cursor=${lastMatchTime}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) return null;

            const text = await response.text();
            if (!text) return null;

            let json;
            try { json = JSON.parse(text); } catch (e) { return null; }

            const matches = json.history;
            if (!matches) return null;

            console.log(`[APIService] Archive Downloaded: ${matches.length} matches.`);
            return matches;

        } catch (error) { 
            console.error("[APIService] Archive Fetch Error:", error);
            return null; 
        }
    }
};

window.APIService = APIService;
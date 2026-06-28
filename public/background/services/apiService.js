// src/background/services/apiService.js
const getApiBaseUrl = () => window.PROXY_BASE_URL ?? "https://trace-proxy-server.vercel.app/api";

const parseJsonArrayHistory = (text) => {
    if (!text) return [];
    let json;
    try { json = JSON.parse(text); } catch (e) { return []; }
    return Array.isArray(json.history) ? json.history : [];
};

const APIService = {
    fetchUserStats: async (query, type) => {
        const API_BASE_URL = getApiBaseUrl();
        if (!query) return null;
        const safeQuery = encodeURIComponent(query);
        const url = `${API_BASE_URL}/apex-stats?query=${safeQuery}&type=${type}&t=${Date.now()}`;

        try {
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

    getHistoryPage: async (uid, cursor, options = {}) => {
        if (!uid) return [];
        const API_BASE_URL = getApiBaseUrl();
        const safeUid = encodeURIComponent(uid);
        const safeCursor = encodeURIComponent(cursor || 0);
        const view = options.view ?? 'summary';
        const url = `${API_BASE_URL}/history?uid=${safeUid}&cursor=${safeCursor}&view=${encodeURIComponent(view)}`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            return parseJsonArrayHistory(await response.text());
        } catch (error) {
            console.error("[APIService] History Page Fetch Error:", error);
            return [];
        }
    },

    getMatchDetail: async (uid, matchId) => {
        if (!uid || !matchId) return null;
        const API_BASE_URL = getApiBaseUrl();
        const url = `${API_BASE_URL}/history?uid=${encodeURIComponent(uid)}&matchId=${encodeURIComponent(matchId)}&view=detail`;

        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const text = await response.text();
            if (!text) return null;
            const history = parseJsonArrayHistory(text);
            return history[0] ?? null;
        } catch (error) {
            console.error("[APIService] Match Detail Fetch Error:", error);
            return null;
        }
    },

    /** @deprecated use getHistoryPage */
    getArchivedMatches: async (uid, cursor) => APIService.getHistoryPage(uid, cursor),

    getHistorySince: async (uid, startDate) => {
        if (!uid) return [];
        const API_BASE_URL = getApiBaseUrl();
        const safeUid = encodeURIComponent(uid);
        const safeStartDate = encodeURIComponent(startDate || 1);
        const url = `${API_BASE_URL}/history?uid=${safeUid}&startDate=${safeStartDate}&view=summary`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            return parseJsonArrayHistory(await response.text());
        } catch (error) {
            console.error("[APIService] History Fetch Error:", error);
            return [];
        }
    },

    getPlayerStats: async (uid, seasonId, mode = 'ALL') => {
        if (!uid || seasonId == null) return null;
        const API_BASE_URL = getApiBaseUrl();
        const url = `${API_BASE_URL}/player-stats?uid=${encodeURIComponent(uid)}&season_id=${encodeURIComponent(seasonId)}&mode=${encodeURIComponent(mode)}`;

        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const text = await response.text();
            if (!text) return null;
            return JSON.parse(text);
        } catch (error) {
            console.error("[APIService] Player Stats Fetch Error:", error);
            return null;
        }
    },

    getSeasons: async () => {
        const API_BASE_URL = getApiBaseUrl();
        try {
            const response = await fetch(`${API_BASE_URL}/seasons`);
            if (!response.ok) return [];
            const json = await response.json();
            return Array.isArray(json.seasons) ? json.seasons : [];
        } catch (error) {
            console.error("[APIService] Seasons Fetch Error:", error);
            return [];
        }
    },
};

window.APIService = APIService;

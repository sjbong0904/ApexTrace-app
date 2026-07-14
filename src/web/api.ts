const API_BASE_URL = 'https://trace-proxy-server.vercel.app/api';
import { supabase } from '../lib/supabase';
import { normalizeHistoryForFrontend } from '../utils/matchNormalizer';

export interface SearchCandidate {
    uid: string;
    name: string;
    rank_score?: number;
    rank_name?: string;
    level?: number;
    legend?: string;
}

export interface RemoteUserStats {
    uid?: string;
    name?: string;
    level?: number;
    prestige?: number;
    rankName?: string;
    rankScore?: number;
    legend?: string;
    avatar?: string;
}

export interface SeasonConfig {
    id: number;
    name: string;
    startTime: number;
    endTime: number | null;
}

const safeJson = async <T>(response: Response): Promise<T | null> => {
    if (!response.ok) return null;
    try {
        return await response.json() as T;
    } catch {
        return null;
    }
};

export const searchCandidates = async (query: string): Promise<SearchCandidate[]> => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const url = `${API_BASE_URL}/search-candidates?query=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url);
    const json = await safeJson<{ success?: boolean; data?: SearchCandidate[] }>(response);
    if (!json?.success || !Array.isArray(json.data)) return [];
    return json.data;
};

export const fetchUserStatsByUid = async (uid: string): Promise<RemoteUserStats | null> => {
    if (!uid) return null;
    const url = `${API_BASE_URL}/apex-stats?query=${encodeURIComponent(uid)}&type=uid&t=${Date.now()}`;
    const response = await fetch(url);
    const json = await safeJson<{ success?: boolean; data?: RemoteUserStats }>(response);
    if (!json?.success || !json.data) return null;
    return json.data;
};

export const fetchHistoryByUid = async (uid: string): Promise<any[]> => {
    if (!uid) return [];
    const url = `${API_BASE_URL}/history?uid=${encodeURIComponent(uid)}&t=${Date.now()}`;
    const response = await fetch(url);
    const json = await safeJson<{ history?: any[] }>(response);
    return normalizeHistoryForFrontend(json?.history);
};

export const fetchSeasons = async (): Promise<SeasonConfig[]> => {
    const { data, error } = await supabase
        .from('seasons')
        .select('id, name, start_time, end_time')
        .order('id', { ascending: false });

    if (error || !data?.length) {
        return [];
    }

    return data
        .map((season) => ({
            id: Number(season.id),
            name: String(season.name ?? `Season ${season.id}`),
            startTime: season.start_time != null ? Number(season.start_time) : 0,
            endTime: season.end_time != null ? Number(season.end_time) : null,
        }))
        .filter((season: SeasonConfig) => Number.isFinite(season.id))
        .sort((a: SeasonConfig, b: SeasonConfig) => b.startTime - a.startTime);
};

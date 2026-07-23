import { supabase } from './supabase';

export const PROXY_BASE =
    import.meta.env.VITE_PROXY_URL || 'https://trace-proxy-server.vercel.app';

async function authHeaders(): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Not signed in');
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

export async function adminGet<T = unknown>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${PROXY_BASE}${path}`);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
        }
    }
    const res = await fetch(url.toString(), { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || res.statusText);
    return json as T;
}

export async function adminMutate<T = unknown>(
    path: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body: Record<string, unknown>,
): Promise<T> {
    const res = await fetch(`${PROXY_BASE}${path}`, {
        method,
        headers: await authHeaders(),
        body: JSON.stringify({ ...body, confirm: true }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || res.statusText);
    return json as T;
}

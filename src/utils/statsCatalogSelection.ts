/** In-session legend/weapon picker ids. Cleared when the app window fully closes. */

type CatalogKind = 'legend' | 'weapon';

const STORAGE_KEYS: Record<CatalogKind, string> = {
    legend: 'apex_stats_selected_legend',
    weapon: 'apex_stats_selected_weapon',
};

const memory: Record<CatalogKind, string | null> = {
    legend: null,
    weapon: null,
};

const readSession = (kind: CatalogKind): string | null => {
    try {
        const value = sessionStorage.getItem(STORAGE_KEYS[kind]);
        return value && value.trim() ? value : null;
    } catch {
        return null;
    }
};

export function getSessionCatalogId(kind: CatalogKind): string | null {
    if (memory[kind]) return memory[kind];
    const stored = readSession(kind);
    if (stored) memory[kind] = stored;
    return stored;
}

export function setSessionCatalogId(kind: CatalogKind, id: string | null): void {
    memory[kind] = id;
    try {
        if (id) sessionStorage.setItem(STORAGE_KEYS[kind], id);
        else sessionStorage.removeItem(STORAGE_KEYS[kind]);
    } catch {
        // Private mode / storage blocked — memory still holds the selection.
    }
}

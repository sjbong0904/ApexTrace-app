/** Saved when GEP never provided game_mode but the match clearly happened. */
export const UNKNOWN_MODE_FALLBACK = 'BR';

export function isMissingGameMode(mode?: string | null): boolean {
    const normalized = (mode ?? '').trim().toLowerCase();
    return !normalized || normalized === 'unknown';
}

export function isUnknownModeFallback(mode?: string | null): boolean {
    return (mode ?? '').trim().toUpperCase() === UNKNOWN_MODE_FALLBACK;
}

export function isKnownPlayableMode(mode?: string | null): boolean {
    const normalized = (mode ?? '').toLowerCase();
    return normalized.includes('ranked') || normalized.includes('trio') || normalized.includes('duo');
}

export function isSupportedMode(mode?: string | null): boolean {
    return isKnownPlayableMode(mode) || isUnknownModeFallback(mode);
}

export function matchesHistoryTab(
    mode: string | undefined,
    tab: 'BR' | 'RANKED' | 'TRIO' | 'DUO',
): boolean {
    if (isUnknownModeFallback(mode)) return tab === 'BR';

    const normalized = (mode ?? '').toLowerCase();
    if (tab === 'BR') return isKnownPlayableMode(mode);
    if (tab === 'RANKED') return normalized.includes('ranked');
    if (tab === 'TRIO') return normalized.includes('trio') && !normalized.includes('ranked');
    if (tab === 'DUO') return normalized.includes('duo') && !normalized.includes('ranked');
    return false;
}

export function matchesStatisticsMode(
    mode: string | undefined,
    selectedMode: 'ALL' | 'RANKED' | 'TRIO' | 'DUO',
): boolean {
    if (!isSupportedMode(mode)) return false;
    if (selectedMode === 'ALL') return true;
    return matchesHistoryTab(mode, selectedMode);
}

export function getModeColor(mode?: string | null): string {
    const normalized = (mode ?? '').toLowerCase();
    if (isUnknownModeFallback(mode)) return 'var(--color-mode-other)';
    if (normalized.includes('ranked')) return 'var(--color-mode-ranked)';
    if (normalized.includes('trio')) return 'var(--color-mode-trio)';
    if (normalized.includes('duo')) return 'var(--color-mode-duo)';
    return 'var(--color-mode-other)';
}

export function getModeDisplayLabel(mode?: string | null): string {
    if (isUnknownModeFallback(mode)) return UNKNOWN_MODE_FALLBACK;
    if (isMissingGameMode(mode)) return 'Unknown';
    return mode ?? 'Unknown';
}

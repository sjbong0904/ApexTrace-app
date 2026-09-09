import { LocalDB } from './LocalDB';
import { clearRecentSearches } from './recentSearches';

/** Clears all locally cached app data and relaunches the extension. */
export async function resetAppCache(): Promise<void> {
    await LocalDB.clearAll();
    clearRecentSearches('app');
    localStorage.clear();

    if (typeof overwolf !== 'undefined' && overwolf.extensions?.relaunch) {
        overwolf.extensions.relaunch();
        return;
    }

    window.location.reload();
}

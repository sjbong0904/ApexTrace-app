import { LocalDB } from './LocalDB';

/** Clears all locally cached app data and relaunches the extension. */
export async function resetAppCache(): Promise<void> {
    await LocalDB.clearAll();
    localStorage.clear();

    if (typeof overwolf !== 'undefined' && overwolf.extensions?.relaunch) {
        overwolf.extensions.relaunch();
        return;
    }

    window.location.reload();
}

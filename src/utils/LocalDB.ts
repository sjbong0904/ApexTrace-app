import { preferRicherMatch, type HistoryRow } from './historySync';
import type { Match } from '../types';

/** Row as stored: the match plus its owner key. */
export type StoredMatch = Match & { ownerUid: string; compositeId: string };

const DB_NAME = 'ApexTraceDB';
const STORE_NAME = 'match_history';
const DB_VERSION = 2; 

export const LocalDB = {
    open: () => {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = () => {
                const db = request.result;
                // Version bumps recreate the store (wipes local cache). Cloud history is the source of truth.
                if (db.objectStoreNames.contains(STORE_NAME)) {
                    db.deleteObjectStore(STORE_NAME);
                }

                const store = db.createObjectStore(STORE_NAME, { keyPath: 'compositeId' });
                store.createIndex('ownerUid', 'ownerUid', { unique: false });
            };
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event);
        });
    },

    saveMatches: async <T extends HistoryRow>(uid: string, matches: (T | null | undefined)[]) => {
        const db = await LocalDB.open();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            // Collapse duplicate matchIds first: two get()s for the same key would both see the
            // pre-batch row, and the later put() would drop the earlier one's merge.
            const byId = new Map<string, T>();
            for (const match of matches) {
                if (!match?.matchId) continue;
                const id = String(match.matchId);
                byId.set(id, preferRicherMatch(byId.get(id), match));
            }

            // get + put share this readwrite transaction, and IndexedDB serializes overlapping
            // readwrite transactions, so a concurrent save can't slip between the read and the write.
            // Merging keeps detail (events/path/ringRounds…) when a summary-only row arrives.
            byId.forEach((match, id) => {
                const compositeId = `${uid}_${id}`;
                const request = store.get(compositeId);
                request.onsuccess = () => {
                    store.put({
                        ...preferRicherMatch(request.result, match),
                        ownerUid: uid,
                        compositeId,
                    });
                };
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    getMatchesByUid: async (uid: string) => {
        const db = await LocalDB.open();
        return new Promise<StoredMatch[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('ownerUid');
            
            const request = index.getAll(IDBKeyRange.only(uid));

            request.onsuccess = () => {
                const matches = request.result as StoredMatch[];
                matches.sort((a, b) => (b.startTime || b.endTime) - (a.startTime || a.endTime));
                resolve(matches);
            };
            request.onerror = () => reject(request.error);
        });
    },

    clearAll: async () => {
        const db = await LocalDB.open();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
};
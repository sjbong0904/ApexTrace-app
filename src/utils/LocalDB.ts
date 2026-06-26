// src/utils/LocalDB.ts

const DB_NAME = 'ApexTraceDB';
const STORE_NAME = 'match_history';
const DB_VERSION = 2; 

export const LocalDB = {
    open: () => {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                
                if (db.objectStoreNames.contains(STORE_NAME)) {
                    db.deleteObjectStore(STORE_NAME);
                }

                const store = db.createObjectStore(STORE_NAME, { keyPath: 'compositeId' });
                store.createIndex('ownerUid', 'ownerUid', { unique: false });
            };
            
            request.onsuccess = (event: any) => resolve(event.target.result);
            request.onerror = (event) => reject(event);
        });
    },

    saveMatches: async (uid: string, matches: any[]) => {
        const db = await LocalDB.open();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            matches.forEach(match => {
                const record = {
                    ...match,
                    ownerUid: uid,
                    compositeId: `${uid}_${match.matchId}`
                };
                store.put(record); 
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    getMatchesByUid: async (uid: string) => {
        const db = await LocalDB.open();
        return new Promise<any[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('ownerUid');
            
            const request = index.getAll(IDBKeyRange.only(uid));

            request.onsuccess = () => {
                const matches = request.result;
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
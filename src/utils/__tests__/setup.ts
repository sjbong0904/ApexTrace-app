// Node 25 exposes a non-functional global `localStorage` unless --localstorage-file is set;
// modules like i18n.ts read it at import time, so give tests an in-memory one.
class MemoryStorage {
    private map = new Map<string, string>();
    get length() { return this.map.size; }
    clear() { this.map.clear(); }
    getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
    key(i: number) { return [...this.map.keys()][i] ?? null; }
    removeItem(key: string) { this.map.delete(key); }
    setItem(key: string, value: string) { this.map.set(key, String(value)); }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true });
}

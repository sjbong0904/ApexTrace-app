import { useEffect, useState, type ReactNode } from 'react';

/** App-facing path. The files are not in the package; they are saved under Overwolf app data after download. */
export const LOCAL_IMAGE_ROOT = '/images';

/** Source of truth. A file that is not on disk yet is downloaded from here once. */
export const REMOTE_IMAGE_ROOT =
    'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images';

const REMOTE_MARKER = '/object/public/images/';

const memory = new Map<string, string>();
/** 1×1 transparent gif. Used so a missing `/images/` file never paints the broken-image icon. */
const IMAGE_PLACEHOLDER =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Blob URL already in memory for this file, or '' if it still has to be read from disk. */
export function peekStoredUrl(fileOrUrl: string | null | undefined): string {
    if (!fileOrUrl) return '';
    return memory.get(remoteImageUrl(fileOrUrl)) ?? '';
}
const inflight = new Map<string, Promise<string>>();
const DISK_DIR = 'image-cache';
const IDB_NAME = 'apex-image-store';
const IDB_STORE = 'files';

function cleanFile(file: string): string {
    return file.replace(/^\/+/, '');
}

/** `events/kill.png` or a full images URL → `/images/events/kill.png`. */
export function localImageUrl(fileOrUrl: string): string {
    if (!fileOrUrl) return fileOrUrl;
    if (fileOrUrl.startsWith(`${LOCAL_IMAGE_ROOT}/`)) return fileOrUrl;
    const marker = fileOrUrl.indexOf(REMOTE_MARKER);
    const file = marker >= 0
        ? decodeURIComponent(fileOrUrl.slice(marker + REMOTE_MARKER.length))
        : cleanFile(fileOrUrl);
    if (file.startsWith('http://') || file.startsWith('https://')) return fileOrUrl;
    return `${LOCAL_IMAGE_ROOT}/${file}`;
}

/**
 * Historical name: previews are no longer shipped (package size).
 * Callers still get the canonical `/images/<file>` path, cached after the first Supabase fetch.
 */
export function previewImageUrl(fileOrUrl: string): string {
    const local = localImageUrl(fileOrUrl);
    const prefix = `${LOCAL_IMAGE_ROOT}/preview/`;
    if (local.startsWith(prefix)) return `${LOCAL_IMAGE_ROOT}/${local.slice(prefix.length)}`;
    return local;
}

/** Same file on Supabase. */
export function remoteImageUrl(fileOrUrl: string): string {
    if (!fileOrUrl) return fileOrUrl;
    const marker = fileOrUrl.indexOf(REMOTE_MARKER);
    if (marker >= 0 && !fileOrUrl.startsWith(LOCAL_IMAGE_ROOT)) return fileOrUrl;

    let file = fileOrUrl;
    if (file.startsWith(`${LOCAL_IMAGE_ROOT}/`)) file = file.slice(LOCAL_IMAGE_ROOT.length + 1);
    else if (marker >= 0) file = decodeURIComponent(file.slice(marker + REMOTE_MARKER.length));
    file = cleanFile(file);
    if (file.startsWith('preview/')) file = file.slice('preview/'.length);
    if (file.startsWith('http://') || file.startsWith('https://')) return file;
    const encoded = file.split('/').map((part) => encodeURIComponent(decodeURIComponent(part))).join('/');
    return `${REMOTE_IMAGE_ROOT}/${encoded}`;
}

function fileFromLocalUrl(localUrl: string): string | null {
    try {
        const url = new URL(localUrl, window.location.origin);
        const prefix = `${LOCAL_IMAGE_ROOT}/`;
        if (!url.pathname.startsWith(prefix)) return null;
        let file = decodeURIComponent(url.pathname.slice(prefix.length));
        if (file.startsWith('preview/')) file = file.slice('preview/'.length);
        return file || null;
    } catch {
        return null;
    }
}

function mimeFor(file: string): string {
    const ext = file.split('.').pop()?.toLowerCase();
    if (ext === 'svg') return 'image/svg+xml';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    return 'image/png';
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 0x4000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function base64ToBlob(b64: string, type: string): Blob {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type });
}

function safeRelative(file: string): string {
    const parts = file.split('/').filter((part) => part && part !== '.' && part !== '..');
    return `${DISK_DIR}\\${parts.join('\\')}.b64`;
}

type IoResult = { success?: boolean; exist?: boolean; found?: boolean; content?: string; path?: string };

function overwolfIo(): {
    writeFileContents: (path: string, content: string, encoding: string, triggerUac: boolean, cb: (r: IoResult) => void) => void;
    readFileContents: (path: string, encoding: string, cb: (r: IoResult) => void) => void;
    exist: (path: string, cb: (r: IoResult) => void) => void;
    appData: () => Promise<string | null>;
} | null {
    const ow = (window as unknown as {
        overwolf?: {
            io?: {
                writeFileContents?: (path: string, content: string, encoding: string, triggerUac: boolean, cb: (r: IoResult) => void) => void;
                readFileContents?: (path: string, encoding: string, cb: (r: IoResult) => void) => void;
                exist?: (path: string, cb: (r: IoResult) => void) => void;
            };
            extensions?: {
                io?: {
                    enums?: { StorageSpace?: { appData?: string } };
                    getStoragePath?: (space: string, cb: (r: IoResult) => void) => void;
                };
            };
        };
    }).overwolf;
    const io = ow?.io;
    const ext = ow?.extensions?.io;
    if (!io?.writeFileContents || !io.readFileContents || !io.exist || !ext?.getStoragePath) return null;

    return {
        writeFileContents: io.writeFileContents.bind(io),
        readFileContents: io.readFileContents.bind(io),
        exist: io.exist.bind(io),
        appData: () => new Promise((resolve) => {
            const space = ext.enums?.StorageSpace?.appData ?? 'appData';
            ext.getStoragePath!(space, (result) => {
                resolve(result?.success && result.path ? result.path : null);
            });
        }),
    };
}

let appDataRoot: Promise<string | null> | null = null;

function diskRoot(): Promise<string | null> {
    if (!appDataRoot) {
        const io = overwolfIo();
        appDataRoot = io ? io.appData() : Promise.resolve(null);
    }
    return appDataRoot;
}

function diskFile(root: string, file: string): string {
    return `${root}\\${safeRelative(file)}`;
}

function fileExists(path: string): Promise<boolean> {
    const io = overwolfIo();
    if (!io) return Promise.resolve(false);
    return new Promise((resolve) => {
        io.exist(path, (result) => {
            resolve(result?.exist === true || result?.found === true);
        });
    });
}

function readBase64(path: string): Promise<string | null> {
    const io = overwolfIo();
    if (!io) return Promise.resolve(null);
    return new Promise((resolve) => {
        io.readFileContents(path, 'UTF8', (result) => {
            resolve(result?.success && result.content ? result.content : null);
        });
    });
}

function writeBase64(path: string, content: string): Promise<boolean> {
    const io = overwolfIo();
    if (!io) return Promise.resolve(false);
    return new Promise((resolve) => {
        io.writeFileContents(path, content, 'UTF8', false, (result) => {
            resolve(result?.success !== false);
        });
    });
}

function openIdb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(IDB_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbGet(key: string): Promise<Blob | null> {
    try {
        const db = await openIdb();
        return await new Promise((resolve) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const request = tx.objectStore(IDB_STORE).get(key);
            request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function idbPut(key: string, blob: Blob): Promise<void> {
    try {
        const db = await openIdb();
        await new Promise<void>((resolve) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(blob, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    } catch {
        /* the image still displays for this session */
    }
}

function remember(remoteUrl: string, blob: Blob): string {
    const blobUrl = URL.createObjectURL(blob);
    memory.set(remoteUrl, blobUrl);
    return blobUrl;
}

/** Disk (Overwolf app data) or IndexedDB hit → blob URL. Miss → one Supabase download, then saved. */
export function cachedObjectUrl(remoteUrl: string): Promise<string> {
    const remembered = memory.get(remoteUrl);
    if (remembered) return Promise.resolve(remembered);
    const pending = inflight.get(remoteUrl);
    if (pending) return pending;

    const task = (async () => {
        const file = fileFromLocalUrl(localImageUrl(remoteUrl));
        try {
            const root = await diskRoot();
            if (root && file) {
                const path = diskFile(root, file);
                if (await fileExists(path)) {
                    const stored = await readBase64(path);
                    if (stored) return remember(remoteUrl, base64ToBlob(stored, mimeFor(file)));
                }
            } else {
                const stored = await idbGet(remoteUrl);
                if (stored) return remember(remoteUrl, stored);
            }

            const res = await fetch(remoteUrl);
            if (!res.ok) return remoteUrl;
            const bytes = new Uint8Array(await res.arrayBuffer());
            const blob = new Blob([bytes], { type: mimeFor(file || remoteUrl) });
            if (root && file) {
                await writeBase64(diskFile(root, file), bytesToBase64(bytes));
            } else {
                await idbPut(remoteUrl, blob);
            }
            return remember(remoteUrl, blob);
        } catch {
            return remoteUrl;
        } finally {
            inflight.delete(remoteUrl);
        }
    })();

    inflight.set(remoteUrl, task);
    return task;
}

function assignImageSrc(img: HTMLImageElement, value: string): void {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    const set = descriptor?.set;
    if (!set) {
        img.src = value;
        return;
    }
    img.dataset.imageAssigning = '1';
    try {
        set.call(img, value);
    } finally {
        img.dataset.imageAssigning = '';
    }
}

/** Never paint `/images/...` into an `<img>`: that path 404s and flashes the broken-image icon. */
function patchImageSrc(): void {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!descriptor?.set || !descriptor.get) return;
    if ((HTMLImageElement.prototype as unknown as { __apexSrcPatched?: boolean }).__apexSrcPatched) return;
    (HTMLImageElement.prototype as unknown as { __apexSrcPatched?: boolean }).__apexSrcPatched = true;

    const set = descriptor.set;
    const get = descriptor.get;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
            return get.call(this);
        },
        set(value: string) {
            const img = this as HTMLImageElement;
            if (img.dataset.imageAssigning === '1') {
                set.call(img, value);
                return;
            }
            const file = typeof value === 'string' ? fileFromLocalUrl(value) : null;
            if (!file) {
                set.call(img, value);
                return;
            }
            img.dataset.imageWanted = file;
            const hit = memory.get(remoteImageUrl(file));
            if (hit) {
                assignImageSrc(img, hit);
                return;
            }
            assignImageSrc(img, IMAGE_PLACEHOLDER);
            void cachedObjectUrl(remoteImageUrl(file)).then((url) => {
                if (!img.isConnected || img.dataset.imageWanted !== file) return;
                assignImageSrc(img, url);
            });
        },
    });

    const nativeSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name: string, value: string) {
        if (
            this instanceof HTMLImageElement
            && name.toLowerCase() === 'src'
            && this.dataset.imageAssigning !== '1'
        ) {
            this.src = value;
            return;
        }
        nativeSetAttribute.call(this, name, value);
    };
}

/** `<img src="/images/...">` is not packaged. Load the saved file, or download it once. */
export function installLocalImageFallback(): void {
    if (typeof window === 'undefined') return;
    const flag = '__apexLocalImageFallback';
    const host = window as unknown as Record<string, boolean>;
    if (host[flag]) return;
    host[flag] = true;

    patchImageSrc();

    window.addEventListener('error', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) return;
        const file = fileFromLocalUrl(target.src);
        if (!file || target.dataset.imageFallbackPath === file) return;

        target.dataset.imageFallbackPath = file;
        event.stopImmediatePropagation();
        void cachedObjectUrl(remoteImageUrl(file)).then((url) => {
            assignImageSrc(target, url);
        });
    }, true);
}

/** Drop an older service-worker cache and use the on-disk store instead. */
export function startImageCache(): Promise<void> {
    installLocalImageFallback();
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve();
    return navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => undefined)
        .catch(() => undefined);
}

/** Saved file when we already have it, otherwise the Supabase download (which is then saved). */
export function useLocalImage(url: string | null | undefined): string {
    const remote = url ? remoteImageUrl(url) : '';
    const [src, setSrc] = useState(() => peekStoredUrl(url));
    // URL changed: clear or take the in-memory copy during render; otherwise keep the old image
    // until the new one resolves (same as before).
    const [shownRemote, setShownRemote] = useState(remote);
    if (shownRemote !== remote) {
        setShownRemote(remote);
        const hit = remote ? memory.get(remote) : '';
        if (!remote) setSrc('');
        else if (hit) setSrc(hit);
    }

    useEffect(() => {
        if (!remote) return;
        // Memory hits resolve immediately; misses read disk / download once.
        let cancelled = false;
        void cachedObjectUrl(remote).then((resolved) => {
            if (!cancelled) setSrc(resolved);
        });
        return () => {
            cancelled = true;
        };
    }, [remote]);

    return src;
}

/** For list rows, where a hook cannot be called inside `map`. */
export function LocalImage({
    url,
    children,
}: {
    url: string;
    children: (resolved: string) => ReactNode;
}) {
    const resolved = useLocalImage(url);
    return children(resolved);
}

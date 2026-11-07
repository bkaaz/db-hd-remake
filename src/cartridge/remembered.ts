/**
 * The player's ROM kept in the browser (IndexedDB), so it is picked once.
 * Only in this browser, on this device: it never leaves the page (ADR 0090).
 * Any failure — private browsing, storage turned off — reads as nothing kept.
 */

const DB = "db-hd-remake";
const STORE = "cartridge";
const KEY = "rom";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = act(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** The ROM kept, or null. */
export async function rememberedRom(): Promise<Uint8Array | null> {
  try {
    const bytes = await run<ArrayBuffer | undefined>("readonly", (s) => s.get(KEY));
    return bytes ? new Uint8Array(bytes) : null;
  } catch {
    return null;
  }
}

/** Keep `rom` for next time, over whatever was kept. */
export async function rememberRom(rom: Uint8Array): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(rom.slice().buffer, KEY));
  } catch {
    // nothing kept: the player is asked again next time
  }
}

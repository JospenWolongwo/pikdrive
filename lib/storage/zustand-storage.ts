import type { StateStorage } from "zustand/middleware";

const DB_NAME = "pickdrive-zustand";
const STORE_NAME = "keyval";
const DB_VERSION = 1;

const memoryStorage = (() => {
  const map = new Map<string, string>();
  return {
    getItem: async (name: string) => map.get(name) ?? null,
    setItem: async (name: string, value: string) => {
      map.set(name, value);
    },
    removeItem: async (name: string) => {
      map.delete(name);
    },
  } satisfies StateStorage;
})();

const isBrowser = typeof window !== "undefined";
const hasIndexedDB =
  isBrowser && "indexedDB" in window && typeof indexedDB !== "undefined";
const hasLocalStorage =
  isBrowser && "localStorage" in window && typeof localStorage !== "undefined";

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (!hasIndexedDB) {
    return Promise.reject(new Error("IndexedDB not available"));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
};

const idbStorage: StateStorage = {
  getItem: async (name) => {
    const result = await withStore<string | undefined>("readonly", (store) =>
      store.get(name)
    );
    return result ?? null;
  },
  setItem: async (name, value) => {
    await withStore("readwrite", (store) => store.put(value, name));
  },
  removeItem: async (name) => {
    await withStore("readwrite", (store) => store.delete(name));
  },
};

const localStorageFallback: StateStorage = {
  getItem: async (name) => {
    if (!hasLocalStorage) return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    if (!hasLocalStorage) return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      return;
    }
  },
  removeItem: async (name) => {
    if (!hasLocalStorage) return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      return;
    }
  },
};

const safeStorage: StateStorage = {
  getItem: async (name) => {
    if (!hasIndexedDB) {
      return localStorageFallback.getItem(name);
    }
    try {
      return await idbStorage.getItem(name);
    } catch {
      return localStorageFallback.getItem(name);
    }
  },
  setItem: async (name, value) => {
    if (!hasIndexedDB) {
      await localStorageFallback.setItem(name, value);
      return;
    }
    try {
      await idbStorage.setItem(name, value);
    } catch {
      await localStorageFallback.setItem(name, value);
    }
  },
  removeItem: async (name) => {
    if (!hasIndexedDB) {
      await localStorageFallback.removeItem(name);
      return;
    }
    try {
      await idbStorage.removeItem(name);
    } catch {
      await localStorageFallback.removeItem(name);
    }
  },
};

export const zustandStorage: StateStorage = hasIndexedDB
  ? safeStorage
  : hasLocalStorage
    ? localStorageFallback
    : memoryStorage;

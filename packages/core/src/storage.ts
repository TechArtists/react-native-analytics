import { TALogger } from './logger';

type AsyncStorageType =
  typeof import('@react-native-async-storage/async-storage').default;

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  async getItem(key: string) {
    // Volatile store: data is lost when the app reloads.
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  async setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  async removeItem(key: string) {
    this.store.delete(key);
  }
}

/**
 * AsyncStorage-backed adapter. Falls back to memory if AsyncStorage isn't available
 * (e.g. in a pure Node/Jest environment).
 */
export class AsyncStorageAdapter implements StorageAdapter {
  private fallback = new MemoryStorageAdapter();

  constructor(private storage: AsyncStorageType | null) {}

  async getItem(key: string) {
    if (!this.storage) {
      return this.fallback.getItem(key);
    }
    return this.storage.getItem(key);
  }

  async setItem(key: string, value: string) {
    if (!this.storage) {
      return this.fallback.setItem(key, value);
    }
    return this.storage.setItem(key, value);
  }

  async removeItem(key: string) {
    if (!this.storage) {
      return this.fallback.removeItem(key);
    }
    return this.storage.removeItem(key);
  }
}

let asyncStorageModule: AsyncStorageType | null = null;
let warnedAboutAsyncStorageFallback = false;
try {
  // Optional dependency: if unavailable (e.g. in tests), this stays null.
  asyncStorageModule =
    require('@react-native-async-storage/async-storage').default;
} catch {
  asyncStorageModule = null;
}

export const createDefaultStorageAdapter = () => {
  if (!asyncStorageModule && !warnedAboutAsyncStorageFallback) {
    warnedAboutAsyncStorageFallback = true;
    TALogger.log(
      "AsyncStorage not available; using in-memory storage (counters reset each app start). Install '@react-native-async-storage/async-storage' as an app dependency or provide a custom StorageAdapter to persist data.",
      'warn'
    );
  }

  return asyncStorageModule
    ? new AsyncStorageAdapter(asyncStorageModule)
    : new MemoryStorageAdapter();
};

import { Platform } from 'react-native';

// A tiny storage abstraction that persists on all platforms.
// - Web: localStorage
// - Native: Expo SecureStore if available, else in-memory fallback

type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const mem: Record<string, string | null> = {};

const memoryStore: Store = {
  async getItem(k) { return k in mem ? mem[k] ?? null : null; },
  async setItem(k, v) { mem[k] = v; },
  async removeItem(k) { mem[k] = null; },
};

function createWebStore(): Store {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return {
        async getItem(k) { return window.localStorage.getItem(k); },
        async setItem(k, v) { window.localStorage.setItem(k, v); },
        async removeItem(k) { window.localStorage.removeItem(k); },
      };
    }
  } catch {}
  return memoryStore;
}

async function createNativeStore(): Promise<Store> {
  // We purposely avoid static import to allow projects without the package to compile.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require('expo-secure-store');
    const hasSecureStore = !!SecureStore?.getItemAsync;
    if (hasSecureStore) {
      return {
        async getItem(k) { return await SecureStore.getItemAsync(k); },
        async setItem(k, v) { await SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }); },
        async removeItem(k) { await SecureStore.deleteItemAsync(k); },
      };
    }
  } catch {}
  return memoryStore;
}

let nativeStorePromise: Promise<Store> | null = null;

export const appStorage: Store = {
  async getItem(key) {
    if (Platform.OS === 'web') return createWebStore().getItem(key);
    nativeStorePromise ||= createNativeStore();
    const s = await nativeStorePromise; return s.getItem(key);
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') return createWebStore().setItem(key, value);
    nativeStorePromise ||= createNativeStore();
    const s = await nativeStorePromise; return s.setItem(key, value);
  },
  async removeItem(key) {
    if (Platform.OS === 'web') return createWebStore().removeItem(key);
    nativeStorePromise ||= createNativeStore();
    const s = await nativeStorePromise; return s.removeItem(key);
  },
};

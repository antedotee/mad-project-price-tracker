import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase URL or Anon Key is missing. Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.',
  );
}

// Create a storage adapter that works for React Native (native and web)
const createStorageAdapter = () => {
  // Lazy-load AsyncStorage only when needed and only in native environments
  let asyncStorageCache: any = null;
  const getAsyncStorage = () => {
    // If we're in a web environment (has window and localStorage), don't use AsyncStorage
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return null;
    }
    
    // If we're in Node.js/SSR (no window, no document), don't use AsyncStorage
    if (typeof window === 'undefined' && typeof document === 'undefined') {
      return null;
    }

    // Cache AsyncStorage after first load
    if (asyncStorageCache !== null) {
      return asyncStorageCache;
    }

    // Only try to load AsyncStorage in native environments
    try {
      // Use a function wrapper to avoid Metro bundling this for web
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsyncStorageModule = require('@react-native-async-storage/async-storage');
      // Check if module is empty (Metro stub for web builds)
      if (!AsyncStorageModule || (typeof AsyncStorageModule === 'object' && Object.keys(AsyncStorageModule).length === 0)) {
        asyncStorageCache = false;
        return null;
      }
      asyncStorageCache = AsyncStorageModule.default || AsyncStorageModule;
      // Verify it has the expected methods
      if (asyncStorageCache && typeof asyncStorageCache.getItem === 'function') {
        return asyncStorageCache;
      }
      // Not a valid AsyncStorage module
      asyncStorageCache = false;
      return null;
    } catch (error) {
      // AsyncStorage not available (e.g., in web builds)
      asyncStorageCache = false;
      return null;
    }
  };

  return {
    getItem: (key: string): Promise<string | null> => {
      // Check for web environment first (runtime check)
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try {
          const item = localStorage.getItem(key);
          return Promise.resolve(item);
        } catch (error) {
          console.error('Error reading from localStorage:', error);
          return Promise.resolve(null);
        }
      }

      // Try AsyncStorage for native
      const AsyncStorage = getAsyncStorage();
      if (AsyncStorage) {
        return AsyncStorage.getItem(key);
      }

      // Fallback to no-op for SSR/Node environments
      return Promise.resolve(null);
    },
    setItem: (key: string, value: string): Promise<void> => {
      // Check for web environment first (runtime check)
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(key, value);
          return Promise.resolve();
        } catch (error) {
          console.error('Error writing to localStorage:', error);
          return Promise.resolve();
        }
      }

      // Try AsyncStorage for native
      const AsyncStorage = getAsyncStorage();
      if (AsyncStorage) {
        return AsyncStorage.setItem(key, value);
      }

      // Fallback to no-op for SSR/Node environments
      return Promise.resolve();
    },
    removeItem: (key: string): Promise<void> => {
      // Check for web environment first (runtime check)
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(key);
          return Promise.resolve();
        } catch (error) {
          console.error('Error removing from localStorage:', error);
          return Promise.resolve();
        }
      }

      // Try AsyncStorage for native
      const AsyncStorage = getAsyncStorage();
      if (AsyncStorage) {
        return AsyncStorage.removeItem(key);
      }

      // Fallback to no-op for SSR/Node environments
      return Promise.resolve();
    },
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: typeof window !== 'undefined',
    flowType: 'pkce',
  },
});

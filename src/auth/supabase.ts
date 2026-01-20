import {createClient} from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import {Platform} from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'YOUR_SUPABASE_KEY';

const WebStorageAdapter = {
    getItem: (key: string) => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(key);
    },
};

const ExpoSecureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            return await SecureStore.getItemAsync(key);
        } catch {
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch {
            // Silently fail if SecureStore is unavailable
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch {
            // Silently fail if SecureStore is unavailable
        }
    },
};

const storage =
    Platform.OS === 'web'
        ? WebStorageAdapter
        : ExpoSecureStoreAdapter;

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

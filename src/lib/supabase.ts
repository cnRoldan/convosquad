import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@/types/database';
import { readSupabaseConfiguration } from './supabase-config';

const { configuration, error } = readSupabaseConfiguration(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const isSupabaseConfigured = Boolean(configuration);
export const supabaseConfigurationError = error;

export const supabase = configuration
  ? createClient<Database>(configuration.url, configuration.publishableKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage, lock: processLock } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error('El acceso no está disponible en este momento. Inténtalo más tarde.');
  return supabase;
}

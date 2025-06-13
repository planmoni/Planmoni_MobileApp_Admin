import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import Constants from 'expo-constants';

// Get environment variables from Expo Constants or process.env
const getSupabaseUrl = () => {
  // Try to get from Constants first (for Expo Go)
  const expoConstants = Constants.expoConfig?.extra;
  if (expoConstants?.EXPO_PUBLIC_SUPABASE_URL) {
    return expoConstants.EXPO_PUBLIC_SUPABASE_URL;
  }
  
  // Fall back to process.env
  return process.env.EXPO_PUBLIC_SUPABASE_URL;
};

const getSupabaseAnonKey = () => {
  // Try to get from Constants first (for Expo Go)
  const expoConstants = Constants.expoConfig?.extra;
  if (expoConstants?.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    return expoConstants.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  }
  
  // Fall back to process.env
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

// Log for debugging
console.log('Supabase URL available:', !!supabaseUrl);
console.log('Supabase Anon Key available:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file and app configuration.');
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
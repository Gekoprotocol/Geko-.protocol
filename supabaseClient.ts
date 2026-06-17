import { createClient } from '@supabase/supabase-js';

// Safe environment variable getter to prevent "process is not defined" errors
const getEnv = (key: string) => {
  try {
    // import.meta.env is for Vite, process.env is for traditional Node environments
    return import.meta.env[key] || (typeof process !== 'undefined' ? process.env[key] : '') || '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.group("🛑 Supabase Configuration Missing");
  console.warn("Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.");
  console.warn("If you just added them, make sure to restart your development server.");
  console.groupEnd();
}

// Safety check to prevent the "forbidden use of secret api key" crash
if (supabaseAnonKey && supabaseAnonKey.startsWith('sb_secret_')) {
  console.error(
    "SECURITY ERROR: You are attempting to use a 'service_role' key in the browser. " +
    "Please update your .env file to use the 'anon' public key for VITE_SUPABASE_ANON_KEY."
  );
}

// Use fallbacks to prevent the constructor from throwing and crashing the whole app boot process.
// We use your actual Supabase URL as the default fallback.
export const supabase = createClient(supabaseUrl || 'https://etrdyisoszyhfpagllwc.supabase.co', (supabaseAnonKey && !supabaseAnonKey.startsWith('sb_secret_')) ? supabaseAnonKey : 'placeholder-key');
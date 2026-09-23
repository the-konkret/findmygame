import { createClient } from '@supabase/supabase-js';

// Your Supabase project's address and publishable ("anon") key, from
// Supabase → Project Settings → API (or the "Connect" button).
//
// These two values are PUBLIC by design, like a shop's street address: every visitor's browser needs them.
// What protects the data is Row Level Security in the database (see supabase/schema.sql),
// which lets each person read and change only their own rows.
// Never put the "secret" / "service_role" key here.
const SUPABASE_URL = 'https://rmbswrzxmefxoimriiny.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vubKL5LrQiAqfrGi2mswpA_Oz_Q9gkK';

export const isSupabaseConfigured =
  !SUPABASE_URL.includes('YOUR-PROJECT-ID') && !SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR-');

export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? SUPABASE_PUBLISHABLE_KEY : 'placeholder',
  { auth: { persistSession: true, autoRefreshToken: true } },
);

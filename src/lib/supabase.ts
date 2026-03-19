import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// Use placeholder so app renders without .env; replace with real project for auth/data
const url = supabaseUrl || 'https://placeholder.supabase.co'
const key = supabaseAnonKey || 'placeholder-anon-key'

export const supabase: SupabaseClient = createClient(url, key)
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

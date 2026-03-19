/**
 * Supabase client with service role for API routes. Server-side only.
 * Set SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL (or SUPABASE_URL) in env.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.warn('Supabase service role not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
}

export const supabaseAdmin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null

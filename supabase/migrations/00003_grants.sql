-- Grant table permissions so authenticated and anon can access tables (RLS still enforces row-level rules).
-- Run this in Supabase SQL Editor if you get "permission denied for table X".

-- Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- users: authenticated only (signup trigger inserts; user reads/updates own)
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- artists: anon can read (public discovery); authenticated can read and do own insert/update/delete
GRANT SELECT ON public.artists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artists TO authenticated;

-- streams, tracks, products, events, memberships: public read; authenticated artist can write own
GRANT SELECT ON public.streams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streams TO authenticated;
GRANT SELECT ON public.tracks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracks TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.memberships TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;

-- subscriptions, transactions: authenticated only (users manage own)
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT ON public.transactions TO authenticated;

-- avatars: public read; authenticated artist can write own
GRANT SELECT ON public.avatars TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avatars TO authenticated;

-- platform_settings, integrations (from 00002)
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;

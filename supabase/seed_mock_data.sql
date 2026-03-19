-- Mock data seed for Signal (optional).
-- Run this in Supabase SQL Editor AFTER you have at least one user in auth.users.
-- Replace SEED_USER_ID below with a real user UUID (e.g. from Authentication → Users in Supabase Dashboard).
-- That user will get one artist profile with streams, products, events, and memberships.

-- SET this to your test user's UUID before running:
-- e.g. \set seed_user_id 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

DO $$
DECLARE
  seed_user_id uuid;
  aid uuid;
BEGIN
  -- Use the first available user if none specified (for local dev)
  SELECT id INTO seed_user_id FROM public.users LIMIT 1;
  IF seed_user_id IS NULL THEN
    RAISE NOTICE 'No user in public.users. Create an account first, then run this seed with that user ID.';
    RETURN;
  END IF;

  -- Ensure user has artist role
  UPDATE public.users SET role = 'artist' WHERE id = seed_user_id;

  -- Get existing artist or insert new one
  SELECT id INTO aid FROM public.artists WHERE user_id = seed_user_id LIMIT 1;

  IF aid IS NULL THEN
    INSERT INTO public.artists (user_id, display_name, handle, bio, avatar_url)
    VALUES (
      seed_user_id,
      'NOVA',
      'novabeats',
      'Electronic producer and DJ. Blending ambient textures with driving beats.',
      'https://picsum.photos/seed/nova-avatar/800/1000'
    )
    RETURNING id INTO aid;
  ELSE
    UPDATE public.artists
    SET display_name = 'NOVA', bio = 'Electronic producer and DJ. Blending ambient textures with driving beats.', avatar_url = 'https://picsum.photos/seed/nova-avatar/800/1000'
    WHERE id = aid;
  END IF;

  IF aid IS NULL THEN
    RAISE NOTICE 'Could not create or find artist.';
    RETURN;
  END IF;

  -- Stream (live) — insert once per run
  INSERT INTO public.streams (artist_id, title, is_live, playback_url, started_at, camera_auto_rotate)
  SELECT aid, 'Night Drive', true, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', now(), false
  WHERE NOT EXISTS (SELECT 1 FROM public.streams WHERE artist_id = aid LIMIT 1);

  -- Products (photo-style placeholders)
  INSERT INTO public.products (artist_id, type, title, price_cents, image_url)
  VALUES
    (aid, 'track', 'Midnight EP', 499, 'https://picsum.photos/seed/nova-ep/400/400'),
    (aid, 'merch', 'NOVA Logo Cap', 2999, 'https://picsum.photos/seed/nova-cap/400/400');

  -- Event
  INSERT INTO public.events (artist_id, title, starts_at, venue, image_url)
  VALUES (aid, 'NOVA · Night Drive', now() + interval '7 days', 'Signal Live', 'https://picsum.photos/seed/nova-night-drive/640/360');

  -- Memberships
  INSERT INTO public.memberships (artist_id, title, price_cents)
  VALUES
    (aid, 'Inner Circle', 999),
    (aid, 'VIP Access', 1999);

  -- Avatar (photo-style)
  INSERT INTO public.avatars (artist_id, image_url, style)
  SELECT aid, 'https://picsum.photos/seed/nova-avatar/200/200', 'default'
  WHERE NOT EXISTS (SELECT 1 FROM public.avatars WHERE artist_id = aid LIMIT 1);

  RAISE NOTICE 'Mock data seeded for artist %', aid;
END $$;

-- Optional: fix existing seeded rows that used placehold.co (run once to show photos on home)
-- UPDATE public.artists SET avatar_url = 'https://picsum.photos/seed/nova-avatar/800/1000' WHERE avatar_url LIKE '%placehold.co%';
-- UPDATE public.products SET image_url = 'https://picsum.photos/seed/nova-ep/400/400' WHERE image_url LIKE '%placehold.co%' AND title = 'Midnight EP';
-- UPDATE public.products SET image_url = 'https://picsum.photos/seed/nova-cap/400/400' WHERE image_url LIKE '%placehold.co%' AND title = 'NOVA Logo Cap';
-- UPDATE public.events SET image_url = 'https://picsum.photos/seed/nova-night-drive/640/360' WHERE image_url LIKE '%placehold.co%';
-- UPDATE public.avatars SET image_url = 'https://picsum.photos/seed/nova-avatar/200/200' WHERE image_url LIKE '%placehold.co%';

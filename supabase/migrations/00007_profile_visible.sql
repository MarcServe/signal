-- Online / offline: when profile_visible is false, non-owners cannot read the artist row
-- or related public content (feed, products, events, etc.) — enforced via RLS.

alter table public.artists
  add column if not exists profile_visible boolean not null default true;

comment on column public.artists.profile_visible is
  'true = online (visible on discovery and public profile). false = offline (owner-only).';

-- Artists: replace wide-open select
drop policy if exists "artists_select_all" on public.artists;
create policy "artists_select_visible_or_own" on public.artists
  for select
  using (profile_visible = true or auth.uid() = user_id);

-- Child tables: public read only if the artist row is visible to this user (RLS on artists applies inside EXISTS)
drop policy if exists "streams_select_all" on public.streams;
create policy "streams_select_via_artist" on public.streams
  for select
  using (exists (select 1 from public.artists a where a.id = streams.artist_id));

drop policy if exists "tracks_select_all" on public.tracks;
create policy "tracks_select_via_artist" on public.tracks
  for select
  using (exists (select 1 from public.artists a where a.id = tracks.artist_id));

drop policy if exists "products_select_all" on public.products;
create policy "products_select_via_artist" on public.products
  for select
  using (exists (select 1 from public.artists a where a.id = products.artist_id));

drop policy if exists "events_select_all" on public.events;
create policy "events_select_via_artist" on public.events
  for select
  using (exists (select 1 from public.artists a where a.id = events.artist_id));

drop policy if exists "memberships_select_all" on public.memberships;
create policy "memberships_select_via_artist" on public.memberships
  for select
  using (exists (select 1 from public.artists a where a.id = memberships.artist_id));

drop policy if exists "avatars_select_all" on public.avatars;
create policy "avatars_select_via_artist" on public.avatars
  for select
  using (exists (select 1 from public.artists a where a.id = avatars.artist_id));

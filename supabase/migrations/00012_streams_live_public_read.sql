-- Fans opening /live/:id must read stream + artist rows while the artist is live,
-- even when profile_visible = false (hidden from discovery).
-- Previously, EXISTS(artists ...) was evaluated under artists RLS, so anon saw no row.

drop policy if exists "streams_select_via_artist" on public.streams;
create policy "streams_select_via_artist" on public.streams
  for select
  using (
    is_live = true
    or exists (
      select 1 from public.artists a
      where a.id = streams.artist_id
      and (a.profile_visible = true or a.user_id = auth.uid())
    )
  );

drop policy if exists "artists_select_visible_or_own" on public.artists;
create policy "artists_select_visible_or_own" on public.artists
  for select
  using (
    profile_visible = true
    or auth.uid() = user_id
    or exists (
      select 1 from public.streams s
      where s.artist_id = artists.id
      and s.is_live = true
    )
  );

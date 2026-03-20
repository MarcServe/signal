-- Discovery feed: only include artists whose account role is actually "artist".
-- Prevents fan accounts (users.role = 'fan') with a stray `artists` row from appearing as "Join" cards.

create or replace view public.feed_items_view as
select
  'stream' as item_type,
  s.id as id,
  a.id as artist_id,
  a.display_name as title,
  coalesce(a.avatar_url, '') as image_url,
  s.is_live as is_live,
  'Watch' as cta,
  s.created_at as sort_at
from public.streams s
join public.artists a on a.id = s.artist_id
join public.users u on u.id = a.user_id
where (s.is_live or s.started_at is not null)
  and u.role = 'artist'
union all
select
  'artist' as item_type,
  a.id as id,
  a.id as artist_id,
  a.display_name as title,
  coalesce(a.avatar_url, '') as image_url,
  false as is_live,
  'Join' as cta,
  a.created_at as sort_at
from public.artists a
join public.users u on u.id = a.user_id
where u.role = 'artist'
union all
select
  'product' as item_type,
  p.id as id,
  p.artist_id as artist_id,
  p.title as title,
  coalesce(p.image_url, '') as image_url,
  false as is_live,
  'Buy' as cta,
  p.created_at as sort_at
from public.products p
join public.artists a on a.id = p.artist_id
join public.users u on u.id = a.user_id
where u.role = 'artist'
union all
select
  'event' as item_type,
  e.id as id,
  e.artist_id as artist_id,
  e.title as title,
  coalesce(e.image_url, '') as image_url,
  false as is_live,
  'Get Ticket' as cta,
  e.starts_at as sort_at
from public.events e
join public.artists a on a.id = e.artist_id
join public.users u on u.id = a.user_id
where u.role = 'artist';

grant select on public.feed_items_view to anon;
grant select on public.feed_items_view to authenticated;

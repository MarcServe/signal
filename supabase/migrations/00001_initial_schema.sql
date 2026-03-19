-- Signal MVP schema: users, artists, streams, tracks, transactions, memberships, events, avatars, subscriptions
-- Extends Supabase auth.users; app profile in public.users

-- public.users (profile for auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'fan' check (role in ('fan', 'artist', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- artists (one per user who is artist)
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  display_name text not null,
  handle text unique,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- streams (live sessions)
create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text,
  stream_key text,
  playback_url text,
  is_live boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tracks (music products)
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  cover_url text,
  audio_url text,
  price_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- products (merch, tickets, etc.)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  type text not null check (type in ('merch', 'ticket', 'membership', 'track')),
  title text not null,
  image_url text,
  price_cents integer,
  external_id text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  image_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text,
  ticket_product_id uuid references public.products(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- memberships (tiers)
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  price_cents integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- subscriptions (user subscribed to artist/membership)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'cancelled', 'past_due')),
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, artist_id)
);

-- transactions (purchases, tips)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  type text not null check (type in ('purchase', 'tip', 'subscription', 'ticket')),
  product_id uuid references public.products(id) on delete set null,
  amount_cents integer not null,
  stripe_payment_id text,
  created_at timestamptz not null default now()
);

-- avatars (AI-generated)
create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  image_url text,
  asset_id text,
  style text,
  voice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- feed view: unified feed items for discovery (streams, artists, products, events)
-- named feed_items_view so migration tooling does not try ALTER TABLE / RLS on it (views are not tables)
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
where s.is_live or s.started_at is not null
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
from public.events e;

grant select on public.feed_items_view to anon;
grant select on public.feed_items_view to authenticated;

-- RLS
alter table public.users enable row level security;
alter table public.artists enable row level security;
alter table public.streams enable row level security;
alter table public.tracks enable row level security;
alter table public.products enable row level security;
alter table public.events enable row level security;
alter table public.memberships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.avatars enable row level security;

-- users: read own, insert own on signup, update own
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);

-- artists: public read; insert/update/delete own
create policy "artists_select_all" on public.artists for select using (true);
create policy "artists_insert_own" on public.artists for insert with check (auth.uid() = user_id);
create policy "artists_update_own" on public.artists for update using (auth.uid() = user_id);
create policy "artists_delete_own" on public.artists for delete using (auth.uid() = user_id);

-- streams: public read; artist CRUD own
create policy "streams_select_all" on public.streams for select using (true);
create policy "streams_all_own" on public.streams for all using (
  exists (select 1 from public.artists a where a.id = streams.artist_id and a.user_id = auth.uid())
);

-- tracks: public read; artist CRUD own
create policy "tracks_select_all" on public.tracks for select using (true);
create policy "tracks_all_own" on public.tracks for all using (
  exists (select 1 from public.artists a where a.id = tracks.artist_id and a.user_id = auth.uid())
);

-- products: public read; artist CRUD own
create policy "products_select_all" on public.products for select using (true);
create policy "products_all_own" on public.products for all using (
  exists (select 1 from public.artists a where a.id = products.artist_id and a.user_id = auth.uid())
);

-- events: public read; artist CRUD own
create policy "events_select_all" on public.events for select using (true);
create policy "events_all_own" on public.events for all using (
  exists (select 1 from public.artists a where a.id = events.artist_id and a.user_id = auth.uid())
);

-- memberships: public read; artist CRUD own
create policy "memberships_select_all" on public.memberships for select using (true);
create policy "memberships_all_own" on public.memberships for all using (
  exists (select 1 from public.artists a where a.id = memberships.artist_id and a.user_id = auth.uid())
);

-- subscriptions: user sees own; insert/update for self
create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);
create policy "subscriptions_insert_own" on public.subscriptions for insert with check (auth.uid() = user_id);
create policy "subscriptions_update_own" on public.subscriptions for update using (auth.uid() = user_id);

-- transactions: user sees own; insert for self (system may insert)
create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions for insert with check (auth.uid() = user_id);

-- avatars: public read; artist CRUD own
create policy "avatars_select_all" on public.avatars for select using (true);
create policy "avatars_all_own" on public.avatars for all using (
  exists (select 1 from public.artists a where a.id = avatars.artist_id and a.user_id = auth.uid())
);

-- Trigger: create public.users on auth signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'fan')
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

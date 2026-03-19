-- Platform settings (singleton) and integrations; optional columns for streams/artists/users

-- platform_settings: one row; admin-only update
create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  platform_fee_percent integer not null default 10 check (platform_fee_percent >= 0 and platform_fee_percent <= 100),
  fee_free_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

-- Select: allow authenticated (read for fee display / commerce)
create policy "platform_settings_select"
  on public.platform_settings for select
  to authenticated
  using (true);

-- Insert: allow only when table is empty (seed)
create policy "platform_settings_insert_empty"
  on public.platform_settings for insert
  to authenticated
  with check (
    (select count(*) from public.platform_settings) = 0
  );

-- Update: admin only
create policy "platform_settings_update_admin"
  on public.platform_settings for update
  to authenticated
  using (
    (select role from public.users where id = auth.uid()) = 'admin'
  )
  with check (
    (select role from public.users where id = auth.uid()) = 'admin'
  );

-- Seed one row
insert into public.platform_settings (platform_fee_percent, fee_free_until)
select 10, null
where not exists (select 1 from public.platform_settings);

-- integrations: per-artist external service keys
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  service_name text not null,
  api_key text,
  refresh_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integrations enable row level security;

create policy "integrations_artist_crud"
  on public.integrations for all
  to authenticated
  using (
    exists (select 1 from public.artists a where a.id = integrations.artist_id and a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.artists a where a.id = integrations.artist_id and a.user_id = auth.uid())
  );

-- Optional columns for product/UI use
alter table public.streams
  add column if not exists camera_auto_rotate boolean not null default false;

alter table public.artists
  add column if not exists brand_color text;

alter table public.users
  add column if not exists subscription_status text,
  add column if not exists avatar_setup_done boolean not null default false;

-- Fee reporting on transactions
alter table public.transactions
  add column if not exists platform_fee_cents integer,
  add column if not exists artist_payout_cents integer;

-- Production backend: Stripe, PayPal, payouts, automation. Ready for API keys.

-- artists: Stripe Connect + PayPal
alter table public.artists
  add column if not exists stripe_account_id text,
  add column if not exists stripe_onboarding_complete boolean not null default false,
  add column if not exists paypal_merchant_id text;

-- platform_settings: payouts + automation webhooks
alter table public.platform_settings
  add column if not exists payout_schedule text check (payout_schedule in ('weekly', 'threshold', 'manual')),
  add column if not exists payout_minimum_cents integer,
  add column if not exists payout_last_run_at timestamptz,
  add column if not exists webhook_url text,
  add column if not exists webhook_events text[] default array['sale', 'subscription', 'stream_started'];

-- integrations: sync metadata
alter table public.integrations
  add column if not exists metadata jsonb default '{}',
  add column if not exists last_sync_at timestamptz;

-- avatars: voice/style for ElevenLabs
alter table public.avatars
  add column if not exists elevenlabs_voice_id text,
  add column if not exists preset text;

-- transactions: stripe payment id already exists for idempotency
-- (stripe_payment_id already exists)

-- Optional: payout runs log (for cron)
create table if not exists public.payout_runs (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  amount_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  stripe_transfer_id text,
  created_at timestamptz not null default now()
);

alter table public.payout_runs enable row level security;

create policy "payout_runs_admin"
  on public.payout_runs for select to authenticated
  using ((select role from public.users where id = auth.uid()) = 'admin');

comment on column public.artists.stripe_account_id is 'Stripe Connect account id; set after onboarding';
comment on column public.platform_settings.webhook_url is 'n8n/Make webhook URL for automation events';

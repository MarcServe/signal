-- Live stream chat (realtime-friendly)
create table if not exists public.stream_chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text,
  body text not null,
  created_at timestamptz not null default now(),
  constraint stream_chat_messages_body_len check (char_length(body) between 1 and 500)
);

create index if not exists stream_chat_messages_stream_created_at_idx
  on public.stream_chat_messages (stream_id, created_at desc);

alter table public.stream_chat_messages enable row level security;

-- Anyone can read chat for any stream (public live pages)
create policy "stream_chat_select_all"
  on public.stream_chat_messages for select
  using (true);

-- Authenticated users can post; must set user_id = auth.uid()
create policy "stream_chat_insert_authenticated"
  on public.stream_chat_messages for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.streams s where s.id = stream_id)
  );

grant select on public.stream_chat_messages to anon;
grant select, insert on public.stream_chat_messages to authenticated;

-- Realtime: new messages broadcast to subscribers
alter publication supabase_realtime add table public.stream_chat_messages;

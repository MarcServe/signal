-- One integration per artist per service (for upsert and sync).
create unique index if not exists integrations_artist_service_unique
  on public.integrations (artist_id, service_name);

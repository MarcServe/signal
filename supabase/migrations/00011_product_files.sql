-- Add file_url to products
alter table public.products add column if not exists file_url text;

-- Create private bucket for product files (audio tracks, etc)
insert into storage.buckets (id, name, public)
values ('product_files', 'product_files', false)
on conflict (id) do update set public = false;

drop policy if exists "product_files_artist_upload" on storage.objects;
drop policy if exists "product_files_artist_update" on storage.objects;
drop policy if exists "product_files_artist_delete" on storage.objects;
drop policy if exists "product_files_artist_read" on storage.objects;
drop policy if exists "product_files_fan_read" on storage.objects;

-- Artists can upload to their own folder (path starts with artist_id)
create policy "product_files_artist_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product_files' and
  (storage.foldername(name))[1] = (select id::text from public.artists where user_id = auth.uid())
);

create policy "product_files_artist_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'product_files' and
  (storage.foldername(name))[1] = (select id::text from public.artists where user_id = auth.uid())
);

create policy "product_files_artist_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product_files' and
  (storage.foldername(name))[1] = (select id::text from public.artists where user_id = auth.uid())
);

create policy "product_files_artist_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'product_files' and
  (storage.foldername(name))[1] = (select id::text from public.artists where user_id = auth.uid())
);

-- Fans can read if they purchased the product
create policy "product_files_fan_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'product_files' and
  exists (
    select 1 from public.transactions t
    join public.products p on p.id = t.product_id
    where t.user_id = auth.uid()
    and p.file_url = storage.objects.name
  )
);

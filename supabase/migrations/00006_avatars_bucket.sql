-- Create the avatars storage bucket and policies so uploads work.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).

-- Create bucket. Public so getPublicUrl() works for profile/avatar images.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Drop existing policies so this migration is safe to run again
drop policy if exists "avatars_upload" on storage.objects;
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;

-- Allow authenticated users to upload to avatars bucket
create policy "avatars_upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars');

-- Allow anyone to read (public bucket)
create policy "avatars_public_read"
on storage.objects for select
using (bucket_id = 'avatars');

-- Allow authenticated to update (needed for upsert)
create policy "avatars_update"
on storage.objects for update to authenticated
using (bucket_id = 'avatars');

-- Allow authenticated to delete
create policy "avatars_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars');

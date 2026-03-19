-- Tier / membership card imagery (same storage bucket as products; dashboard + public profile)
alter table public.memberships
  add column if not exists image_url text;

comment on column public.memberships.image_url is 'Optional hero image for membership tier cards (upload, Gemini generate, or enhance).';

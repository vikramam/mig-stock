-- ============================================================
-- Migration 004: product image Storage bucket
-- Run once in the Supabase SQL Editor against the live project.
-- Same SQL is folded into schema.sql (section 9) for fresh installs.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "public read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "authenticated upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "authenticated update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images');

create policy "authenticated delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images');

-- ============================================================
-- Migration 007: add size 0 to the sizes master table
-- Already run directly against the live Supabase project — this file exists so the
-- migration history/schema.sql stay accurate, and so a fresh install matches production.
-- ============================================================

insert into sizes (value)
values (0)
on conflict (value) do nothing;

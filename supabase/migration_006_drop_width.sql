-- ============================================================
-- Migration 006: drop the "width" concept entirely
-- Already run directly against the live Supabase project — this file exists so the
-- migration history/schema.sql stay accurate, and so a fresh install matches production.
--
-- migration_005_retire_width.sql only made width_id nullable. This finishes the job:
-- drops the column and the widths table outright. Do NOT reintroduce a width column
-- unless the owner explicitly asks for it again (see CLAUDE.md "Catalog structure").
-- ============================================================

alter table product_types drop column if exists width_id;

drop table if exists widths;

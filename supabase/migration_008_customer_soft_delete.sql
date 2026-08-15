-- ============================================================
-- Migration 008: soft-delete flag for customers
-- Deleting a customer from the Manage Customers screen now sets is_deleted = true
-- instead of removing the row, so sales already linked to them (sales.customer_id)
-- keep resolving customers.name unchanged. Deleted customers are excluded from the
-- customer list and the New Sale picker by default, with a filter to view them.
-- Run this directly against the live Supabase project.
-- ============================================================

alter table customers add column if not exists is_deleted boolean not null default false;

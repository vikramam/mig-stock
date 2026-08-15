-- ============================================================
-- Migration 010: soft-delete flag for variants
-- Deleting a variant from the Catalog screen now sets is_deleted = true instead of
-- removing the row (variants are referenced by sale_items with on delete restrict, so a
-- hard delete would fail anyway once a variant has any sales history). Deleted variants
-- are excluded from the Catalog list by default (filterable), from fetchActiveVariants()
-- (New Sale / Manage Stock pickers), and from low_stock_view. Re-adding the same
-- type+size via "Add variant" revives the row (is_deleted = false) with the newly
-- entered price instead of failing the unique (type_id, size_id) constraint.
-- Run this directly against the live Supabase project.
-- ============================================================

alter table variants add column if not exists is_deleted boolean not null default false;

create or replace view low_stock_view as
select
  v.id as variant_id,
  p.name as product_name,
  pt.type_name,
  s.value as size,
  v.current_stock,
  v.unit_price
from variants v
join product_types pt on pt.id = v.type_id
join sizes s on s.id = v.size_id
join products p on p.id = pt.product_id
where v.current_stock < (select low_stock_threshold from settings where id = 1)
  and v.active = true
  and v.is_deleted = false
order by v.current_stock asc;

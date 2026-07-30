-- ============================================================
-- Migration 005: retire the "width" concept from product types
-- Run once in the Supabase SQL Editor against the live project.
-- Same changes are folded into schema.sql for fresh installs.
--
-- The `widths` table and any width_id values already set on existing product_types
-- rows are left untouched (per request) — this only:
--   (a) makes width_id optional, so new product types don't need one, and
--   (b) rebuilds low_stock_view without its widths join, which would otherwise
--       silently exclude any type with no width_id (an inner join on a null FK
--       matches nothing).
-- ============================================================

alter table product_types alter column width_id drop not null;

drop view if exists low_stock_view;

create view low_stock_view as
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
order by v.current_stock asc;

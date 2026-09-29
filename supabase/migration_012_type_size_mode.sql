-- ============================================================
-- Migration 012: per-type custom size labels
-- Some product types don't fit the shared numeric `sizes` list (e.g. rope thickness
-- described in words rather than inches) — this adds a per-type toggle so a type's
-- variants use either the existing size dropdown ('dropdown', the default/unchanged
-- behavior) or a free-text label typed per variant ('freetext'). A type's size_mode is
-- decided once in Catalog > Edit type and is meant to be locked by the app once the type
-- has any variants (the app enforces this, not this migration) — mixing modes within one
-- type is not supported.
--
-- variants.size_id becomes nullable and a new variants.size_label holds the typed text
-- for freetext-mode variants; exactly one of the two is ever set. Both existing unique
-- constraints — (type_id, size_id) and the new (type_id, size_label) — rely on Postgres
-- treating each NULL as distinct from every other NULL, so dropdown-mode rows (size_label
-- always NULL) and freetext-mode rows (size_id always NULL) never collide with each other
-- under either constraint.
--
-- low_stock_view's join on sizes changes from an inner join to a left join — with the
-- inner join, any freetext variant (size_id NULL) would silently disappear from Low
-- Stock entirely.
--
-- Run this directly against the live Supabase project.
-- ============================================================

alter table product_types
  add column if not exists size_mode text not null default 'dropdown' check (size_mode in ('dropdown', 'freetext'));

alter table variants alter column size_id drop not null;

alter table variants add column if not exists size_label text;

alter table variants add constraint variants_size_shape_chk check (
  (size_id is not null and size_label is null)
  or (size_id is null and size_label is not null and length(trim(size_label)) > 0)
);

alter table variants add constraint variants_type_size_label_uniq unique (type_id, size_label);

-- create or replace view can only APPEND new columns at the end of the select list, not
-- insert one in the middle — size_label goes after unit_price so current_stock/unit_price
-- keep their original positions (otherwise Postgres reads this as renaming an existing
-- column, e.g. "cannot change name of view column 'current_stock' to 'size_label'").
create or replace view low_stock_view as
select
  v.id as variant_id,
  p.name as product_name,
  pt.type_name,
  s.value as size,
  v.current_stock,
  v.unit_price,
  v.size_label
from variants v
join product_types pt on pt.id = v.type_id
left join sizes s on s.id = v.size_id
join products p on p.id = pt.product_id
where v.current_stock < (select low_stock_threshold from settings where id = 1)
  and v.active = true
  and v.is_deleted = false
order by v.current_stock asc;

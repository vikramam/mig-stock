-- ============================================================
-- Migration 009: manual stock adjustment + undo-last-addition
-- Adds two RPC functions backing the "Manage stock" screen (formerly "Add stock"):
--   - adjust_stock: directly sets a variant's current_stock to a new value (e.g. after
--     a physical recount), writing one 'adjustment' stock_movements row so the ledger
--     still records the change and who made it.
--   - undo_last_stock_addition: reverses the most recent stock_movements row for a
--     variant, but ONLY if that row is still the latest movement for the variant and
--     its reason is 'purchase' — i.e. nothing else (a sale, another adjustment) has
--     touched that variant since the addition was made. Restores current_stock to that
--     row's balance_before and removes the row outright, since this is undoing a
--     just-made mistake rather than recording a new ledger entry (unlike cancel_sale,
--     which reverses via a fresh row because other movements may have happened since).
-- Run this directly against the live Supabase project.
-- ============================================================

create or replace function adjust_stock(
  p_variant_id  uuid,
  p_new_stock   integer,
  p_note        text,
  p_created_by  text
) returns void
language plpgsql
as $$
declare
  v_before_stock integer;
begin
  select current_stock into v_before_stock from variants where id = p_variant_id for update;

  update variants set current_stock = p_new_stock where id = p_variant_id;

  insert into stock_movements (variant_id, change_qty, reason, balance_before, balance_after, note, created_by)
  values (p_variant_id, p_new_stock - v_before_stock, 'adjustment', v_before_stock, p_new_stock, p_note, p_created_by);
end;
$$;

create or replace function undo_last_stock_addition(
  p_variant_id  uuid
) returns void
language plpgsql
as $$
declare
  v_movement record;
begin
  select * into v_movement
  from stock_movements
  where variant_id = p_variant_id
  order by created_at desc
  limit 1
  for update;

  if v_movement.id is null or v_movement.reason <> 'purchase' then
    raise exception 'No recent stock addition to undo for this variant';
  end if;

  update variants set current_stock = v_movement.balance_before where id = p_variant_id;
  delete from stock_movements where id = v_movement.id;
end;
$$;

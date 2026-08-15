-- ============================================================
-- Migration 011: per-type default discount
-- Adds an admin-editable, per-unit default discount to each product type (Catalog >
-- Edit type), and a frozen per-line discount_amount on sale_items so receipts/history
-- stay correct even if the type's default_discount changes later. The discount is never
-- automatic — New Sale only applies it when the cashier clicks "Apply discount", which
-- reads each cart line's variant -> type -> default_discount, multiplies by qty, and
-- sends that total per line to commit_sale(). Run this directly against the live
-- Supabase project.
-- ============================================================

alter table product_types add column if not exists default_discount integer not null default 0 check (default_discount >= 0);

alter table sale_items add column if not exists discount_amount integer not null default 0 check (discount_amount >= 0);

-- items param shape: jsonb array of { variant_id, qty, unit_price, item_snapshot, discount_amount }
create or replace function commit_sale(
  p_customer_id   uuid,
  p_items         jsonb,
  p_amount_paid   integer,
  p_note          text,
  p_created_by    text
) returns uuid
language plpgsql
as $$
declare
  v_sale_id       uuid;
  v_total         integer := 0;
  v_item          jsonb;
  v_variant_id    uuid;
  v_qty           integer;
  v_price         integer;
  v_discount      integer;
  v_line_total    integer;
  v_before_stock  integer;
  v_after_stock   integer;
  v_status        text;
begin
  -- 1. compute total first
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total
      + (v_item->>'qty')::integer * (v_item->>'unit_price')::integer
      - coalesce((v_item->>'discount_amount')::integer, 0);
  end loop;

  v_status := case when p_amount_paid >= v_total then 'paid' else 'pending' end;

  -- 2. create sale header
  insert into sales (customer_id, total, amount_paid, balance_due, payment_status, note, created_by)
  values (p_customer_id, v_total, p_amount_paid, greatest(v_total - p_amount_paid, 0), v_status, p_note, p_created_by)
  returning id into v_sale_id;

  -- 3. line items + stock movements
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty        := (v_item->>'qty')::integer;
    v_price      := (v_item->>'unit_price')::integer;
    v_discount   := coalesce((v_item->>'discount_amount')::integer, 0);
    v_line_total := v_qty * v_price - v_discount;

    insert into sale_items (sale_id, variant_id, item_snapshot, qty, unit_price_at_sale, discount_amount, line_total)
    values (v_sale_id, v_variant_id, v_item->>'item_snapshot', v_qty, v_price, v_discount, v_line_total);

    select current_stock into v_before_stock from variants where id = v_variant_id for update;
    v_after_stock := v_before_stock - v_qty;  -- allowed to go negative (overselling permitted)

    update variants set current_stock = v_after_stock where id = v_variant_id;

    insert into stock_movements (variant_id, change_qty, reason, balance_before, balance_after, ref_id, created_by)
    values (v_variant_id, -v_qty, 'sale', v_before_stock, v_after_stock, v_sale_id, p_created_by);
  end loop;

  -- 4. initial payment, if any
  if p_amount_paid > 0 then
    insert into payments (sale_id, amount, note) values (v_sale_id, p_amount_paid, 'initial payment at sale');
  end if;

  return v_sale_id;
end;
$$;

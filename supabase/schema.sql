-- ============================================================
-- MIG Stock Management — Database Schema
-- Run this once in Supabase SQL Editor (or via `supabase db push`)
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ============================================================
-- 1. CATALOG:  products -> product_types -> variants
-- ============================================================

create table products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- e.g. "Clamp"
  image_url   text,                          -- one image per product, shared across all types/sizes
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table product_types (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete restrict,
  type_name   text not null,                 -- e.g. "Cruiser Clamp"
  width       text not null,                 -- e.g. "1.5 in"  (kept as text: could be 1.5", 2", etc.)
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (product_id, type_name)
);

create table variants (
  id             uuid primary key default gen_random_uuid(),
  type_id        uuid not null references product_types(id) on delete restrict,
  size           text not null,              -- length, e.g. "2 in"
  unit_price     integer not null check (unit_price >= 0),   -- stored in paise (INR smallest unit)
  current_stock  integer not null default 0, -- CACHED value only. Source of truth = stock_movements ledger.
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (type_id, size)
);

create index idx_product_types_product on product_types(product_id);
create index idx_variants_type on variants(type_id);

-- ============================================================
-- 2. STOCK LEDGER — source of truth for stock
-- ============================================================

create table stock_movements (
  id              uuid primary key default gen_random_uuid(),
  variant_id      uuid not null references variants(id) on delete restrict,
  change_qty      integer not null,          -- positive = stock in, negative = stock out
  reason          text not null check (reason in ('opening','purchase','sale','cancellation','adjustment')),
  balance_before  integer not null,
  balance_after   integer not null,
  ref_id          uuid,                      -- e.g. the sale id that caused this movement
  note            text,
  created_by      text,                      -- 'owner' / 'father' / free text, optional
  created_at      timestamptz not null default now()
);

create index idx_stock_movements_variant on stock_movements(variant_id);
create index idx_stock_movements_created_at on stock_movements(created_at desc);

-- ============================================================
-- 3. CUSTOMERS
-- ============================================================

create table customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  note        text,
  created_at  timestamptz not null default now()
);

create index idx_customers_name on customers(name);

-- ============================================================
-- 4. SALES, SALE_ITEMS, PAYMENTS
-- ============================================================

-- Sequential receipt numbers, e.g. MIG_INV-001
create sequence receipt_seq start 1;

create table sales (
  id              uuid primary key default gen_random_uuid(),
  receipt_no      text not null unique default ('MIG_INV-' || lpad(nextval('receipt_seq')::text, 3, '0')),
  customer_id     uuid references customers(id) on delete set null,  -- null = anonymous sale
  total           integer not null default 0,        -- paise, sum of sale_items.line_total
  amount_paid     integer not null default 0,         -- CACHED, source of truth = sum(payments.amount)
  balance_due     integer not null default 0,         -- CACHED = total - amount_paid
  payment_status  text not null default 'pending' check (payment_status in ('paid','pending')),
  status          text not null default 'active' check (status in ('active','cancelled')),
  note            text,
  created_by      text,
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz
);

create index idx_sales_created_at on sales(created_at desc);
create index idx_sales_customer on sales(customer_id);
create index idx_sales_status on sales(status);
create index idx_sales_payment_status on sales(payment_status);

create table sale_items (
  id                  uuid primary key default gen_random_uuid(),
  sale_id             uuid not null references sales(id) on delete cascade,
  variant_id          uuid not null references variants(id) on delete restrict,
  item_snapshot        text not null,          -- frozen "Clamp / Cruiser Clamp 1.5in / 2in" for receipts
  qty                 integer not null check (qty > 0),
  unit_price_at_sale  integer not null check (unit_price_at_sale >= 0),
  line_total          integer not null
);

create index idx_sale_items_sale on sale_items(sale_id);
create index idx_sale_items_variant on sale_items(variant_id);

create table payments (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references sales(id) on delete cascade,
  amount      integer not null check (amount > 0),
  paid_at     timestamptz not null default now(),
  note        text
);

create index idx_payments_sale on payments(sale_id);

-- ============================================================
-- 5. SETTINGS  (single row)
-- ============================================================

create table settings (
  id              int primary key default 1,
  company_name    text not null default 'MIG',
  logo_url        text,
  currency        text not null default 'INR',
  currency_prefix text not null default 'Rs.',
  receipt_footer  text,
  auth_enabled    boolean not null default true,
  low_stock_threshold integer not null default 10,
  constraint single_row check (id = 1)
);

insert into settings (id) values (1);

-- ============================================================
-- 6. CORE LOGIC — atomic sale commit / cancel
-- ============================================================

-- Records a new sale in one atomic transaction:
--   - inserts the sale header
--   - inserts each line item (snapshotting name+price)
--   - decrements variant stock and writes a ledger row per line
--   - inserts an initial payment row if any amount was paid upfront
--
-- items param shape: jsonb array of { variant_id, qty, unit_price, item_snapshot }
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
  v_line_total    integer;
  v_before_stock  integer;
  v_after_stock   integer;
  v_status        text;
begin
  -- 1. compute total first
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (v_item->>'qty')::integer * (v_item->>'unit_price')::integer;
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
    v_line_total := v_qty * v_price;

    insert into sale_items (sale_id, variant_id, item_snapshot, qty, unit_price_at_sale, line_total)
    values (v_sale_id, v_variant_id, v_item->>'item_snapshot', v_qty, v_price, v_line_total);

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

-- Cancels a sale: reverses all stock movements and marks the sale cancelled.
-- (Editing a sale = cancel this one, then commit_sale() a fresh one — keeps the ledger simple and honest.)
create or replace function cancel_sale(
  p_sale_id     uuid,
  p_created_by  text
) returns void
language plpgsql
as $$
declare
  v_item          record;
  v_before_stock  integer;
  v_after_stock   integer;
begin
  if not exists (select 1 from sales where id = p_sale_id and status = 'active') then
    raise exception 'Sale % not found or already cancelled', p_sale_id;
  end if;

  for v_item in select * from sale_items where sale_id = p_sale_id loop
    select current_stock into v_before_stock from variants where id = v_item.variant_id for update;
    v_after_stock := v_before_stock + v_item.qty;  -- give the stock back

    update variants set current_stock = v_after_stock where id = v_item.variant_id;

    insert into stock_movements (variant_id, change_qty, reason, balance_before, balance_after, ref_id, created_by)
    values (v_item.variant_id, v_item.qty, 'cancellation', v_before_stock, v_after_stock, p_sale_id, p_created_by);
  end loop;

  update sales set status = 'cancelled', cancelled_at = now() where id = p_sale_id;
end;
$$;

-- Adds a new stock purchase (restock) for a variant, atomically.
create or replace function add_stock(
  p_variant_id  uuid,
  p_qty         integer,
  p_note        text,
  p_created_by  text
) returns void
language plpgsql
as $$
declare
  v_before_stock integer;
  v_after_stock  integer;
begin
  if p_qty <= 0 then
    raise exception 'Quantity to add must be positive';
  end if;

  select current_stock into v_before_stock from variants where id = p_variant_id for update;
  v_after_stock := v_before_stock + p_qty;

  update variants set current_stock = v_after_stock where id = p_variant_id;

  insert into stock_movements (variant_id, change_qty, reason, balance_before, balance_after, note, created_by)
  values (p_variant_id, p_qty, 'purchase', v_before_stock, v_after_stock, p_note, p_created_by);
end;
$$;

-- Records a payment against a pending sale, atomically updates cached totals.
create or replace function record_payment(
  p_sale_id  uuid,
  p_amount   integer,
  p_note     text
) returns void
language plpgsql
as $$
declare
  v_total       integer;
  v_paid_total  integer;
begin
  insert into payments (sale_id, amount, note) values (p_sale_id, p_amount, p_note);

  select total into v_total from sales where id = p_sale_id;
  select coalesce(sum(amount), 0) into v_paid_total from payments where sale_id = p_sale_id;

  update sales
  set amount_paid = v_paid_total,
      balance_due = greatest(v_total - v_paid_total, 0),
      payment_status = case when v_paid_total >= v_total then 'paid' else 'pending' end
  where id = p_sale_id;
end;
$$;

-- ============================================================
-- 7. ROW LEVEL SECURITY
--    Real protection lives here, independent of the app's login toggle.
--    Only authenticated Supabase users can read/write any table.
-- ============================================================

alter table products         enable row level security;
alter table product_types    enable row level security;
alter table variants         enable row level security;
alter table stock_movements  enable row level security;
alter table customers        enable row level security;
alter table sales            enable row level security;
alter table sale_items       enable row level security;
alter table payments         enable row level security;
alter table settings         enable row level security;

create policy "authenticated full access" on products         for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on product_types    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on variants         for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on stock_movements  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on customers        for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on sales            for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on sale_items       for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on payments         for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on settings         for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- 8. HELPER VIEW — low stock (stock < settings.low_stock_threshold, includes negative)
-- ============================================================

create view low_stock_view as
select
  v.id as variant_id,
  p.name as product_name,
  pt.type_name,
  pt.width,
  v.size,
  v.current_stock,
  v.unit_price
from variants v
join product_types pt on pt.id = v.type_id
join products p on p.id = pt.product_id
where v.current_stock < (select low_stock_threshold from settings where id = 1)
  and v.active = true
order by v.current_stock asc;

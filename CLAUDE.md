# MIG Stock — Project Context

Internal stock + sales management app for a hardware shop selling clamps (and similar
products). Used only by the owner and his father — customers never access the app directly.

## Stack

- React (Vite) + TypeScript + MUI, built as a PWA
- Supabase: Postgres DB, Auth, Storage
- Hosting: GitHub -> Vercel (auto-deploy on push), free tier
- Charts: Recharts
- Receipt generation: html2canvas (PNG) + jsPDF (PDF)
- Sharing: native Web Share API (`navigator.share`) — NOT a WhatsApp API integration
- Excel import/export: SheetJS (xlsx)

## Catalog structure (three levels)

- **products** — e.g. "Clamp". Has ONE `image_url`, shared across all its types/sizes.
- **product_types** — e.g. "Cruiser Clamp". Has a `width_id` -> `widths` master table
  (this is the clamp's width in inches, fixed per type).
- **variants** — the actual sellable SKU: a type + a `size_id` -> `sizes` master table
  (this is length in inches). `unit_price` and `current_stock` live here.

Both `sizes` and `widths` are master tables (plain numeric inch values, e.g. 1.5, 2, 2.5).
The "in" unit label is appended ONLY in the UI (`formatSize` / `formatWidth` helpers in
`src/types.ts`) — never stored as text. This was migrated from free-text columns; see
`supabase/migration_002_003_combined.sql` for history if anything looks inconsistent.

## Stock ledger

`stock_movements` is the SOURCE OF TRUTH for stock — every change (opening stock, purchase,
sale, cancellation, adjustment) writes one row with `balance_before`/`balance_after`.
`variants.current_stock` is just a cached copy for fast reads. If they ever disagree, the
ledger wins.

Overselling is ALLOWED — stock can go negative. Do not add validation blocking this.

## Sales

- One sale (`sales`) has multiple `sale_items` (multi-product-per-receipt, confirmed
  requirement).
- No tax or discount concept anywhere — these are informal receipts, not tax invoices.
- Money is stored as INTEGER PAISE everywhere, never floats. Format for display only,
  as "Rs. 1,234.00" (see `formatMoney` in `src/lib/supabase.ts`). Currency is INR, always
  shown with the "Rs." prefix (not the ₹ symbol).
- `sale_items` snapshots `item_snapshot` (name/type/size) and `unit_price_at_sale` at the
  time of sale — so editing a product later never rewrites an old receipt.
- **Receipt numbers**: sequential, format `MIG_INV-001`, `MIG_INV-002`, ... generated via
  a Postgres sequence (`receipt_seq`) in the `sales` table default. "MIG" is the company's
  shorthand name.

## Payments

- A sale can be `paid` or `pending`. Pending balances can be repaid in FULL or in CHUNKS
  over time — this is why `payments` is a separate table (one row per payment against a
  sale), not a single `amount_paid` field typed once. `record_payment()` function handles
  updating the cached `amount_paid`/`balance_due`/`payment_status` on `sales`.

## Customers

- `customers` table: name, phone, note.
- A sale's `customer_id` is NULLABLE — anonymous/walk-in sales are allowed (no customer
  attached). The New Sale screen must offer: pick existing customer / add new customer
  (quick-add: just name + save) / anonymous.

## Cancel / edit a sale

- Cancelling a sale reverses its stock movements via `cancel_sale()` — gives stock back,
  marks `sales.status = 'cancelled'`. Cancelled sales are kept, not deleted (audit trail).
- Editing a sale = cancel the old one + create a fresh one via `commit_sale()`. Do NOT
  attempt line-by-line diffing/patching of an existing sale — cancel-and-recreate is the
  intended pattern, it's what keeps the ledger honest.

## Receipt — REQUIRED FEATURE (this is the one that gets forgotten)

When a sale is created, the app must be able to generate a shareable receipt:
- Rendered as both a **PNG image** and a **PDF**.
- Must include: company name (from `settings.company_name`) at the top, the product
  image (from `products.image_url`, looked up via variant -> type -> product), the
  receipt number (`MIG_INV-XXX`), line items, total, payment status/balance.
- Must be shareable directly to **WhatsApp** — via the native `navigator.share()` Web
  Share API passing the generated image/PDF as a file. Do NOT build a WhatsApp Business
  API integration — that's unnecessary complexity for this use case.

## Low stock

- Global rule: `current_stock < settings.low_stock_threshold` (default 10). NOT a
  per-product threshold.
- Low-stock page should also surface negative-stock variants (from overselling), and
  support filters. Backed by the `low_stock_view` SQL view.

## Auth

- Single SHARED login (owner + father use the same credentials) — not separate accounts.
- Login screen is TOGGLEABLE on/off via `settings.auth_enabled` — a convenience setting,
  not a security control.
- The REAL security boundary is Supabase Row Level Security (every table requires
  `auth.role() = 'authenticated'`) — this stays enforced regardless of the toggle. Never
  weaken RLS to make the toggle "work" when off.

## Reports

- Summary page: daily/weekly/monthly sales, ideally with a chart (Recharts). Should also
  be exportable as a PDF report.

## Design direction

Deliberately NOT generic MUI blue-and-white. Industrial/workshop identity: warm steel-gray
background, charcoal text, safety-amber accent (`#C97A2B` primary in `src/theme.ts`),
Space Grotesk for headings, Inter for body, **JetBrains Mono for all numeric values**
(prices, stock counts, receipt numbers) — reads like a shop ledger, not a SaaS dashboard.

## What NOT to add (explicitly declined by the owner)

- No cost price / profit / margin tracking — revenue only.
- No fractional quantities — always whole units.
- No tax or discount on receipts.
- No per-product low-stock threshold — one global number.
- No offline support — it's a web app, always-online is fine.

## Build status / what's done so far

- Full schema in `supabase/schema.sql` (run this for a fresh install)
- Migration history in `supabase/migration_*.sql` (already applied to the live Supabase
  project — informational only, don't re-run against an already-migrated DB)
- App shell: responsive layout (`src/components/Layout.tsx`), theme, Dashboard page with
  live summary cards + 7-day trend chart + quick-action tiles
- Supabase client + `formatMoney` helper in `src/lib/supabase.ts`
- Shared types in `src/types.ts`
- AI chatbot (`api/chat.ts` + `src/pages/Chatbot.tsx`, route `/chat`) — see below

## AI chatbot (data Q&A) — built

A chat screen (`src/pages/Chatbot.tsx`, route `/chat`, reachable from the AppBar robot icon
and the Dashboard "Ask MIG" tile) where the owner can ask plain-language questions about the
shop's own data — e.g. "how much did I sell last week?", "who owes me money right now?",
"which size sells the most?" — answered from real Supabase data.

**Provider: Google Gemini**, via `api/chat.ts`, a Vercel serverless function (Node runtime,
same repo, auto-deployed with the rest of the app — no separate Supabase Edge Function
deploy step). Model is `gemini-3.6-flash` called through the **Interactions API**
(`ai.interactions.create`, `@google/genai` SDK) — Google's Interactions API reached GA on
2026-06-22 and is now the primary interface, replacing the older `generateContent`/`contents`
pattern. If revisiting this code, don't assume `generateContent`-shaped examples apply;
re-check `ai.google.dev` for the current interface before making changes, since this moves.
Conversation continuity is handled via `previous_interaction_id` chaining (Google-managed
server-side state), not by resending message history from the client.

**Architecture — SAFE TOOL-USE ONLY, never raw SQL:**
- The AI never generates or executes SQL. It can only call four fixed, read-only functions
  implemented directly in `api/chat.ts` (plain Supabase queries, aggregated in JS — no new
  Postgres functions were added for this):
  - `get_sales_summary(start_date, end_date)`
  - `get_low_stock_items()`
  - `get_customer_balance(customer_name)`
  - `get_top_selling_variants(period)`
- Manual (non-automatic) function-calling loop, capped at `MAX_TOOL_ROUNDS = 4` per request
  to prevent runaway tool-call loops.
- **Auth**: the frontend sends the user's Supabase `session.access_token` as a Bearer header;
  `api/chat.ts` verifies it via `supabaseAdmin.auth.getUser(token)` before doing anything —
  this is the real access-control boundary on an otherwise-public API route (mirrors the RLS
  philosophy in the Auth section above: enforced server-side regardless of what the frontend
  toggle shows).
- The backend queries Supabase with the **service role key** (bypasses RLS — safe here
  because the request was already verified as an authenticated user above, and every tool is
  read-only).
- **Env vars** (server-side only, set in Vercel project settings — never with a `VITE_`
  prefix): `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Reuses the existing
  `VITE_SUPABASE_URL` for the project URL. See `.env.example`.


1. Login screen (needed to unblock all writes, since RLS requires authentication)
2. Stock management: Product / Type / Variant CRUD, with cascading dropdowns pulling
   from `sizes`/`widths` master tables, image upload to Supabase Storage for products
3. New Sale flow: cascading picker, multi-line cart, customer select/new/anonymous,
   payment status
4. Receipt generation (PNG/PDF + WhatsApp share) — see requirement above
5. Sales list + cancel/edit
6. Low-stock page with filters
7. Reports (daily/weekly/monthly, chart + PDF export)
8. Settings screen (company name, logo, currency footer, auth toggle)
9. Excel import (seed catalog) + export/backup

(AI chatbot for data Q&A, originally item 10 here, is now built — see the "AI chatbot"
section above. Reports PDF export is still outstanding — see item 7.)

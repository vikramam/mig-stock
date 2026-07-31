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

Premium dark SaaS identity (Linear / Vercel / Stripe-inspired) — this replaced an earlier
"industrial workshop, not a SaaS dashboard" identity via a full rewrite of `src/theme.ts`.
If you see old references to "steel-gray," "charcoal," "sharp squared-off corners," or
"borders not shadows" elsewhere (docs, comments, old screenshots), they describe the
*previous* direction — the notes below are current.

Still MIG's own brand, not a generic template: the amber accent (`#C97A2B` primary in
`src/theme.ts`) and the Space Grotesk (headings) / Inter (body) / **JetBrains Mono for all
numeric values** (prices, stock counts, receipt numbers) type system carry over unchanged.

**Light/dark toggle**: `src/theme.ts` exports `getTheme(mode)` — a factory, not a static
theme object — parameterized by a `PaletteMode`. `src/lib/themeMode.tsx`
(`ThemeModeProvider`/`useThemeMode`) owns the actual `mode` state, wraps `ThemeProvider` +
`CssBaseline`, persists the choice to `localStorage` (key `mig-theme-mode` — deliberately
NOT the `settings` table, since this is a per-device UI preference, not shared shop config
that the owner/father's single login should sync), and falls back to the OS
`prefers-color-scheme` on first visit. Toggled via a sun/moon `IconButton` in the AppBar
(`src/components/Layout.tsx`) — there's no separate toggle in Settings. Mode-specific
colors, shadows, and glass tints live in `getModeTokens()` inside `theme.ts`; don't hardcode
a hex value in a component that needs to look right in both modes — read it from the theme
(`useTheme()` + `theme.palette...`), the way `Dashboard.tsx`/`SalesReport.tsx` do for their
chart colors. `Receipt.tsx` is the deliberate exception (see below).

What actually changed vs. the old industrial identity:
- **Dark mode**: near-black zinc-950 background (`#09090b`), zinc-900 card surface
  (`#18181b`), zinc-800 border (`#27272a`), zinc-100 text (`#F4F4F5`), zinc-400 secondary
  text (`#A1A1AA`), plus a subtle amber ambient radial-gradient glow applied once at the
  `<body>` level (`MuiCssBaseline` styleOverrides in `theme.ts`) — not per-page — so every
  screen gets it consistently.
- **Light mode**: zinc-50 background (`#fafafa`), white card surface (`#ffffff`), slate-900
  text (`#0f172a`), slate-500 secondary text (`#64748b`). No ambient glow in light mode.
  Depth comes from a crisp "ring" (a 1px box-shadow standing in for a border) combined with
  a soft `shadow-sm`-style elevation — NOT the dark mode's inset-highlight bevel trick,
  which only reads on dark surfaces.
- **Depth via shadow + hairline border, not flat dividers** — `MuiPaper` carries a soft
  multi-layer shadow (dark: inset top highlight + two blurred outer shadows; light: ring +
  shadow-sm) and a 1px border, replacing the old flat `border: divider` look.
- **Glassmorphism on sticky/floating surfaces** — the AppBar, bottom nav, and Dialog paper
  use `backdrop-filter: blur(...)` over a semi-transparent background, tinted per mode.
- **Rounded, not sharp** — `theme.shape.borderRadius` is 16 (rounded-2xl-ish) for
  cards/dialogs, ~8-10px for buttons/chips. This reverses the old "sharp corners only,
  no rounded pills" rule — don't reintroduce `borderRadius: 4` card styling.
- **Tight header tracking** — h1-h6 carry negative letter-spacing (-0.02em to -0.04em,
  tighter at larger sizes) for contrast against normal-tracking body text.
- **Gradient/glow on primary CTAs** — any plain `<Button variant="contained">` (color
  defaults to `primary`) gets an amber gradient fill and a colored glow shadow via a
  `MuiButton` `variants` matcher in `src/theme.ts` — not a flat fill, in both modes (glow
  alpha is tuned down slightly for light mode via `buttonGlowAlpha` in `getModeTokens()`).
  The Dashboard's accent "New sale" tile is hand-styled the same way in its own file, since
  a gradient/glow isn't expressible as a single palette token.
- **Micro-interactions** — hover scale (`~1.02–1.08` depending on control) + press-down
  scale + smooth 200ms transitions on `MuiButton`/`MuiIconButton`/clickable `MuiChip`s, a
  shared `fadeInUp` mount animation on every `MuiPaper` (cards, dialogs, menus alike), and
  shimmer (`animation="wave"`) `Skeleton` loading states shaped like their real content
  (see `src/components/skeletons.tsx`) instead of bare spinners/blank states. All of it
  respects `prefers-reduced-motion` via a global override in `MuiCssBaseline`.

**Important exception — printable/shareable surfaces stay theme-independent:**
`src/components/sale/Receipt.tsx` intentionally hardcodes its own white background plus
fixed text/divider/accent colors (`RECEIPT_MUTED`, `RECEIPT_DIVIDER`,
`RECEIPT_ACCENT_GRADIENT` constants) instead of reading theme tokens — it gets captured to
PNG/PDF and shared to WhatsApp or printed, so it must stay legible on white and look the
same regardless of which mode the app happens to be in when someone hits share. If the app
theme changes again, do NOT let Receipt.tsx start inheriting theme text/divider colors.

It does borrow the new visual *language* though (rounded 20px corners, tight header
tracking, an amber gradient accent bar under the company name, a rounded-pill payment
status badge) — just expressed with fixed constants rather than theme tokens. One
deliberate technique choice: the card's edge uses a zero-blur "ring" box-shadow
(`0 0 0 1px rgba(...)`), not a soft blurred drop shadow — `html2canvas` (which captures this
component to the actual PNG/PDF) crops anything that renders outside the element's own
layout box, so a blurred shadow would come out visibly clipped in the exported image. Keep
any future shadow additions here ring-style for the same reason.

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
- **Local testing**: `vite dev` alone does NOT serve `/api/chat` — use `npx vercel dev`
  (after `vercel login` + `vercel link` to this project), with `GEMINI_API_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` added to the local `.env`.

## Not yet built (next up, in rough priority order)

1. ~~Login screen~~ — done
2. ~~Stock management: Product / Type / Variant CRUD~~ — done
3. ~~New Sale flow~~ — done
4. ~~Receipt generation (PNG/PDF + WhatsApp share)~~ — done
5. ~~Sales list + cancel/edit~~ — done
6. ~~Low-stock page with filters~~ — done
7. Reports (daily/weekly/monthly, chart + PDF export) — chart/period view done in
   `src/pages/SalesReport.tsx`; PDF export still outstanding
8. ~~Settings screen~~ — done
9. ~~Excel import (seed catalog) + export/backup~~ — done
10. ~~AI chatbot for data Q&A~~ — done, see "AI chatbot" section above

Once item 7's PDF export lands, all core screens are done and the design polish pass below
can start.

## Design polish pass — architecture done, per-screen audit still open

The premium dark SaaS overhaul (see "Design direction" above) was applied at the
**styling-architecture level** in `src/theme.ts`, plus a handful of high-leverage inline
fixes: `src/pages/Dashboard.tsx` (accent tile gradient/glow, chart tick color),
`src/pages/Login.tsx` (ambient glow), `src/pages/SalesReport.tsx` (chart tick color), and
PWA theme colors in `index.html` / `vite.config.ts`. Because most screens already build
cards from `Paper` + `borderColor: 'divider'` + `bgcolor: 'background.paper'/'default'`
rather than one-off hex values, this cascaded to nearly every screen automatically without
editing each one by hand — that's why a theme-level rewrite was the right lever for a
request this broad, rather than a screen-by-screen redesign.

**Reference these for further polish — read the actual product, don't guess:**
- **Linear** (linear.app) — primary reference for overall feel: dark surfaces, tight type,
  restrained glow, minimal chrome.
- **Vercel dashboard** (vercel.com) — reference for card elevation, hairline borders, and
  how dense data (tables, lists) reads on a dark surface.
- **Stripe dashboard** — reference for the gradient/glow treatment on primary actions and
  hero cards.

**What's NOT done yet — still worth a dedicated pass if pursued further:**
1. Per-screen micro-interactions (hover/press states, transitions) beyond the Dashboard
   accent tile and the theme-level Button hover glow — list/table rows, dialog actions,
   and form fields haven't been individually audited screen by screen.
2. Deliberate empty and loading states (skeleton loaders, friendly "No sales yet today"
   messages) — most screens still show a bare spinner or blank state.
3. A full spacing-rhythm audit against a 4/8/16/24/32 scale on every individual screen —
   the shared `Layout.tsx` wrapper and MUI's default 8px spacing unit already put most
   screens in the right neighborhood, but nothing has been screen-by-screen verified.
4. Icons are unchanged by this pass — still MUI's Sharp set (`GridViewSharp`,
   `PointOfSaleSharp`, etc.); worth a look at whether Sharp still fits the new rounded,
   soft-shadow surfaces, or whether a rounder icon set would read better against it.

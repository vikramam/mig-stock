# MIG Stock

Stock and sales management for MIG. React + TypeScript + MUI (PWA), backed by Supabase.

## 1. Set up Supabase

1. Create a free project at https://supabase.com.
2. Open the SQL editor and run the entire contents of `supabase/schema.sql`. This creates every
   table, the stock ledger, the atomic sale/cancel/add-stock/payment functions, and the row-level
   security policies.
3. In Project settings → API, copy your Project URL and anon public key.
4. Enable Email/Password auth under Authentication → Providers, and create one user for
   `admin` (Supabase requires an email — you can use something like `admin@mig.local`).

## 2. Run locally

```bash
cp .env.example .env      # fill in your Supabase URL + anon key
npm install
npm run dev
```

## 3. Deploy for free

1. Push this repo to GitHub.
2. Import it into Vercel (vercel.com) — it auto-detects Vite.
3. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the
   Vercel project settings.
4. Every push to `main` auto-deploys.

## What's built so far

- Full database schema, stock ledger, and atomic sale/cancel/restock/payment functions
- App shell: responsive layout (bottom nav on mobile, side nav on desktop), theme, dashboard
  with today's summary, 7-day trend chart, and quick-action tiles

## Next up

New sale flow, stock management (products/types/variants + add stock), receipt generation
(PNG/PDF + WhatsApp share), sales reports, low-stock page, settings (company name, logo, login
toggle).

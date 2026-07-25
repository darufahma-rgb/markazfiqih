# Markaz Fiqh — Islamic Course Platform

An online learning platform for Shafi'i fiqh, built and taught by Indonesian students at Al-Azhar Cairo.

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (`artifacts/markaz-fiqh`)
- **Backend**: Express 5 + Drizzle ORM + Supabase (`artifacts/api-server`)
- **Database**: Supabase (PostgreSQL)
- **Payment**: Mayar.id (webhook skeleton in place)
- **Monorepo**: pnpm workspaces

## How to run

Requires Node.js 22+ (the `nodejs-22` Replit module). Node 20 will not boot the
backend — `@supabase/supabase-js`'s realtime client requires native `WebSocket`,
which only exists from Node 22 onward.

Install dependencies from the repo root first (only needed once after clone):

```bash
pnpm install
```

Two workflows run in parallel:

| Workflow | Command | Port |
|---|---|---|
| `Start application` | `cd artifacts/markaz-fiqh && PORT=5000 BASE_PATH=/ pnpm run dev` | webview (5000) |
| `Backend API` | `cd artifacts/api-server && PORT=8080 pnpm run dev` | 8080 |

The frontend proxies `/api/*` requests to the backend at `http://localhost:8080`.

## Environment variables

Set in Replit Secrets / shared env vars:

| Key | Where to find |
|---|---|
| `SUPABASE_DATABASE_URL` | Supabase Dashboard → Project Settings → Database → URI |
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_URL` | Same as VITE_SUPABASE_URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role |
| `ADMIN_USER_IDS` | Comma-separated Supabase user UUIDs allowed to access /admin |
| `FRONTEND_URL` | Deployed frontend origin (required in production) |
| `MAYAR_API_KEY` | Mayar Dashboard (payment gateway — live, used by `supabase/functions/checkout` & `mayar-webhook`) |
| `MAYAR_WEBHOOK_SECRET` | Mayar Dashboard — shared-secret token Mayar must send back on webhook calls (`?token=` or `Authorization: Bearer`) |
| `MAYAR_BASE_URL` | `https://api.mayar.id/hl/v1` |

## Payment flow (Mayar)

The real checkout/payment implementation is the **Supabase Edge Functions**
in `supabase/functions/` (`checkout`, `mayar-webhook`, `payment-status`,
`simulate-success`, `_shared/mayar.ts`, `_shared/fulfillment.ts`) — the
frontend calls these directly via `src/lib/payments.ts`, not the Express
`api-server`. The webhook re-verifies payment status directly with Mayar's
API before granting access (never trusts the webhook payload alone), and
`fulfillInvoice()` is idempotent so retries/duplicate webhooks are safe.
See `.agents/memory/mayar-integration.md` for details.

Checkout page (`src/pages/CheckoutPage.tsx`) also has: an add-on/upsell
section (`CheckoutAddonOffers.tsx`, suggests 2-3 classes not already in
cart/owned), a logo-based payment method list (`PaymentMethodLogos.tsx`,
logo assets in `public/payment-logos/`), and mobile bottom padding sized to
clear `FloatingCartBar`.

## Class ordering (display_order)

Admin can now set a manual display order for classes (`classes.display_order`,
smaller = shown first). `listClasses()` in `src/lib/db.ts` sorts by
`display_order ASC`, then `created_at DESC` as tiebreaker. Editable in
`AdminClassesPage.tsx` ("Urutan Tampil" field). Requires running
`supabase/migrations/classes_display_order.sql` manually once.

## Kelas Saya & Katalog grouping

Both `MyClassesPage.tsx` and `CatalogPage.tsx` group classes into per-category
sections (heading + grid) when no specific category filter is active
("Semua" / "Semua Kategori"). Selecting a specific category filter reverts to
a flat list scoped to that category. Empty categories are never shown as
headings.

## Project structure

```
artifacts/
  api-server/      Express backend
  markaz-fiqh/     React frontend
  mockup-sandbox/  UI prototyping
attached_assets/   Course images and design docs
```

## Auth / access control

Public routes (`/`, `/katalog`, `/class/:id`, `/paket-bundle`, `/pengajar`, `/pengajar/:id`, `/tentang-kami`, `/ebook/:id`, `/login`, `/onboarding-nama`) are accessible to unauthenticated visitors without requiring login. Protected routes (`/dashboard`, `/my-classes`, `/keranjang`, `/learn/:classId`, `/ebook-saya`, `/checkout`, `/pembayaran/:invoiceId`, `/sertifikat/:id`, `/admin/*`) are wrapped in `ProtectedRoute` or `RequireAdminRoute`. When an unauthenticated visitor attempts a restricted action (e.g. checkout, add to cart, or opening a protected page), they are redirected to `/login?redirect=...` so they land on the right page after signing in. The `ProtectedRoute` component is in `artifacts/markaz-fiqh/src/components/ProtectedRoute.tsx`.

## Replit setup notes

- Re-imported and re-verified on 2026-07-18 (latest): dependencies reinstalled via `pnpm install`, missing secrets (`SUPABASE_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) re-collected, both workflows confirmed running and homepage verified via screenshot.
- Re-imported and re-verified on 2026-07-16: dependencies reinstalled via `pnpm install`, missing secrets (`SUPABASE_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) re-collected, Node module updated to `nodejs-22` in `.replit`, both workflows confirmed running and homepage verified via screenshot.
- Re-imported and re-verified on 2026-07-15: dependencies reinstalled via `pnpm install`, missing secrets (`SUPABASE_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) re-collected, both workflows confirmed running and homepage verified via screenshot.
- Re-imported and re-verified on 2026-07-14: dependencies reinstalled via `pnpm install`, missing secret (`SUPABASE_SERVICE_ROLE_KEY`) re-collected, both workflows confirmed running and homepage verified via screenshot.
- Re-imported and re-verified on 2026-07-13: dependencies reinstalled via `pnpm install`, missing secrets (`SUPABASE_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) re-collected, both workflows confirmed running and homepage verified via screenshot.
- Re-imported and re-verified on 2026-07-11: dependencies reinstalled via `pnpm install`, missing secrets (`SUPABASE_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) re-collected, both workflows confirmed running and homepage verified via screenshot.
- Re-imported and re-verified on 2026-07-09: dependencies reinstalled via `pnpm install`, missing secrets (`SUPABASE_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) re-collected, workflows recreated.
- Secrets configured in Replit Secrets: `SUPABASE_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Two workflows configured and verified running:
  - **Backend API**: `cd artifacts/api-server && PORT=8080 pnpm run dev` → port 8080
  - **Start application**: `cd artifacts/markaz-fiqh && PORT=5000 BASE_PATH=/ pnpm run dev` → port 5000
- Database: Supabase (external) — do not migrate to Replit's built-in PostgreSQL

## User preferences

- Keep the existing pnpm monorepo structure intact
- Do not restructure or migrate the stack without explicit request
- Keep using Supabase — do not migrate to Replit's built-in database

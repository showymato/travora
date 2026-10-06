# TRAVORA — The Operating System for Travel Agencies

Multi-tenant B2B SaaS that replaces WhatsApp, Excel, Word and manual itineraries with one workspace built around **the trip**.

- **Super Admin** (`/admin`) owns the platform: agencies, the hotel catalogue, which agency sees which hotel and at what rate, itinerary templates, subscriptions, reports and the audit log.
- **Travel Agent** (`/app`) runs an isolated agency workspace: guests, a 10-step trip wizard, the Trip Command Center, itinerary builder, documents, payments, calendar and reports.
- **Guests** get a private, always-current trip page at `/trip/[secret-token]` — no login.

## Quick start (local)

Requires Node 20+. No Docker needed: a real PostgreSQL server is bundled via `embedded-postgres`.

```bash
npm install
cp .env.example .env            # then set AUTH_SECRET (and CRON_SECRET)
npm run db:start                # terminal 1 — Postgres on :5434 (data in %LOCALAPPDATA%/travora)
npx prisma migrate deploy       # terminal 2
npm run db:seed                 # wipes the dev DB and loads demo data
npm run dev                     # http://localhost:3000
```

### Development credentials (seed only — never use in production)

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `admin@travora.local` | `Travora@2026` |
| Agent — ABC Travels | `demo@travora.local` | `Travora@2026` |
| Agent — Kashmir Holidays | `kashmir@travora.local` | `Travora@2026` |
| Agent — Paradise Tours (trial) | `paradise@travora.local` | `Travora@2026` |

Seed data is fictional (people, phone numbers and `*.example` emails) and dated relative to today, so the dashboards always show trips arriving, ongoing and upcoming. Trips are built through the real service layer.

## Verifying

| Command | What it checks |
| --- | --- |
| `npm run verify` | `tsc` + ESLint + 47 Vitest tests (unit, auth, **tenant isolation**, every workflow) on `TEST_DATABASE_URL` |
| `npm run e2e` | The full 30-step acceptance scenario through the real UI (admin → agency → hotel → rate → template → agent → trip → docs → send → guest page → edit Day 3 → publish), plus HTTP-level isolation checks. Needs a running app (`BASE_URL`, default `:3000`); creates uniquely named records, re-runnable. |
| `npm run smoke [-- --mobile \| --width=1024]` | Visits all 68 routes as each role; fails on non-200, console errors or horizontal overflow. Screenshots in `screenshots/smoke`. |
| `npm run a11y [-- --dark]` | axe-core WCAG 2.1 A/AA scan of key screens. |

Last run: typecheck/lint clean · 47/47 tests · e2e 30/30 on dev **and** `next build && next start` · smoke 68/68 at 375, 390, 768, 1024 and 1440 px · axe: no violations (light and dark).

## Architecture

```
src/
  app/                 routes: (marketing) /, (auth) /login, /admin, /app, /trip/[token], /api/*
  server/              all business logic (server-only); actions/ are thin "use server" wrappers
    auth/              scrypt passwords, HMAC'd DB sessions, actor guards
    trips/             core, lines (hotels/transport/activities), itinerary, publish, queries, checks
    documents/         @react-pdf PDF generation → private storage
    ops.ts             pending-action engine, Today feed, calendar, global search, dashboards
  components/          shell (sidebar, ⌘K, notifications), trips (wizard, command center, builder), admin, ui (shadcn)
  lib/                 shared pure code: zod schemas, dates, pricing, labels
prisma/                schema, migrations, seed
tests/ scripts/        vitest suites; e2e / smoke / a11y / screenshot scripts
```

**Stack:** Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`) · TypeScript · Tailwind v4 · shadcn/ui · Prisma 6 + PostgreSQL · Zod · React Hook Form · dnd-kit · @react-pdf/renderer · Vitest · Playwright.

### Key decisions

- **The trip is the central object.** Hotels, rooms, transfers, activities, itinerary days/items, documents, payments, notes and versions all hang off `Trip`. Adding a transfer or hotel automatically creates/moves its itinerary item; trip dates flow into stay and room dates; moving a trip shifts everything with it.
- **Tenant isolation is enforced on the server.** Every agency-owned row carries `agencyId` and every query filters on the `agencyId` from the authenticated session — never from request input. `/app/trips/[id]` and `/app/guests/[id]` layouts return a real 404 for another agency's ids. Tested in `tests/isolation.test.ts` and over HTTP in `scripts/e2e.mjs`.
- **Agent pricing.** `HotelRate(roomId, agencyId)` overrides the platform base rate. Agent-facing hotel queries select only the agency's effective rate; `baseRate` and other agencies' rates never leave the server (asserted in tests). Booked rooms snapshot the rate.
- **Guest page = published snapshot.** Sending a trip stores an immutable `TripVersion` (JSON snapshot without rates, notes, ID numbers or payments). Later edits set `hasUnpublishedChanges` and stay private until the agent publishes an update (optionally emailing the guest). Every version is kept, giving full itinerary history. Share tokens are 256-bit random; links can be rotated or disabled.
- **Itinerary generation never invents critical facts.** It builds days from hotels (real check-in/out times), transfers and activities; arrival/departure without flight details and hotel changes without transport are flagged as placeholders, which also feed the pending-action engine. Templates fill days, while real bookings replace template placeholders.
- **AI-ready.** `ItemSource` already includes `AI_DRAFT`; an AI planner can write draft items through the same itinerary service the UI uses, and the agent reviews before publishing. No availability or booking is ever confirmed automatically.
- **Auth.** Custom sessions instead of Auth.js: credentials-only sign-in with DB-backed, revocable sessions (suspending an agency signs its users out instantly) was simpler and more reliable than Auth.js's credentials provider. Cookies are `httpOnly`, `SameSite=Lax`, `Secure` in production; session ids are stored as HMAC(AUTH_SECRET). Login is rate-limited per account and per IP (Postgres-backed, works across serverless instances). Server Actions carry Next's built-in origin check (CSRF).
- **Private files.** Guest ID documents and generated PDFs live in private storage (`local` disk in dev, private Vercel Blob in production), keyed by agency, streamed only through authorising routes; guest-document views are audited. Uploads are type-checked by magic bytes, not the browser's claim.
- **Money** is whole INR. Trip totals are computed from priced lines (or a package-price override) and cached on `Trip.totalAmount` for reports. Payment state (UNPAID/PARTIAL/PAID) is derived, never stored. Invoices split 5% GST out of tax-inclusive prices.
- **Audit log** records user, agency, action, entity and before/after diffs for every mutation; viewable per trip, per agency, per hotel and globally (`/admin/settings`).

### Integrations — what is and isn't connected

| Area | Status |
| --- | --- |
| Email | Provider abstraction with 9 templates (all triggered by workflows except "Trip created", which is defined but not sent automatically). `EMAIL_PROVIDER=log` (default) records to `EmailLog` and writes HTML to `.data/emails/`. `resend` sends via the Resend HTTP API — **implemented but never run against a real Resend key**. |
| File storage | `local` verified. `vercel-blob` (private) implemented, **not run against a real store**. `local` refuses to start on Vercel. |
| Payments | Manual recording (MVP). Schema has `provider`/`providerPaymentId` for Razorpay; **no Razorpay integration yet**. |
| Subscription billing | Manual period extension in `/admin/subscriptions`; no payment collection. |
| Cron | `/api/cron/daily` (status roll-over, "starts tomorrow" alerts, guest reminder emails, trial alerts), scheduled in `vercel.json`. Verified locally with the bearer secret. |
| Deployment | Builds with `next build`; **not yet deployed**. On Vercel set `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `CRON_SECRET`, `STORAGE_PROVIDER=vercel-blob` + Blob token, and email settings. |

### Known limitations

- One user per agency is created by the admin; inviting additional agency staff is not built yet (the schema supports many users per agency).
- Agencies can't upload a logo yet; documents and emails brand with the agency name and contact details.
- Prices are whole rupees; multi-currency is not supported.
- Only Chromium was used for automated browser testing.

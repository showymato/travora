@AGENTS.md

# TRAVORA

See README.md for architecture, verify commands and what is/isn't integrated.

- Business logic lives in `src/server` (server-only). Every agency-scoped query must filter on `actor.agencyId` from the session — never a client-supplied id.
- Helpers called from Server Components must not live in `"use client"` files (put them in `src/lib`).
- Calendar dates are `@db.Date` + "YYYY-MM-DD" strings; format with `src/lib/dates.ts` (hand-rolled, hydration-safe — don't use Intl for dates in client components).
- Responsive grids need `grid-cols-1` (minmax(0,1fr)) or mobile overflows.
- Verify: `npm run verify`, then with the app running `npm run e2e`, `npm run smoke -- --mobile`, `npm run a11y`.

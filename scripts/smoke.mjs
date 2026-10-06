// Visits every main route as each role and reports status, console errors and
// horizontal overflow. Screenshots go to screenshots/smoke/.
//   node scripts/smoke.mjs [--mobile] [--only=admin|agent|public]
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const mobile = process.argv.includes("--mobile");
const width = Number(process.argv.find((a) => a.startsWith("--width="))?.split("=")[1] ?? (mobile ? 390 : 1440));
const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const db = new PrismaClient();

const abc = await db.agency.findFirstOrThrow({ where: { name: "ABC Travels" } });
const trip = await db.trip.findFirstOrThrow({ where: { agencyId: abc.id, code: "TRV-10002" } });
const draft = await db.trip.findFirst({ where: { agencyId: abc.id, status: "PLANNING" } });
const guest = await db.guest.findFirstOrThrow({ where: { agencyId: abc.id, fullName: "Amit Gupta" } });
const hotel = await db.hotel.findFirstOrThrow({ where: { name: "Blanco Hotel" } });
const tpl = await db.itineraryTemplate.findFirstOrThrow();
const shared = await db.trip.findFirstOrThrow({ where: { agencyId: abc.id, shareEnabled: true, shareToken: { not: null } } });
await db.$disconnect();

const routes = {
  public: ["/", "/login", `/trip/${shared.shareToken}`],
  agent: [
    "/app",
    "/app/trips",
    "/app/trips/new",
    `/app/trips/${trip.id}`,
    ...["itinerary", "hotels", "transport", "guests", "documents", "payments", "activity"].map((t) => `/app/trips/${trip.id}?tab=${t}`),
    ...(draft ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => `/app/trips/${draft.id}/plan?step=${s}`) : []),
    "/app/guests",
    "/app/guests/new",
    `/app/guests/${guest.id}`,
    `/app/guests/${guest.id}?tab=documents`,
    `/app/guests/${guest.id}/edit`,
    "/app/hotels",
    `/app/hotels/${hotel.id}`,
    "/app/calendar",
    "/app/calendar?view=week",
    "/app/calendar?view=day",
    "/app/documents",
    "/app/payments",
    "/app/reports",
    "/app/settings",
    "/account/password",
  ],
  admin: [
    "/admin",
    "/admin/agents",
    "/admin/agents/new",
    `/admin/agents/${abc.id}`,
    ...["trips", "guests", "hotels", "activity", "settings"].map((t) => `/admin/agents/${abc.id}?tab=${t}`),
    `/admin/agents/${abc.id}/edit`,
    `/admin/agents/${abc.id}/hotels`,
    "/admin/hotels",
    "/admin/hotels/new",
    `/admin/hotels/${hotel.id}`,
    ...["rooms", "rates", "amenities", "agents", "activity"].map((t) => `/admin/hotels/${hotel.id}?tab=${t}`),
    `/admin/hotels/${hotel.id}/edit`,
    "/admin/trips",
    `/admin/trips/${trip.id}`,
    "/admin/calendar",
    "/admin/templates",
    "/admin/templates/new",
    `/admin/templates/${tpl.id}`,
    "/admin/reports",
    "/admin/subscriptions",
    "/admin/settings",
  ],
};

const browser = await chromium.launch();
const results = [];
fs.mkdirSync("screenshots/smoke", { recursive: true });
for (const role of ["public", "agent", "admin"]) {
  if (only && only !== role) continue;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 } });
  const page = await ctx.newPage();
  let errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  if (role !== "public") {
    await page.goto(`${base}/login`);
    await page.fill("#email", role === "admin" ? "admin@travora.local" : "demo@travora.local");
    await page.fill("#password", "Travora@2026");
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), page.click("button[type=submit]")]);
  }
  for (const path of routes[role]) {
    errors = [];
    const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 }).catch((e) => ({ status: () => `ERR ${e.message.slice(0, 80)}` }));
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => -1);
    const name = `${role}${path.replace(/[^a-z0-9]+/gi, "_").slice(0, 80)}_${width}`;
    await page.screenshot({ path: `screenshots/smoke/${name}.png`, fullPage: false }).catch(() => {});
    const status = res?.status?.();
    const bad = status !== 200 || overflow > 0 || errors.length;
    results.push({ role, path, status, overflow, errors: errors.slice(0, 3) });
    console.log(`${bad ? "✗" : "✓"} ${status} ${role} ${path}${overflow > 0 ? ` overflow=${overflow}` : ""}${errors.length ? ` errors=${JSON.stringify(errors.slice(0, 2))}` : ""}`);
  }
  await ctx.close();
}
await browser.close();
const failures = results.filter((r) => r.status !== 200 || r.overflow > 0 || r.errors.length);
console.log(`\n${results.length - failures.length}/${results.length} clean at ${width}px`);
process.exitCode = failures.length ? 1 : 0;

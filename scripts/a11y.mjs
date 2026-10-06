// axe-core WCAG 2.1 A/AA scan of key screens, light and dark.
//   node scripts/a11y.mjs [--dark]
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const dark = process.argv.includes("--dark");
const db = new PrismaClient();
const abc = await db.agency.findFirstOrThrow({ where: { name: "ABC Travels" } });
const trip = await db.trip.findFirstOrThrow({ where: { agencyId: abc.id, code: "TRV-10002" } });
const planning = await db.trip.findFirstOrThrow({ where: { agencyId: abc.id, status: "PLANNING" } });
const guest = await db.guest.findFirstOrThrow({ where: { agencyId: abc.id } });
const hotel = await db.hotel.findFirstOrThrow({ where: { name: "Blanco Hotel" } });
const shared = await db.trip.findFirstOrThrow({ where: { agencyId: abc.id, shareEnabled: true } });
await db.$disconnect();

const sets = {
  none: ["/", "/login", `/trip/${shared.shareToken}`],
  agent: ["/app", "/app/trips", "/app/trips/new", `/app/trips/${trip.id}`, `/app/trips/${trip.id}?tab=itinerary`, `/app/trips/${trip.id}?tab=documents`, `/app/trips/${planning.id}/plan?step=3`, `/app/trips/${planning.id}/plan?step=4`, `/app/trips/${planning.id}/plan?step=9`, `/app/guests`, `/app/guests/${guest.id}`, "/app/calendar", "/app/payments", "/app/reports"],
  admin: ["/admin", "/admin/agents", "/admin/agents/new", `/admin/agents/${abc.id}/hotels`, `/admin/hotels/${hotel.id}?tab=rates`, "/admin/templates/new", "/admin/settings"],
};

const browser = await chromium.launch();
let total = 0;
for (const [role, paths] of Object.entries(sets)) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: dark ? "dark" : "light" });
  const page = await ctx.newPage();
  if (role !== "none") {
    await page.goto(`${base}/login`);
    await page.fill("#email", role === "admin" ? "admin@travora.local" : "demo@travora.local");
    await page.fill("#password", "Travora@2026");
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
  }
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    // nextjs-portal is the dev-only error overlay host.
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("nextjs-portal").analyze();
    for (const v of r.violations) {
      total++;
      console.log(`✗ ${role} ${p} — ${v.id} (${v.impact}): ${v.help}`);
      for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(" ")} ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(total ? `\n${total} violation(s)` : "\nNO VIOLATIONS");
process.exitCode = total ? 1 : 0;

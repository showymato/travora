// End-to-end acceptance scenario (spec §80), driven through the real UI.
// Requires a running app (BASE_URL, default http://localhost:3000) on a seeded DB.
// Creates uniquely-named records each run, so it can be re-run safely.
//   node scripts/e2e.mjs [--headed]
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const run = Date.now().toString(36).slice(-5).toUpperCase();
const AGENCY = `ABC Travels ${run}`;
const LOGIN = `abc-${run.toLowerCase()}@travora.local`;
const HOTEL = `Blanco Hotel ${run}`;
const TEMPLATE = `Kashmir 6N/7D ${run}`;
const NEW_PASSWORD = "Agent-pass-2026";
const db = new PrismaClient();

let step = 0;
const passed = [];
async function check(name, fn) {
  step++;
  const t = Date.now();
  try {
    await fn();
    passed.push(name);
    console.log(`✓ ${String(step).padStart(2, "0")} ${name} (${Date.now() - t}ms)`);
  } catch (e) {
    console.log(`✗ ${String(step).padStart(2, "0")} ${name}\n   ${String(e.message ?? e).split("\n").slice(0, 4).join("\n   ")}`);
    await page?.screenshot({ path: `screenshots/e2e-fail-${step}.png`, fullPage: true }).catch(() => {});
    await browser.close();
    await db.$disconnect();
    process.exit(1);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch({ headless: !process.argv.includes("--headed") });
let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let page = await ctx.newPage();
const consoleErrors = [];
const watch = (p) => p.on("pageerror", (e) => consoleErrors.push(String(e)));
watch(page);
page.setDefaultTimeout(45_000);

async function login(email, password) {
  await page.goto(`${base}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 }), page.click("button[type=submit]")]);
}
async function settle() {
  await page.waitForLoadState("networkidle");
}
const toast = (text) => page.locator("[data-sonner-toast]", { hasText: text }).first().waitFor();

// Dates: 10 Oct → 16 Oct of the next upcoming October 10th.
const now = new Date();
const year = now.getUTCMonth() > 9 || (now.getUTCMonth() === 9 && now.getUTCDate() >= 10) ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
const START = `${year}-10-10`;
const END = `${year}-10-16`;

let agencyId, hotelId, tempPassword, tripId, guestUrl;

// ---------------------------------------------------------------- SUPER ADMIN
await check("Super Admin logs in", async () => {
  await login("admin@travora.local", "Travora@2026");
  expect(new URL(page.url()).pathname === "/admin", `landed on ${page.url()}`);
});

await check(`Creates agency "${AGENCY}" with its agent user`, async () => {
  await page.goto(`${base}/admin/agents/new`);
  await settle();
  await page.getByLabel("Agency name").fill(AGENCY);
  await page.getByLabel("Owner name").fill("Rahul Verma");
  await page.getByLabel("Email", { exact: false }).first().fill(`owner-${run.toLowerCase()}@abc.example`);
  await page.getByLabel("Phone").fill("+91 98100 11223");
  await page.getByLabel("City").fill("New Delhi");
  await page.getByRole("radio", { name: /^Growth/ }).click();
  await page.getByLabel("Login email").fill(LOGIN);
  tempPassword = await page.getByLabel("Temporary password").inputValue();
  await page.getByRole("radio", { name: "active" }).click();
  await page.getByRole("button", { name: "Create agency" }).click();
  await page.getByText(`${AGENCY} is ready`).waitFor();
  await page.getByRole("link", { name: "Open agency" }).click();
  await page.waitForURL(/\/admin\/agents\/(?!new)[a-z0-9]+$/);
  agencyId = page.url().split("/").pop();
  const u = await db.user.findUnique({ where: { email: LOGIN } });
  expect(u?.role === "AGENT" && u.agencyId === agencyId, "agent user not linked to agency");
});

await check(`Creates hotel "${HOTEL}"`, async () => {
  await page.goto(`${base}/admin/hotels/new`);
  await settle();
  await page.getByLabel("Hotel name").fill(HOTEL);
  await page.getByLabel("Destination").fill("Srinagar");
  await page.getByLabel(/^Location\*?$/).fill("Srinagar, Boulevard Road");
  await page.getByRole("button", { name: "Create hotel & add rooms" }).click();
  await page.waitForURL(/\/admin\/hotels\/[a-z0-9]+\?tab=rooms/);
  hotelId = new URL(page.url()).pathname.split("/").pop();
});

await check("Creates the Deluxe room type", async () => {
  await page.getByRole("button", { name: "Add room type" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Room name").fill("Deluxe");
  await dlg.getByLabel("Base rate (₹ / night)").fill("8000");
  await dlg.getByLabel("Max guests").fill("3");
  await dlg.getByLabel("Number of rooms").fill("10");
  await dlg.getByRole("button", { name: "Add room" }).click();
  await dlg.waitFor({ state: "hidden" });
  await page.getByText("₹8,000", { exact: true }).waitFor();
});

await check(`Assigns ${HOTEL} to ${AGENCY}`, async () => {
  await page.goto(`${base}/admin/agents/${agencyId}/hotels`);
  await settle();
  await page.getByLabel("Search hotels").fill(run);
  await page.getByRole("checkbox", { name: `Give access to ${HOTEL}` }).click();
  await page.getByRole("button", { name: "Save access" }).click();
  await toast("1 added");
  expect((await db.agentHotel.count({ where: { agencyId, hotelId } })) === 1, "assignment not saved");
});

await check("Configures the agency's rate (₹7,200)", async () => {
  await page.goto(`${base}/admin/hotels/${hotelId}?tab=rates`);
  await settle();
  await page.getByLabel(AGENCY).fill("7200");
  await page.getByRole("button", { name: "Save rates" }).click();
  await toast("Agency rates saved");
  const rate = await db.hotelRate.findFirst({ where: { agencyId } });
  expect(rate?.rate === 7200, "rate not saved");
});

await check(`Creates itinerary template "${TEMPLATE}"`, async () => {
  await page.goto(`${base}/admin/templates/new`);
  await settle();
  await page.getByLabel("Name").fill(TEMPLATE);
  await page.getByLabel("Nights").fill("6");
  await page.getByLabel("Day 1 title").fill("Arrival in Srinagar");
  await page.getByRole("button", { name: "Add item" }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Title").fill("Shikara ride on Dal Lake");
  await dlg.getByLabel("Time").fill("17:00");
  await dlg.getByRole("button", { name: "Save" }).click();
  await dlg.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Save template" }).click();
  await page.waitForURL(/\/admin\/templates\/(?!new)[a-z0-9]+$/);
  const t = await db.itineraryTemplate.findFirst({ where: { name: TEMPLATE }, include: { days: true } });
  expect(t?.days.length === 7, "template days missing");
});

// ---------------------------------------------------------------- AGENT
await check(`Agent logs in to ${AGENCY} and sets a password`, async () => {
  await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage();
  watch(page);
  page.setDefaultTimeout(45_000);
  await login(LOGIN, tempPassword);
  expect(page.url().includes("/account/password"), "forced password change not shown");
  await page.getByLabel("Temporary password").fill(tempPassword);
  await page.getByLabel(/^New password\*?$/).fill(NEW_PASSWORD);
  await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await page.waitForURL(`${base}/app`);
  await page.getByText(AGENCY).first().waitFor();
});

await check("Creates guest Rahul Sharma", async () => {
  await page.goto(`${base}/app/guests/new`);
  await settle();
  await page.getByLabel("Full name").fill("Rahul Sharma");
  await page.getByLabel(/^Phone\*?$/).fill("+91 98765 43210");
  await page.getByLabel("Email").fill(`rahul.${run.toLowerCase()}@example.com`);
  await page.getByRole("button", { name: "Create guest" }).click();
  await page.waitForURL(/\/app\/guests\/(?!new)[a-z0-9]+$/);
  await page.getByRole("heading", { name: "Rahul Sharma" }).waitFor();
});

await check("Starts a new trip", async () => {
  await page.goto(`${base}/app/trips/new`);
  await settle();
  await page.getByLabel("Search guests").fill("Rahul Sharma");
  await page.getByRole("button", { name: /Rahul Sharma/ }).first().click();
});

await check("Selects Rahul Sharma as the primary guest", async () => {
  await page.getByText("Primary guest · main contact").waitFor();
  await page.getByRole("button", { name: "Start trip" }).click();
  await page.waitForURL(/\/plan\?step=2/);
  tripId = new URL(page.url()).pathname.split("/")[3];
});

await check(`Sets dates ${START} → ${END}`, async () => {
  await page.getByLabel("Arrival").fill(START);
  await page.getByLabel("Departure").fill(END);
  await page.getByText("Nights", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/step=3/);
  const t = await db.trip.findUniqueOrThrow({ where: { id: tripId } });
  expect(t.startDate.toISOString().startsWith(START), "dates not saved");
});

for (const place of ["Srinagar", "Gulmarg", "Pahalgam"]) {
  await check(`Adds destination ${place}`, async () => {
    await page.getByLabel(/^Destination$/).fill(place);
    await page.getByLabel(/^Destination$/).press("Enter");
    await page.getByLabel(`Nights in ${place}`, { exact: true }).waitFor();
  });
}

await check(`Finds ${HOTEL} in Srinagar with filters and opens its details`, async () => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/step=4/);
  await settle();
  // Srinagar is the first unplanned destination, so it is selected already.
  await page.getByRole("heading", { name: "Find the perfect stay in Srinagar" }).waitFor();
  await page.getByLabel("Search hotels").fill(HOTEL);
  await page.getByRole("button", { name: /^Price/ }).click();
  await page.getByLabel("Max price per night").fill("9000");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Remove filter Up to ₹9,000/night" }).waitFor();
  await page.getByRole("button", { name: `Details for ${HOTEL}` }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("heading", { name: "Choose rooms" }).waitFor();
  await sheet.getByText("₹7,200").first().waitFor(); // agency rate, not the ₹8,000 base rate
  expect(!(await sheet.getByText("₹8,000").count()), "base rate leaked to the agent");
});

await check("Selects the hotel with 2 Deluxe rooms at the agency rate", async () => {
  const sheet = page.getByRole("dialog");
  const more = sheet.getByRole("button", { name: "More Deluxe rooms" });
  const qty = async () => Number(await sheet.getByRole("group", { name: "Number of Deluxe rooms" }).locator("span").innerText());
  while ((await qty()) < 2) await more.click();
  await sheet.getByText("Deluxe — 2 rooms × 2 nights × ₹7,200").waitFor();
  await sheet.getByRole("button", { name: "Select hotel" }).click();
  await toast(`${HOTEL} added for Srinagar`);
  await sheet.waitFor({ state: "hidden" });
  const rooms = await db.tripRoom.findMany({ where: { tripId } });
  expect(rooms.length === 1 && rooms[0].quantity === 2 && rooms[0].nightlyRate === 7200, "rooms not saved at the agency rate");
  expect((await db.tripHotel.count({ where: { tripId } })) === 1, "duplicate stay");
  await page.goto(`${base}/app/trips/${tripId}/plan?step=5`);
  await page.getByText("₹7,200 × 2 × 2N").first().waitFor();
});

await check("Adds transport (airport pickup)", async () => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/step=6/);
  await settle();
  await page.locator("li", { hasText: "Airport pickup on" }).getByRole("button", { name: "Add" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Pickup time").fill("09:30");
  await dlg.getByLabel(/^Driver$/).fill("Bashir Ahmad");
  await dlg.getByRole("button", { name: "Add transport" }).click();
  await dlg.waitFor({ state: "hidden" });
  await page.getByText("Srinagar Airport →").first().waitFor();
});

await check("Adds activities", async () => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/step=7/);
  await settle();
  await page.getByRole("button", { name: "Sightseeing" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Title").fill("Mughal gardens tour");
  await dlg.getByLabel("Location").fill("Srinagar");
  await dlg.getByRole("button", { name: "Add activity" }).click();
  await dlg.waitFor({ state: "hidden" });
  await page.getByText("Mughal gardens tour").waitFor();
});

await check("Generates the itinerary", async () => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/step=8/);
  await settle();
  await page.getByRole("button", { name: "Generate itinerary" }).click();
  await toast("Itinerary generated");
  await page.getByRole("heading", { name: /Arrival/ }).first().waitFor();
  expect((await db.itineraryDay.count({ where: { tripId } })) === 7, "expected 7 days");
});

await check("Edits the itinerary (adds an item to Day 1)", async () => {
  await page.getByRole("button", { name: "Add item" }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Title").fill("Welcome kahwa at the hotel");
  await dlg.getByLabel("Time").fill("16:00");
  await dlg.getByRole("button", { name: "Save" }).click();
  await dlg.waitFor({ state: "hidden" });
  await page.getByText("Welcome kahwa at the hotel").waitFor();
});

await check("Saves the trip (review → ready)", async () => {
  await page.getByRole("button", { name: "Review trip" }).click();
  await page.waitForURL(/step=9/);
  await settle();
  await page.getByRole("button", { name: "Save trip & continue" }).click();
  await page.waitForURL(/step=10/);
  expect((await db.trip.findUniqueOrThrow({ where: { id: tripId } })).status === "READY", "trip not READY");
});

await check("Generates documents (itinerary, hotel voucher, invoice)", async () => {
  await page.goto(`${base}/app/trips/${tripId}?tab=documents`);
  await settle();
  for (const name of ["Itinerary", "Hotel voucher", "Invoice"]) {
    const popup = page.waitForEvent("popup", { timeout: 20_000 }).catch(() => null);
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    const p = await popup;
    await p?.close();
    await page.locator("li", { hasText: name === "Invoice" ? "Invoice INV-" : name }).first().waitFor();
  }
  const docs = await db.document.findMany({ where: { tripId } });
  expect(docs.length >= 3, `only ${docs.length} documents`);
  const res = await page.request.get(`${base}/api/documents/${docs[0].id}`);
  expect(res.status() === 200 && (await res.body()).subarray(0, 4).toString() === "%PDF", "document download failed");
});

await check("Sends the itinerary to the guest", async () => {
  await page.goto(`${base}/app/trips/${tripId}/plan?step=10`);
  await settle();
  await page.getByLabel("Personal note (optional)").fill("Hi Rahul, here is your Kashmir plan!");
  await page.getByRole("button", { name: "Send to guest" }).click();
  await page.getByText("Sent to Rahul Sharma").waitFor();
  guestUrl = (await page.locator(".font-mono", { hasText: "/trip/" }).first().textContent()).trim();
  expect(/\/trip\/[A-Za-z0-9_-]{43}$/.test(guestUrl), `bad guest url ${guestUrl}`);
  expect((await db.trip.findUniqueOrThrow({ where: { id: tripId } })).status === "SENT", "status not SENT");
});

let guestPage;
await check("Opens the guest trip page (no login)", async () => {
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
  guestPage = await anon.newPage();
  const res = await guestPage.goto(guestUrl.replace(/^https?:\/\/[^/]+/, base));
  expect(res.status() === 200, `guest page ${res.status()}`);
});

await check("All trip information is visible to the guest", async () => {
  for (const text of ["Prepared for Rahul Sharma", HOTEL, "Mughal gardens tour", "Welcome kahwa at the hotel", "Srinagar Airport", "Bashir Ahmad", "Srinagar → Gulmarg → Pahalgam"]) {
    await guestPage.getByText(text).first().waitFor({ timeout: 10_000 });
  }
  await guestPage.getByText("Itinerary · PDF").first().waitFor();
  const body = await guestPage.content();
  expect(!body.includes("7,200") && !body.includes("8,000"), "guest page leaks rates");
});

await check("Modifies Day 3", async () => {
  await page.goto(`${base}/app/trips/${tripId}?tab=itinerary`);
  await settle();
  const addButtons = page.getByRole("button", { name: "Add item" });
  await addButtons.nth(2).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Title").fill("Dinner at Ahdoos");
  await dlg.getByLabel("Time").fill("20:00");
  await dlg.getByRole("button", { name: "Save" }).click();
  await dlg.waitFor({ state: "hidden" });
  await page.getByText("Dinner at Ahdoos").waitFor();
  const d3 = await db.itineraryDay.findFirstOrThrow({ where: { tripId, dayNumber: 3 }, include: { items: true } });
  expect(d3.items.some((i) => i.title === "Dinner at Ahdoos"), "item not on Day 3");
});

await check("Saves (publishes the update to the guest)", async () => {
  await page.getByText("Unpublished changes").first().waitFor();
  await page.getByRole("button", { name: "Publish update" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("What changed?").fill("Day 3: dinner at Ahdoos added");
  await dlg.getByRole("button", { name: "Publish" }).click();
  await toast("Update published");
});

await check("Guest page reflects the updated Day 3", async () => {
  await guestPage.reload();
  await guestPage.locator("#day-3").getByText("Dinner at Ahdoos").waitFor({ timeout: 10_000 });
});

// ---------------------------------------------------------------- ISOLATION
await check("Tenant isolation over HTTP (UI routes and APIs)", async () => {
  const other = await db.trip.findFirstOrThrow({ where: { agency: { name: "ABC Travels" } } });
  const otherDoc = await db.document.findFirst({ where: { agencyId: other.agencyId } });
  const otherGuest = await db.guest.findFirstOrThrow({ where: { agencyId: other.agencyId } });
  const r1 = await page.request.get(`${base}/app/trips/${other.id}`);
  expect(r1.status() === 404, `foreign trip page returned ${r1.status()}`);
  const r2 = await page.request.get(`${base}/app/guests/${otherGuest.id}`);
  expect(r2.status() === 404, `foreign guest page returned ${r2.status()}`);
  if (otherDoc) {
    const r3 = await page.request.get(`${base}/api/documents/${otherDoc.id}`);
    expect([403, 404].includes(r3.status()), `foreign document returned ${r3.status()}`);
  }
  const r4 = await page.request.get(`${base}/admin`, { maxRedirects: 0 });
  expect([303, 307, 308].includes(r4.status()) || (await r4.text()).includes("NEXT_REDIRECT"), `agent reached /admin (${r4.status()})`);
  const anon = await browser.newContext();
  const r5 = await anon.request.get(`${base}/app`, { maxRedirects: 0 });
  expect([303, 307, 308].includes(r5.status()), `anonymous /app returned ${r5.status()}`);
  const r6 = await anon.request.get(`${base}/api/documents/${(await db.document.findFirstOrThrow({ where: { tripId } })).id}`);
  expect(r6.status() === 401, `anonymous document returned ${r6.status()}`);
  const r7 = await anon.request.get(`${base}/trip/${"A".repeat(43)}`);
  expect(r7.status() === 404, `guessed token returned ${r7.status()}`);
  await anon.close();
});

await browser.close();
await db.$disconnect();
console.log(`\n${passed.length}/${step} acceptance checks passed${consoleErrors.length ? ` — ${consoleErrors.length} page errors: ${consoleErrors.slice(0, 3).join(" | ")}` : ", no page errors"}.`);
process.exitCode = consoleErrors.length ? 1 : 0;

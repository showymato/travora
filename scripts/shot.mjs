// Screenshot helper for visual QA.
//   node scripts/shot.mjs <role:admin|agent|none> <path> [width=1440] [out=screenshots/x.png] [--full] [--dark]
import { chromium } from "playwright";
import fs from "node:fs";

const [role = "agent", path = "/", width = "1440", out] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const full = process.argv.includes("--full");
const dark = process.argv.includes("--dark");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const creds = { admin: "admin@travora.local", agent: "demo@travora.local" };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: Number(width), height: Number(width) < 600 ? 844 : 900 }, colorScheme: dark ? "dark" : "light", deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

if (role !== "none") {
  await page.goto(`${base}/login`);
  await page.fill("#email", creds[role]);
  await page.fill("#password", "Travora@2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), page.click("button[type=submit]")]);
}
await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(600);
fs.mkdirSync("screenshots", { recursive: true });
const file = out ?? `screenshots/${role}${path.replace(/[^a-z0-9]+/gi, "_")}_${width}.png`;
await page.screenshot({ path: file, fullPage: full });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log(JSON.stringify({ file, status: "ok", horizontalOverflow: overflow, errors }));
await browser.close();

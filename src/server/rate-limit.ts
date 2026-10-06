import "server-only";
import { db } from "./db";
import { AppError } from "./errors";

// Fixed-window counter stored in Postgres, so limits hold across serverless
// instances. One upsert per check.
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" = EXCLUDED."windowStart" THEN "RateLimit"."count" + 1 ELSE 1 END,
      "windowStart" = EXCLUDED."windowStart"
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: new Date(windowStart.getTime() + windowSeconds * 1000) };
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const r = await rateLimit(key, limit, windowSeconds);
  if (!r.allowed) throw new AppError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.");
  return r;
}

/** Current count for a key without incrementing it. */
export async function peekRateLimit(key: string, windowSeconds: number) {
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row) return 0;
  const windowStart = Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000;
  return row.windowStart.getTime() === windowStart ? row.count : 0;
}

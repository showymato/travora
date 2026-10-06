import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../db";
import type { Rendered, TemplateName } from "./templates";

/**
 * Email delivery. EMAIL_PROVIDER:
 *  - "log"    (default): nothing leaves the machine; the message is recorded in
 *              EmailLog (status LOGGED) and, outside Vercel, written to
 *              .data/emails/<id>.html so it can be opened locally.
 *  - "resend": sends through the Resend HTTP API (RESEND_API_KEY, EMAIL_FROM).
 *
 * Sending never throws into the caller's business flow: a failed email is
 * logged (status FAILED) and reported back so the UI can say so.
 */
export type SendResult = { ok: boolean; status: "SENT" | "LOGGED" | "FAILED"; logId: string; error?: string };

export async function sendEmail(
  template: TemplateName,
  to: string,
  rendered: Rendered,
  ctx: { agencyId?: string | null; tripId?: string | null } = {},
): Promise<SendResult> {
  const provider = (process.env.EMAIL_PROVIDER ?? "log").toLowerCase();
  const base = { template, to, subject: rendered.subject, agencyId: ctx.agencyId ?? null, tripId: ctx.tripId ?? null, provider };

  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) {
      const log = await db.emailLog.create({ data: { ...base, status: "FAILED", error: "RESEND_API_KEY / EMAIL_FROM not configured" } });
      return { ok: false, status: "FAILED", logId: log.id, error: "Email is not configured." };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject: rendered.subject, html: rendered.html, text: rendered.text }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      const log = await db.emailLog.create({ data: { ...base, status: "SENT", providerId: body.id ?? null } });
      return { ok: true, status: "SENT", logId: log.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const log = await db.emailLog.create({ data: { ...base, status: "FAILED", error: message.slice(0, 500) } });
      return { ok: false, status: "FAILED", logId: log.id, error: "The email provider rejected the message." };
    }
  }

  const log = await db.emailLog.create({ data: { ...base, provider: "log", status: "LOGGED" } });
  if (!process.env.VERCEL && process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), ".data", "emails");
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    await fs.writeFile(path.join(dir, `${log.id}.html`), rendered.html).catch(() => {});
  }
  return { ok: true, status: "LOGGED", logId: log.id };
}

export function appUrl(p = "") {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${p}`;
}

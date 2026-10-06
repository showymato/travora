import "server-only";
import { db } from "./db";
import { audit } from "./audit";
import { AppError, notFound } from "./errors";
import { assertSuperAdmin, type Actor } from "./auth/session";

/**
 * Manual subscription renewal (MVP). Payment collection for subscriptions is
 * outside the MVP; this records an offline payment by extending the period.
 */
export async function renewSubscription(actor: Actor | null, agencyId: string, months: number) {
  assertSuperAdmin(actor);
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new AppError("VALIDATION_ERROR", "Extend by 1–24 months.");
  const sub = await db.subscription.findUnique({ where: { agencyId }, include: { agency: { select: { name: true, status: true } } } });
  if (!sub) throw notFound("Subscription");
  const from = sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
  const end = new Date(from);
  end.setUTCMonth(end.getUTCMonth() + months);
  await db.$transaction(async (tx) => {
    await tx.subscription.update({ where: { agencyId }, data: { status: "ACTIVE", currentPeriodEnd: end, trialEndsAt: null, ...(sub.currentPeriodEnd < new Date() ? { currentPeriodStart: new Date() } : {}) } });
    if (sub.agency.status === "TRIAL") await tx.agency.update({ where: { id: agencyId }, data: { status: "ACTIVE" } });
    await audit(actor, { action: "subscription.renewed", entity: "Agency", entityId: agencyId, agencyId, summary: `${sub.agency.name}: extended ${months} month(s) to ${end.toISOString().slice(0, 10)}`, before: { currentPeriodEnd: sub.currentPeriodEnd.toISOString() }, after: { currentPeriodEnd: end.toISOString() } }, tx);
  });
}

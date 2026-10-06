import "server-only";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "./db";
import type { Actor } from "./auth/session";

export type AuditEntry = {
  action: string; // e.g. "trip.created", "itinerary.item_updated"
  entity: string; // "Trip", "Guest", ...
  entityId: string;
  agencyId?: string | null;
  summary?: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

/** Append-only audit trail. Pass `tx` to commit atomically with the change. */
export async function audit(actor: Actor | null, entry: AuditEntry, tx: Tx | typeof db = db) {
  const agencyId = entry.agencyId !== undefined ? entry.agencyId : actor?.kind === "AGENT" ? actor.agencyId : null;
  await tx.auditLog.create({
    data: {
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      agencyId,
      userId: actor?.userId ?? null,
      userName: actor?.name ?? null,
      summary: entry.summary,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
    },
  });
}

/** Shallow diff of two flat records — keeps audit rows small and readable. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const prev = before[key];
    const next = after[key];
    const same = prev instanceof Date && next instanceof Date ? prev.getTime() === next.getTime() : JSON.stringify(prev) === JSON.stringify(next);
    if (!same && next !== undefined) {
      b[key] = prev instanceof Date ? prev.toISOString() : (prev ?? null);
      a[key] = next instanceof Date ? next.toISOString() : (next ?? null);
    }
  }
  return { before: b as Prisma.InputJsonValue, after: a as Prisma.InputJsonValue, changed: Object.keys(a).length > 0 };
}

import "server-only";
import { db } from "./db";
import type { Actor } from "./auth/session";

type Note = { type: string; title: string; body?: string; href?: string; dedupeKey?: string };

/** Notify every active user of an agency. Duplicate dedupeKeys are ignored. */
export async function notifyAgency(agencyId: string, note: Note, opts: { exceptUserId?: string } = {}) {
  const users = await db.user.findMany({ where: { agencyId, disabledAt: null, id: opts.exceptUserId ? { not: opts.exceptUserId } : undefined }, select: { id: true } });
  if (!users.length) return;
  await db.notification.createMany({
    data: users.map((u) => ({ userId: u.id, agencyId, ...note })),
    skipDuplicates: true,
  });
}

export async function notifyAdmins(note: Note) {
  const admins = await db.user.findMany({ where: { role: "SUPER_ADMIN", disabledAt: null }, select: { id: true } });
  if (!admins.length) return;
  await db.notification.createMany({ data: admins.map((u) => ({ userId: u.id, ...note })), skipDuplicates: true });
}

export async function listNotifications(actor: Actor, limit = 30) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, take: limit }),
    db.notification.count({ where: { userId: actor.userId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markNotificationsRead(actor: Actor, ids?: string[]) {
  await db.notification.updateMany({
    where: { userId: actor.userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}

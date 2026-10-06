import "server-only";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../audit";
import { AppError } from "../errors";
import { enforceRateLimit } from "../rate-limit";
import { hashPassword, randomToken, sha256, verifyPassword } from "./crypto";
import { actorFromUser, createSession, destroyAllSessions, type Actor } from "./session";

export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(200, "Password is too long.");

export async function login(input: { email: string; password: string }, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const email = input.email.trim().toLowerCase();
  // Two limits: per account (guessing one password) and per IP (spraying).
  await enforceRateLimit(`login:acct:${sha256(email)}`, 10, 15 * 60);
  if (meta.ip) await enforceRateLimit(`login:ip:${meta.ip}`, 60, 15 * 60);

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      disabledAt: true,
      passwordHash: true,
      mustChangePassword: true,
      agency: { select: { id: true, name: true, status: true } },
    },
  });
  const ok = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !ok) {
    if (user) await audit(null, { action: "auth.login_failed", entity: "User", entityId: user.id, agencyId: user.agency?.id ?? null });
    throw new AppError("INVALID_CREDENTIALS", "That email and password don't match an active account.");
  }
  if (user.agency?.status === "SUSPENDED") {
    throw new AppError("AGENCY_SUSPENDED", "This agency's workspace is suspended. Contact TRAVORA support to restore access.");
  }
  const actor = actorFromUser(user);
  if (!actor) throw new AppError("FORBIDDEN", "This account is disabled. Contact your administrator.");

  const session = await createSession(user.id, meta);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(actor, { action: "auth.login", entity: "User", entityId: user.id });
  return { actor, mustChangePassword: user.mustChangePassword, ...session };
}

export async function changePassword(actor: Actor, input: { current: string; next: string }) {
  await enforceRateLimit(`pw:${actor.userId}`, 10, 15 * 60);
  const parsed = passwordSchema.safeParse(input.next);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.issues[0].message, { fieldErrors: { next: parsed.error.issues[0].message } });
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (!(await verifyPassword(input.current, user.passwordHash))) {
    throw new AppError("VALIDATION_ERROR", "Your current password is incorrect.", { fieldErrors: { current: "Incorrect password." } });
  }
  if (input.current === input.next) {
    throw new AppError("VALIDATION_ERROR", "Choose a password you haven't used here.", { fieldErrors: { next: "Must differ from the current password." } });
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data), mustChangePassword: false } });
  await audit(actor, { action: "auth.password_changed", entity: "User", entityId: user.id });
}

/** Readable but strong temporary password, e.g. "Trv-k3P9-xQ2m-Lw7a". */
export function generateTempPassword() {
  const raw = randomToken(12).replace(/[-_]/g, "x");
  return `Trv-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export async function setTemporaryPassword(userId: string, password: string) {
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } });
  await destroyAllSessions(userId);
}

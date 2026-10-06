import "server-only";
import { db } from "../db";
import { AppError, forbidden } from "../errors";
import { randomToken, tokenId } from "./crypto";

export const SESSION_COOKIE = "tv_session";
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The authenticated principal. Services receive one of these and derive their
 * tenant scope from it — never from request input.
 */
export type SuperAdminActor = { kind: "SUPER_ADMIN"; userId: string; name: string; email: string; mustChangePassword?: boolean };
export type AgentActor = {
  kind: "AGENT";
  userId: string;
  name: string;
  email: string;
  agencyId: string;
  agencyName: string;
  mustChangePassword?: boolean;
};
export type Actor = SuperAdminActor | AgentActor;

export async function createSession(userId: string, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: tokenId(token), userId, expiresAt, userAgent: meta.userAgent?.slice(0, 300), ip: meta.ip ?? undefined },
  });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { id: tokenId(token) } });
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

type UserForActor = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "AGENT";
  disabledAt: Date | null;
  mustChangePassword?: boolean;
  agency: { id: string; name: string; status: string } | null;
};

/** Map a user row to an Actor; null when the account (or its agency) can't sign in. */
export function actorFromUser(user: UserForActor): Actor | null {
  if (user.disabledAt) return null;
  const base = { userId: user.id, name: user.name, email: user.email, mustChangePassword: user.mustChangePassword ?? false };
  if (user.role === "SUPER_ADMIN") return { kind: "SUPER_ADMIN", ...base };
  if (user.role === "AGENT" && user.agency && user.agency.status !== "SUSPENDED") {
    return { kind: "AGENT", ...base, agencyId: user.agency.id, agencyName: user.agency.name };
  }
  return null;
}

/** Resolve a raw session token to an Actor, or null if invalid/expired/disabled. */
export async function actorFromToken(token: string | undefined | null): Promise<Actor | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { id: tokenId(token) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          disabledAt: true,
          mustChangePassword: true,
          agency: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  const actor = actorFromUser(session.user);
  if (!actor) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return actor;
}

export function homeFor(actor: Actor) {
  return actor.kind === "SUPER_ADMIN" ? "/admin" : "/app";
}

// ---- Guards used by every service -----------------------------------------

export function assertSuperAdmin(actor: Actor | null): asserts actor is SuperAdminActor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  if (actor.kind !== "SUPER_ADMIN") throw forbidden();
}

export function assertAgent(actor: Actor | null): asserts actor is AgentActor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  if (actor.kind !== "AGENT") throw forbidden();
}

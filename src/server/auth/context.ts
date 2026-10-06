import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { actorFromToken, homeFor, SESSION_COOKIE, type Actor, type AgentActor, type SuperAdminActor } from "./session";

/** The signed-in actor for this request (memoised per request). */
export const getActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  return actorFromToken(jar.get(SESSION_COOKIE)?.value);
});

// Page/layout guards redirect instead of throwing, so people land somewhere useful.

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

export async function requireAdminPage(): Promise<SuperAdminActor> {
  const actor = await requireActor();
  if (actor.kind !== "SUPER_ADMIN") redirect(homeFor(actor));
  return actor;
}

export async function requireAgentPage(): Promise<AgentActor> {
  const actor = await requireActor();
  if (actor.kind !== "AGENT") redirect(homeFor(actor));
  return actor;
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

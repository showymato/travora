import { notFound } from "next/navigation";
import { requireAgentPage } from "@/server/auth/context";
import { db } from "@/server/db";

/**
 * Tenant gate for every /app/trips/[id] route. Runs before any loading
 * boundary so another agency's trip id is a real 404, not an empty page.
 */
export default async function TripLayout({ children, params }: LayoutProps<"/app/trips/[id]">) {
  const actor = await requireAgentPage();
  const { id } = await params;
  const exists = await db.trip.findFirst({ where: { id, agencyId: actor.agencyId }, select: { id: true } });
  if (!exists) notFound();
  return children;
}

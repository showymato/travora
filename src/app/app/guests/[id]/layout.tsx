import { notFound } from "next/navigation";
import { requireAgentPage } from "@/server/auth/context";
import { db } from "@/server/db";

/** Tenant gate: another agency's guest id is a 404. */
export default async function GuestLayout({ children, params }: LayoutProps<"/app/guests/[id]">) {
  const actor = await requireAgentPage();
  const { id } = await params;
  const exists = await db.guest.findFirst({ where: { id, agencyId: actor.agencyId }, select: { id: true } });
  if (!exists) notFound();
  return children;
}

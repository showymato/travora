import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/server/auth/crypto";
import type { AgentActor, SuperAdminActor } from "@/server/auth/session";
import { PLANS } from "@/lib/plans";
import { addDays, todayISO } from "@/lib/dates";

export const db = new PrismaClient();
export const PASSWORD = "Test-password-123";

export async function wipe() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export type World = Awaited<ReturnType<typeof buildWorld>>;

/** Two agencies (A and B), one platform admin, one hotel per agency plus one shared, guests in each. */
export async function buildWorld() {
  await wipe();
  for (const [i, p] of PLANS.entries()) await db.subscriptionPlan.create({ data: { ...p, features: [...p.features], sortOrder: i } });
  const passwordHash = await hashPassword(PASSWORD);
  const adminUser = await db.user.create({ data: { email: "admin@test.local", name: "Ada Admin", role: "SUPER_ADMIN", passwordHash } });
  const admin: SuperAdminActor = { kind: "SUPER_ADMIN", userId: adminUser.id, name: adminUser.name, email: adminUser.email };

  async function agency(name: string, email: string) {
    const plan = await db.subscriptionPlan.findUniqueOrThrow({ where: { code: "GROWTH" } });
    const a = await db.agency.create({ data: { name, slug: name.toLowerCase().replace(/\W+/g, "-"), ownerName: `${name} Owner`, email, phone: "+91 90000 00000", status: "ACTIVE" } });
    const u = await db.user.create({ data: { email, name: `${name} Agent`, role: "AGENT", agencyId: a.id, passwordHash } });
    await db.subscription.create({ data: { agencyId: a.id, planId: plan.id, status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) } });
    const actor: AgentActor = { kind: "AGENT", userId: u.id, name: u.name, email: u.email, agencyId: a.id, agencyName: a.name };
    return { agency: a, user: u, actor };
  }
  const A = await agency("Agency A", "a@test.local");
  const B = await agency("Agency B", "b@test.local");

  const dest = await db.destination.create({ data: { name: "Srinagar" } });
  async function hotel(name: string) {
    const h = await db.hotel.create({ data: { name, slug: name.toLowerCase().replace(/\W+/g, "-"), category: "FOUR_STAR", destinationId: dest.id, location: "Srinagar", checkInTime: "14:00", checkOutTime: "11:00" } });
    const room = await db.hotelRoom.create({ data: { hotelId: h.id, name: "Deluxe", capacity: 3, inventory: 10, baseRate: 8000, mealPlans: ["EP", "CP", "MAP"] } });
    return { hotel: h, room };
  }
  const hotelA = await hotel("Hotel A Only");
  const hotelB = await hotel("Hotel B Only");
  const shared = await hotel("Shared Hotel");
  await db.agentHotel.createMany({
    data: [
      { agencyId: A.agency.id, hotelId: hotelA.hotel.id },
      { agencyId: A.agency.id, hotelId: shared.hotel.id },
      { agencyId: B.agency.id, hotelId: hotelB.hotel.id },
      { agencyId: B.agency.id, hotelId: shared.hotel.id },
    ],
  });
  // Negotiated rates on the shared hotel: each agency must only ever see its own.
  await db.hotelRate.create({ data: { roomId: shared.room.id, agencyId: A.agency.id, rate: 7200 } });
  await db.hotelRate.create({ data: { roomId: shared.room.id, agencyId: B.agency.id, rate: 7500 } });

  const guestA = await db.guest.create({ data: { agencyId: A.agency.id, fullName: "Guest of A", phone: "+91 91111 11111", email: "guest.a@example.com" } });
  const guestB = await db.guest.create({ data: { agencyId: B.agency.id, fullName: "Guest of B", phone: "+91 92222 22222", email: "guest.b@example.com" } });

  const start = addDays(todayISO(), 10);
  return { admin, A, B, hotelA, hotelB, shared, guestA, guestB, start };
}

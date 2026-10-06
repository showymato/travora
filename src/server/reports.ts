import "server-only";
import type { Prisma, TripStatus } from "@prisma/client";
import { db } from "./db";
import { notFound } from "./errors";
import { assertAgent, assertSuperAdmin, type Actor } from "./auth/session";
import { addDays, toDate, todayISO } from "@/lib/dates";
import { TRIP_STATUSES } from "@/lib/labels";
import { computeTrip, tripFullInclude } from "./trips/queries";

const LIVE: Prisma.TripWhereInput = { status: { notIn: ["DRAFT", "CANCELLED"] } };

function monthKeys(n: number, today = todayISO()) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

async function monthlyTrips(where: Prisma.TripWhereInput, months = 6) {
  const keys = monthKeys(months);
  const from = toDate(`${keys[0]}-01`);
  const rows = await db.trip.findMany({ where: { ...where, ...LIVE, startDate: { gte: from } }, select: { startDate: true, totalAmount: true } });
  return keys.map((k) => {
    const inMonth = rows.filter((r) => r.startDate?.toISOString().startsWith(k));
    return { month: k, trips: inMonth.length, value: inMonth.reduce((s, r) => s + r.totalAmount, 0) };
  });
}

export async function agentReports(actor: Actor | null) {
  assertAgent(actor);
  const agencyId = actor.agencyId;
  const t = toDate(todayISO());
  const [byStatus, value, guests, destinations, monthly, hotels, repeatGuests] = await Promise.all([
    db.trip.groupBy({ by: ["status"], where: { agencyId }, _count: true }),
    db.trip.aggregate({ where: { agencyId, ...LIVE }, _sum: { totalAmount: true }, _avg: { totalAmount: true }, _count: true }),
    db.guest.count({ where: { agencyId } }),
    db.tripDestination.groupBy({ by: ["name"], where: { agencyId, trip: LIVE }, _count: true, orderBy: { _count: { name: "desc" } }, take: 8 }),
    monthlyTrips({ agencyId }),
    db.tripHotel.groupBy({ by: ["hotelId"], where: { agencyId, trip: LIVE }, _count: true, orderBy: { _count: { hotelId: "desc" } }, take: 5 }),
    db.tripGuest.groupBy({ by: ["guestId"], where: { agencyId, isPrimary: true }, _count: true, having: { guestId: { _count: { gt: 1 } } } }),
  ]);
  const count = (s: TripStatus) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const upcoming = await db.trip.count({ where: { agencyId, ...LIVE, startDate: { gt: t }, status: { notIn: ["DRAFT", "CANCELLED", "COMPLETED"] } } });
  const hotelNames = await db.hotel.findMany({ where: { id: { in: hotels.map((h) => h.hotelId) } }, select: { id: true, name: true } });
  return {
    trips: byStatus.reduce((s, b) => s + b._count, 0),
    liveTrips: value._count,
    guests,
    tripValue: value._sum.totalAmount ?? 0,
    averageTrip: Math.round(value._avg.totalAmount ?? 0),
    completed: count("COMPLETED"),
    upcoming,
    cancelled: count("CANCELLED"),
    repeatGuests: repeatGuests.length,
    byStatus: TRIP_STATUSES.map((s) => ({ status: s, count: count(s) })),
    destinations: destinations.map((d) => ({ name: d.name, trips: d._count })),
    hotels: hotels.map((h) => ({ name: hotelNames.find((x) => x.id === h.hotelId)?.name ?? "Hotel", stays: h._count })),
    monthly,
  };
}

export async function adminReports(actor: Actor | null) {
  assertSuperAdmin(actor);
  const [agencies, active, trips, guests, value, subs, topAgencies, destinations, hotels, monthly] = await Promise.all([
    db.agency.count(),
    db.agency.count({ where: { status: "ACTIVE" } }),
    db.trip.count({ where: LIVE }),
    db.guest.count(),
    db.trip.aggregate({ where: LIVE, _sum: { totalAmount: true } }),
    db.subscription.findMany({ where: { status: { in: ["ACTIVE", "PAST_DUE"] } }, include: { plan: { select: { priceMonthly: true, name: true, code: true } } } }),
    db.trip.groupBy({ by: ["agencyId"], where: LIVE, _count: true, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 6 }),
    db.tripDestination.groupBy({ by: ["name"], where: { trip: LIVE }, _count: true, orderBy: { _count: { name: "desc" } }, take: 8 }),
    db.tripHotel.groupBy({ by: ["hotelId"], where: { trip: LIVE }, _count: true, orderBy: { _count: { hotelId: "desc" } }, take: 6 }),
    monthlyTrips({}),
  ]);
  const [agencyNames, hotelNames] = await Promise.all([
    db.agency.findMany({ where: { id: { in: topAgencies.map((a) => a.agencyId) } }, select: { id: true, name: true } }),
    db.hotel.findMany({ where: { id: { in: hotels.map((h) => h.hotelId) } }, select: { id: true, name: true } }),
  ]);
  const mrr = subs.filter((s) => s.status === "ACTIVE").reduce((sum, s) => sum + s.plan.priceMonthly, 0);
  const planMix = Object.values(
    subs.reduce<Record<string, { plan: string; count: number }>>((acc, s) => {
      acc[s.plan.code] ??= { plan: s.plan.name, count: 0 };
      acc[s.plan.code].count++;
      return acc;
    }, {}),
  );
  return {
    agencies,
    active,
    trips,
    guests,
    tripVolume: value._sum.totalAmount ?? 0,
    mrr,
    planMix,
    topAgencies: topAgencies.map((a) => ({ id: a.agencyId, name: agencyNames.find((x) => x.id === a.agencyId)?.name ?? "Agency", trips: a._count, value: a._sum.totalAmount ?? 0 })),
    destinations: destinations.map((d) => ({ name: d.name, trips: d._count })),
    hotels: hotels.map((h) => ({ id: h.hotelId, name: hotelNames.find((x) => x.id === h.hotelId)?.name ?? "Hotel", stays: h._count })),
    monthly,
  };
}

// ---- Admin cross-agency trip views (read-only) -------------------------------

export async function listAllTrips(actor: Actor | null, query: { q?: string; status?: string; agencyId?: string; page?: number }) {
  assertSuperAdmin(actor);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = 20;
  const q = query.q?.trim();
  const where: Prisma.TripWhereInput = {
    ...((TRIP_STATUSES as readonly string[]).includes(query.status ?? "") ? { status: query.status as TripStatus } : {}),
    ...(query.agencyId ? { agencyId: query.agencyId } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { primaryGuest: { fullName: { contains: q, mode: "insensitive" } } }, { destinations: { some: { name: { contains: q, mode: "insensitive" } } } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.trip.count({ where }),
    db.trip.findMany({
      where,
      orderBy: [{ startDate: { sort: "desc", nulls: "last" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, code: true, title: true, status: true, startDate: true, endDate: true, totalAmount: true, agency: { select: { id: true, name: true } }, primaryGuest: { select: { fullName: true } }, destinations: { orderBy: { position: "asc" }, select: { name: true } } },
    }),
  ]);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getTripAdmin(actor: Actor | null, tripId: string) {
  assertSuperAdmin(actor);
  const trip = await db.trip.findUnique({ where: { id: tripId }, include: tripFullInclude });
  if (!trip) throw notFound("Trip");
  return { trip, ...computeTrip(trip) };
}

export async function auditFeed(actor: Actor | null, query: { agencyId?: string; entity?: string; page?: number }) {
  assertSuperAdmin(actor);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = 40;
  const where: Prisma.AuditLogWhereInput = { ...(query.agencyId ? { agencyId: query.agencyId } : {}), ...(query.entity ? { entity: query.entity } : {}) };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { agency: { select: { name: true } } } }),
  ]);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function subscriptionsOverview(actor: Actor | null) {
  assertSuperAdmin(actor);
  const [plans, subs] = await Promise.all([
    db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { subscriptions: true } } } }),
    db.subscription.findMany({ orderBy: { currentPeriodEnd: "asc" }, include: { plan: true, agency: { select: { id: true, name: true, status: true, _count: { select: { users: true } } } } } }),
  ]);
  const soon = toDate(addDays(todayISO(), 14));
  return { plans, subs, renewingSoon: subs.filter((s) => s.currentPeriodEnd <= soon).length };
}

import "server-only";
import type { Prisma, TripStatus } from "@prisma/client";
import { db } from "../db";
import { notFound } from "../errors";
import type { Actor } from "../auth/session";
import { paymentSummary } from "@/lib/money";
import { priceLines, tripTotals } from "@/lib/pricing";
import { toDate, todayISO } from "@/lib/dates";
import { TRIP_STATUSES } from "@/lib/labels";
import { guard } from "./core";

export const tripFullInclude = {
  agency: { select: { id: true, name: true, email: true, phone: true, supportEmail: true, supportPhone: true, address: true, gstNumber: true, timezone: true } },
  primaryGuest: true,
  guests: { include: { guest: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
  destinations: { orderBy: { position: "asc" } },
  hotels: {
    orderBy: [{ checkIn: "asc" }, { position: "asc" }],
    include: {
      hotel: { select: { id: true, name: true, category: true, location: true, address: true, phone: true, images: true, checkInTime: true, checkOutTime: true, cancellationPolicy: true } },
      rooms: { orderBy: { createdAt: "asc" } },
    },
  },
  transports: { orderBy: [{ date: "asc" }, { time: "asc" }] },
  activities: { orderBy: [{ date: "asc" }, { time: "asc" }] },
  days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
  documents: { orderBy: { createdAt: "desc" } },
  payments: { orderBy: { paidAt: "desc" } },
  notesList: { orderBy: { createdAt: "desc" }, take: 50 },
  versions: { orderBy: { version: "desc" }, select: { id: true, version: true, summary: true, createdAt: true, createdById: true } },
} satisfies Prisma.TripInclude;

export type TripFull = Prisma.TripGetPayload<{ include: typeof tripFullInclude }>;

export function computeTrip(trip: TripFull) {
  const lines = priceLines({
    rooms: trip.hotels.flatMap((h) => h.rooms.map((r) => ({ ...r, hotelName: h.hotel.name }))),
    transports: trip.transports,
    activities: trip.activities,
  });
  const totals = tripTotals(lines, trip.priceOverride);
  const pay = paymentSummary(totals.total, trip.payments);
  return { lines, ...totals, payment: pay };
}

export async function getTrip(actor: Actor | null, tripId: string) {
  guard(actor);
  const trip = await db.trip.findFirst({ where: { id: tripId, agencyId: actor.agencyId }, include: tripFullInclude });
  if (!trip) throw notFound("Trip");
  return { trip, ...computeTrip(trip) };
}

export async function tripActivityLog(actor: Actor | null, tripId: string, take = 60) {
  guard(actor);
  return db.auditLog.findMany({ where: { agencyId: actor.agencyId, entity: "Trip", entityId: tripId }, orderBy: { createdAt: "desc" }, take });
}

export type TripListQuery = { q?: string; status?: string; when?: "upcoming" | "ongoing" | "past" | "drafts" | ""; page?: number; sort?: "start" | "created" };
const PAGE_SIZE = 15;

export async function listTrips(actor: Actor | null, query: TripListQuery = {}) {
  guard(actor);
  const page = Math.max(1, query.page ?? 1);
  const q = query.q?.trim();
  const today = toDate(todayISO());
  const status = (TRIP_STATUSES as readonly string[]).includes(query.status ?? "") ? (query.status as TripStatus) : undefined;
  const where: Prisma.TripWhereInput = {
    agencyId: actor.agencyId,
    ...(status ? { status } : {}),
    ...(query.when === "upcoming" ? { startDate: { gte: today }, status: { notIn: ["CANCELLED", "DRAFT"] } } : {}),
    ...(query.when === "ongoing" ? { startDate: { lte: today }, endDate: { gte: today }, status: { notIn: ["CANCELLED", "DRAFT"] } } : {}),
    ...(query.when === "past" ? { endDate: { lt: today } } : {}),
    ...(query.when === "drafts" ? { status: "DRAFT" } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { primaryGuest: { fullName: { contains: q, mode: "insensitive" } } },
            { primaryGuest: { phone: { contains: q } } },
            { destinations: { some: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.TripOrderByWithRelationInput[] =
    query.sort === "created" ? [{ createdAt: "desc" }] : query.when === "past" ? [{ startDate: "desc" }] : [{ startDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
  const [total, rows] = await Promise.all([
    db.trip.count({ where }),
    db.trip.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        adults: true,
        children: true,
        infants: true,
        wizardStep: true,
        hasUnpublishedChanges: true,
        updatedAt: true,
        primaryGuest: { select: { id: true, fullName: true, phone: true } },
        destinations: { orderBy: { position: "asc" }, select: { name: true } },
        _count: { select: { hotels: true } },
      },
    }),
  ]);
  return { rows, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function tripCounts(actor: Actor | null) {
  guard(actor);
  const groups = await db.trip.groupBy({ by: ["status"], where: { agencyId: actor.agencyId }, _count: true });
  return Object.fromEntries(groups.map((g) => [g.status, g._count])) as Partial<Record<TripStatus, number>>;
}

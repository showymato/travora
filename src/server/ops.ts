import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { assertAgent, assertSuperAdmin, type Actor } from "./auth/session";
import { addDays, diffDays, toDate, toISO, todayISO } from "@/lib/dates";
import { paymentSummary } from "@/lib/money";
import { priceLines, tripTotals } from "@/lib/pricing";
import { tripTitle } from "./trips/core";

// ---------------------------------------------------------------------------
// Pending action engine — "what do I need to do next?"
// Derived from live data on every request (no stale task rows to maintain).
// ---------------------------------------------------------------------------

export type PendingKind =
  | "TRIP_TOMORROW"
  | "HOTEL_CONFIRMATION"
  | "TRANSPORT_DETAILS"
  | "PAYMENT_PENDING"
  | "ITINERARY_NOT_SENT"
  | "GUEST_INFO_MISSING"
  | "GUEST_DOCUMENT_MISSING"
  | "UNPUBLISHED_CHANGES"
  | "DRAFT_STALE";

export type PendingAction = {
  id: string;
  kind: PendingKind;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  tripId: string;
  tripCode: string;
  guest: string | null;
  href: string;
  dueInDays: number | null;
};

const ACTIVE: Prisma.TripWhereInput["status"] = { notIn: ["CANCELLED", "COMPLETED"] };

export async function pendingActions(agencyId: string, today = todayISO()): Promise<PendingAction[]> {
  const horizon = toDate(addDays(today, 45));
  const trips = await db.trip.findMany({
    where: {
      agencyId,
      status: ACTIVE,
      OR: [{ startDate: { lte: horizon } }, { startDate: null }],
      AND: [{ OR: [{ endDate: { gte: toDate(today) } }, { endDate: null }] }],
    },
    orderBy: [{ startDate: { sort: "asc", nulls: "last" } }],
    take: 300,
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      priceOverride: true,
      hasUnpublishedChanges: true,
      updatedAt: true,
      destinations: { select: { name: true }, orderBy: { position: "asc" } },
      primaryGuest: { select: { id: true, fullName: true, phone: true, email: true, idType: true, _count: { select: { documents: true } } } },
      hotels: { select: { id: true, confirmationStatus: true, checkIn: true, hotel: { select: { name: true } }, rooms: { select: { roomName: true, nightlyRate: true, quantity: true, checkIn: true, checkOut: true } } } },
      transports: { select: { id: true, date: true, pickup: true, dropoff: true, driverName: true, driverPhone: true, vehicleNumber: true, price: true } },
      activities: { select: { title: true, price: true } },
      payments: { select: { amount: true, voidedAt: true } },
    },
  });

  const out: PendingAction[] = [];
  for (const t of trips) {
    const start = toISO(t.startDate);
    const due = start ? diffDays(today, start) : null;
    const guest = t.primaryGuest?.fullName ?? null;
    const base = { tripId: t.id, tripCode: t.code, guest, dueInDays: due };
    const href = `/app/trips/${t.id}`;
    const confirmedish = ["SENT", "CONFIRMED", "ONGOING"].includes(t.status);

    if (t.status === "DRAFT") {
      const idle = diffDays(toISO(t.updatedAt)!, today);
      if (idle >= 2) out.push({ ...base, id: `draft:${t.id}`, kind: "DRAFT_STALE", severity: "low", title: "Finish trip draft", detail: `${tripTitle(t)} — untouched for ${idle} days`, href: `/app/trips/${t.id}/plan` });
      continue;
    }
    if (due === 1) out.push({ ...base, id: `tomorrow:${t.id}`, kind: "TRIP_TOMORROW", severity: "high", title: "Trip starts tomorrow", detail: `${guest ?? t.code} · ${tripTitle(t)}`, href });

    for (const h of t.hotels) {
      if (h.confirmationStatus === "CONFIRMED") continue;
      const d = diffDays(today, toISO(h.checkIn)!);
      if (d <= 21) {
        out.push({ ...base, id: `hotel:${h.id}`, kind: "HOTEL_CONFIRMATION", severity: d <= 7 ? "high" : "medium", title: "Hotel confirmation needed", detail: `${h.hotel.name} · check-in in ${d <= 0 ? "progress" : `${d} day${d === 1 ? "" : "s"}`}`, href: `${href}?tab=hotels`, dueInDays: d });
      }
    }
    for (const tr of t.transports) {
      const d = diffDays(today, toISO(tr.date)!);
      if (d >= 0 && d <= 3 && (!tr.driverName || !tr.driverPhone || !tr.vehicleNumber)) {
        out.push({ ...base, id: `transport:${tr.id}`, kind: "TRANSPORT_DETAILS", severity: d <= 1 ? "high" : "medium", title: "Transport details missing", detail: `${tr.pickup} → ${tr.dropoff} · driver or vehicle not set`, href: `${href}?tab=transport`, dueInDays: d });
      }
    }
    if (["PLANNING", "READY"].includes(t.status) && due !== null && due <= 14) {
      out.push({ ...base, id: `notsent:${t.id}`, kind: "ITINERARY_NOT_SENT", severity: due <= 5 ? "high" : "medium", title: "Itinerary not sent", detail: `${guest ?? t.code} travels in ${due} day${due === 1 ? "" : "s"}`, href: `/app/trips/${t.id}/plan?step=9` });
    }
    if (t.hasUnpublishedChanges && confirmedish) {
      out.push({ ...base, id: `unpublished:${t.id}`, kind: "UNPUBLISHED_CHANGES", severity: "medium", title: "Changes not shared with guest", detail: `${t.code} has edits the guest can't see yet`, href });
    }
    if (confirmedish) {
      const lines = priceLines({ rooms: t.hotels.flatMap((h) => h.rooms.map((r) => ({ ...r, hotelName: h.hotel.name }))), transports: t.transports, activities: t.activities });
      const { total } = tripTotals(lines, t.priceOverride);
      const p = paymentSummary(total, t.payments);
      if (p.pending > 0 && due !== null && due <= 30) {
        out.push({ ...base, id: `payment:${t.id}`, kind: "PAYMENT_PENDING", severity: due <= 7 ? "high" : "medium", title: "Payment pending", detail: `₹${p.pending.toLocaleString("en-IN")} due from ${guest ?? "guest"}`, href: `${href}?tab=payments` });
      }
    }
    const g = t.primaryGuest;
    if (g && (!g.phone || !g.email) && due !== null && due <= 30) {
      out.push({ ...base, id: `guestinfo:${t.id}`, kind: "GUEST_INFO_MISSING", severity: "medium", title: "Missing guest information", detail: `${g.fullName} has no ${!g.phone ? "phone" : "email"}`, href: `/app/guests/${g.id}` });
    }
    if (g && g._count.documents === 0 && confirmedish && due !== null && due <= 21) {
      out.push({ ...base, id: `guestdoc:${t.id}`, kind: "GUEST_DOCUMENT_MISSING", severity: "low", title: "Guest document missing", detail: `No ID on file for ${g.fullName}`, href: `/app/guests/${g.id}?tab=documents` });
    }
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.dueInDays ?? 99) - (b.dueInDays ?? 99));
}

// ---------------------------------------------------------------------------
// Today — the agent's morning view of everything happening on the ground.
// ---------------------------------------------------------------------------

export type TodayEntry = {
  id: string;
  time: string | null;
  kind: "ARRIVAL" | "DEPARTURE" | "CHECK_IN" | "CHECK_OUT" | "TRANSPORT" | "ACTIVITY" | "ITEM";
  type: string;
  title: string;
  detail: string | null;
  guest: string | null;
  tripId: string;
  tripCode: string;
  agency?: string;
};

export async function todayOps(scope: { agencyId?: string }, date = todayISO()): Promise<TodayEntry[]> {
  const d = toDate(date);
  const tripScope: Prisma.TripWhereInput = { ...(scope.agencyId ? { agencyId: scope.agencyId } : {}), status: { in: ["READY", "SENT", "CONFIRMED", "ONGOING", "PLANNING"] } };
  const days = await db.itineraryDay.findMany({
    where: { date: d, trip: tripScope },
    include: {
      items: { orderBy: { position: "asc" } },
      trip: { select: { id: true, code: true, primaryGuest: { select: { fullName: true } }, agency: { select: { name: true } } } },
    },
    take: 200,
  });
  const out: TodayEntry[] = [];
  const kindOf = (type: string): TodayEntry["kind"] =>
    type === "AIRPORT_ARRIVAL" ? "ARRIVAL" : type === "AIRPORT_DEPARTURE" ? "DEPARTURE" : type === "HOTEL_CHECK_IN" ? "CHECK_IN" : type === "HOTEL_CHECK_OUT" ? "CHECK_OUT" : type === "TRANSPORT" ? "TRANSPORT" : ["SIGHTSEEING", "ACTIVITY", "MEAL"].includes(type) ? "ACTIVITY" : "ITEM";
  for (const day of days) {
    for (const i of day.items) {
      if (i.type === "NOTE" || i.type === "FREE_TIME") continue;
      out.push({ id: i.id, time: i.time, kind: kindOf(i.type), type: i.type, title: i.title, detail: i.location, guest: day.trip.primaryGuest?.fullName ?? null, tripId: day.trip.id, tripCode: day.trip.code, agency: day.trip.agency.name });
    }
  }
  // Trips without a generated itinerary still surface their structured lines.
  const covered = new Set(days.map((x) => x.trip.id));
  const notCovered: Prisma.TripWhereInput = { ...tripScope, id: { notIn: [...covered] } };
  const tripSel = { select: { id: true, code: true, primaryGuest: { select: { fullName: true } }, agency: { select: { name: true } } } } as const;
  const [checkIns, transports, activities] = await Promise.all([
    db.tripHotel.findMany({ where: { checkIn: d, trip: notCovered }, include: { hotel: { select: { name: true, checkInTime: true, location: true } }, trip: tripSel } }),
    db.tripTransport.findMany({ where: { date: d, trip: notCovered }, include: { trip: tripSel } }),
    db.tripActivity.findMany({ where: { date: d, trip: notCovered }, include: { trip: tripSel } }),
  ]);
  for (const h of checkIns) out.push({ id: `ci:${h.id}`, time: h.hotel.checkInTime, kind: "CHECK_IN", type: "HOTEL_CHECK_IN", title: `Check-in · ${h.hotel.name}`, detail: h.hotel.location, guest: h.trip.primaryGuest?.fullName ?? null, tripId: h.trip.id, tripCode: h.trip.code, agency: h.trip.agency.name });
  for (const t of transports) out.push({ id: `tr:${t.id}`, time: t.time, kind: "TRANSPORT", type: "TRANSPORT", title: t.kind === "AIRPORT_TRANSFER" ? "Airport transfer" : `Transfer to ${t.dropoff}`, detail: `${t.pickup} → ${t.dropoff}`, guest: t.trip.primaryGuest?.fullName ?? null, tripId: t.trip.id, tripCode: t.trip.code, agency: t.trip.agency.name });
  for (const a of activities) out.push({ id: `ac:${a.id}`, time: a.time, kind: "ACTIVITY", type: a.kind, title: a.title, detail: a.location, guest: a.trip.primaryGuest?.fullName ?? null, tripId: a.trip.id, tripCode: a.trip.code, agency: a.trip.agency.name });
  const key = (e: TodayEntry) => e.time ?? (e.kind === "ARRIVAL" ? "00:00" : "99:99");
  return out.sort((a, b) => key(a).localeCompare(key(b)));
}

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

export async function agentDashboard(actor: Actor | null) {
  assertAgent(actor);
  const today = todayISO();
  const t = toDate(today);
  const agencyId = actor.agencyId;
  const [upcoming, active, guests, pending, ops, upcomingTrips, drafts] = await Promise.all([
    db.trip.count({ where: { agencyId, startDate: { gt: t }, status: { notIn: ["CANCELLED", "DRAFT", "COMPLETED"] } } }),
    db.trip.count({ where: { agencyId, startDate: { lte: t }, endDate: { gte: t }, status: { in: ["SENT", "CONFIRMED", "ONGOING"] } } }),
    db.guest.count({ where: { agencyId } }),
    pendingActions(agencyId, today),
    todayOps({ agencyId }, today),
    db.trip.findMany({
      where: { agencyId, endDate: { gte: t }, status: { notIn: ["CANCELLED", "DRAFT", "COMPLETED"] } },
      orderBy: { startDate: "asc" },
      take: 6,
      select: { id: true, code: true, title: true, status: true, startDate: true, endDate: true, adults: true, children: true, primaryGuest: { select: { fullName: true } }, destinations: { orderBy: { position: "asc" }, select: { name: true } } },
    }),
    db.trip.findMany({ where: { agencyId, status: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 3, select: { id: true, code: true, wizardStep: true, updatedAt: true, primaryGuest: { select: { fullName: true } } } }),
  ]);
  return { metrics: { upcoming, active, guests, pending: pending.length }, pending, ops, upcomingTrips, drafts, today };
}

export async function adminDashboard(actor: Actor | null) {
  assertSuperAdmin(actor);
  const today = todayISO();
  const t = toDate(today);
  const monthStart = toDate(`${today.slice(0, 7)}-01`);
  const [agencies, activeAgencies, upcoming, ongoing, guests, monthTrips, activity, upcomingTrips, ops, trialsEnding, suspended, inactive] = await Promise.all([
    db.agency.count(),
    db.agency.count({ where: { status: "ACTIVE" } }),
    db.trip.count({ where: { startDate: { gt: t }, status: { notIn: ["CANCELLED", "DRAFT", "COMPLETED"] } } }),
    db.trip.count({ where: { startDate: { lte: t }, endDate: { gte: t }, status: { in: ["SENT", "CONFIRMED", "ONGOING"] } } }),
    db.guest.count(),
    db.trip.count({ where: { createdAt: { gte: monthStart } } }),
    db.auditLog.findMany({ where: { agencyId: { not: null }, action: { notIn: ["auth.login", "auth.login_failed", "guest.document_viewed"] } }, orderBy: { createdAt: "desc" }, take: 12, include: { agency: { select: { name: true } } } }),
    db.trip.findMany({
      where: { startDate: { gte: t }, status: { notIn: ["CANCELLED", "DRAFT", "COMPLETED"] } },
      orderBy: { startDate: "asc" },
      take: 8,
      select: { id: true, code: true, title: true, status: true, startDate: true, endDate: true, agency: { select: { id: true, name: true } }, primaryGuest: { select: { fullName: true } }, destinations: { orderBy: { position: "asc" }, select: { name: true } } },
    }),
    todayOps({}, today),
    db.subscription.findMany({ where: { status: "TRIALING", trialEndsAt: { lte: toDate(addDays(today, 7)) } }, include: { agency: { select: { id: true, name: true } } } }),
    db.agency.findMany({ where: { status: "SUSPENDED" }, select: { id: true, name: true } }),
    db.agency.findMany({ where: { status: { not: "SUSPENDED" }, users: { every: { OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: new Date(Date.now() - 14 * 86_400_000) } }] } } }, select: { id: true, name: true }, take: 5 }),
  ]);
  const pending = [
    ...trialsEnding.map((s) => ({ id: `trial:${s.agencyId}`, title: "Trial ending", detail: `${s.agency.name} · ${s.trialEndsAt ? `ends ${toISO(s.trialEndsAt)}` : ""}`, href: `/admin/agents/${s.agency.id}`, severity: "medium" as const })),
    ...suspended.map((a) => ({ id: `susp:${a.id}`, title: "Suspended agency", detail: a.name, href: `/admin/agents/${a.id}`, severity: "low" as const })),
    ...inactive.map((a) => ({ id: `idle:${a.id}`, title: "No sign-in for 14 days", detail: a.name, href: `/admin/agents/${a.id}`, severity: "low" as const })),
  ];
  return { metrics: { agencies, activeAgencies, upcoming, ongoing, guests, monthTrips }, activity, upcomingTrips, ops, pending, today };
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export type CalEvent = {
  id: string;
  date: string;
  time: string | null;
  kind: "TRIP_START" | "TRIP_END" | "CHECK_IN" | "CHECK_OUT" | "TRANSPORT" | "ACTIVITY";
  title: string;
  subtitle: string | null;
  tripId: string;
  tripCode: string;
  status: string;
  href: string;
};

export async function calendarEvents(actor: Actor | null, from: string, to: string): Promise<CalEvent[]> {
  if (!actor) return [];
  const scope: Prisma.TripWhereInput = { ...(actor.kind === "AGENT" ? { agencyId: actor.agencyId } : {}), status: { notIn: ["CANCELLED"] } };
  const f = toDate(from);
  const t = toDate(to);
  const hrefFor = (id: string) => (actor.kind === "AGENT" ? `/app/trips/${id}` : `/admin/trips/${id}`);
  const tripSel = { select: { id: true, code: true, status: true, primaryGuest: { select: { fullName: true } } } } as const;
  const [trips, stays, transports, activities] = await Promise.all([
    db.trip.findMany({ where: { ...scope, OR: [{ startDate: { gte: f, lte: t } }, { endDate: { gte: f, lte: t } }] }, select: { id: true, code: true, status: true, title: true, startDate: true, endDate: true, primaryGuest: { select: { fullName: true } }, destinations: { select: { name: true }, orderBy: { position: "asc" } } } }),
    db.tripHotel.findMany({ where: { trip: scope, OR: [{ checkIn: { gte: f, lte: t } }, { checkOut: { gte: f, lte: t } }] }, include: { hotel: { select: { name: true, checkInTime: true, checkOutTime: true } }, trip: tripSel } }),
    db.tripTransport.findMany({ where: { trip: scope, date: { gte: f, lte: t } }, include: { trip: tripSel } }),
    db.tripActivity.findMany({ where: { trip: scope, date: { gte: f, lte: t } }, include: { trip: tripSel } }),
  ]);
  const ev: CalEvent[] = [];
  const inRange = (iso: string) => iso >= from && iso <= to;
  for (const tr of trips) {
    const guest = tr.primaryGuest?.fullName ?? null;
    if (tr.startDate && inRange(toISO(tr.startDate)!)) ev.push({ id: `s:${tr.id}`, date: toISO(tr.startDate)!, time: null, kind: "TRIP_START", title: `${guest ?? tr.code} arrives`, subtitle: tripTitle(tr), tripId: tr.id, tripCode: tr.code, status: tr.status, href: hrefFor(tr.id) });
    if (tr.endDate && inRange(toISO(tr.endDate)!)) ev.push({ id: `e:${tr.id}`, date: toISO(tr.endDate)!, time: null, kind: "TRIP_END", title: `${guest ?? tr.code} departs`, subtitle: tripTitle(tr), tripId: tr.id, tripCode: tr.code, status: tr.status, href: hrefFor(tr.id) });
  }
  for (const s of stays) {
    const guest = s.trip.primaryGuest?.fullName ?? s.trip.code;
    if (inRange(toISO(s.checkIn)!)) ev.push({ id: `ci:${s.id}`, date: toISO(s.checkIn)!, time: s.hotel.checkInTime, kind: "CHECK_IN", title: `Check-in · ${s.hotel.name}`, subtitle: guest, tripId: s.trip.id, tripCode: s.trip.code, status: s.trip.status, href: hrefFor(s.trip.id) });
    if (inRange(toISO(s.checkOut)!)) ev.push({ id: `co:${s.id}`, date: toISO(s.checkOut)!, time: s.hotel.checkOutTime, kind: "CHECK_OUT", title: `Check-out · ${s.hotel.name}`, subtitle: guest, tripId: s.trip.id, tripCode: s.trip.code, status: s.trip.status, href: hrefFor(s.trip.id) });
  }
  for (const x of transports) ev.push({ id: `t:${x.id}`, date: toISO(x.date)!, time: x.time, kind: "TRANSPORT", title: `${x.pickup} → ${x.dropoff}`, subtitle: x.trip.primaryGuest?.fullName ?? x.trip.code, tripId: x.trip.id, tripCode: x.trip.code, status: x.trip.status, href: hrefFor(x.trip.id) });
  for (const a of activities) ev.push({ id: `a:${a.id}`, date: toISO(a.date)!, time: a.time, kind: "ACTIVITY", title: a.title, subtitle: a.trip.primaryGuest?.fullName ?? a.trip.code, tripId: a.trip.id, tripCode: a.trip.code, status: a.trip.status, href: hrefFor(a.trip.id) });
  const order = { TRIP_START: 0, CHECK_OUT: 1, TRANSPORT: 2, CHECK_IN: 3, ACTIVITY: 4, TRIP_END: 5 };
  return ev.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "00:00").localeCompare(b.time ?? "00:00") || order[a.kind] - order[b.kind]);
}

// ---------------------------------------------------------------------------
// Global search (⌘K)
// ---------------------------------------------------------------------------

export type SearchHit = { id: string; group: "Trips" | "Guests" | "Hotels" | "Agencies"; title: string; subtitle: string; href: string };

export async function globalSearch(actor: Actor | null, raw: string): Promise<SearchHit[]> {
  if (!actor) return [];
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const ci = { contains: q, mode: "insensitive" as const };
  if (actor.kind === "AGENT") {
    const agencyId = actor.agencyId;
    const [trips, guests, hotels] = await Promise.all([
      db.trip.findMany({
        where: { agencyId, OR: [{ code: ci }, { title: ci }, { primaryGuest: { fullName: ci } }, { primaryGuest: { phone: { contains: q } } }, { destinations: { some: { name: ci } } }, { hotels: { some: { hotel: { name: ci } } } }] },
        take: 6,
        orderBy: { updatedAt: "desc" },
        select: { id: true, code: true, title: true, startDate: true, endDate: true, primaryGuest: { select: { fullName: true } }, destinations: { select: { name: true }, orderBy: { position: "asc" } } },
      }),
      db.guest.findMany({ where: { agencyId, OR: [{ fullName: ci }, { phone: { contains: q } }, { email: ci }] }, take: 6, select: { id: true, fullName: true, phone: true, email: true } }),
      db.hotel.findMany({ where: { agencies: { some: { agencyId } }, OR: [{ name: ci }, { location: ci }] }, take: 4, select: { id: true, name: true, location: true } }),
    ]);
    return [
      ...trips.map((t) => ({ id: t.id, group: "Trips" as const, title: `${t.code} · ${t.primaryGuest?.fullName ?? "No guest"}`, subtitle: [tripTitle(t), t.startDate ? toISO(t.startDate) : null].filter(Boolean).join(" · "), href: `/app/trips/${t.id}` })),
      ...guests.map((g) => ({ id: g.id, group: "Guests" as const, title: g.fullName, subtitle: [g.phone, g.email].filter(Boolean).join(" · ") || "No contact details", href: `/app/guests/${g.id}` })),
      ...hotels.map((h) => ({ id: h.id, group: "Hotels" as const, title: h.name, subtitle: h.location, href: `/app/hotels/${h.id}` })),
    ];
  }
  const [agencies, trips, hotels] = await Promise.all([
    db.agency.findMany({ where: { OR: [{ name: ci }, { ownerName: ci }, { email: ci }, { phone: { contains: q } }] }, take: 5, select: { id: true, name: true, ownerName: true, city: true } }),
    db.trip.findMany({ where: { OR: [{ code: ci }, { primaryGuest: { fullName: ci } }, { destinations: { some: { name: ci } } }] }, take: 6, orderBy: { updatedAt: "desc" }, select: { id: true, code: true, title: true, agency: { select: { name: true } }, primaryGuest: { select: { fullName: true } }, destinations: { select: { name: true }, orderBy: { position: "asc" } } } }),
    db.hotel.findMany({ where: { OR: [{ name: ci }, { location: ci }] }, take: 5, select: { id: true, name: true, location: true } }),
  ]);
  return [
    ...agencies.map((a) => ({ id: a.id, group: "Agencies" as const, title: a.name, subtitle: [a.ownerName, a.city].filter(Boolean).join(" · "), href: `/admin/agents/${a.id}` })),
    ...trips.map((t) => ({ id: t.id, group: "Trips" as const, title: `${t.code} · ${t.primaryGuest?.fullName ?? "No guest"}`, subtitle: `${t.agency.name} · ${tripTitle(t)}`, href: `/admin/trips/${t.id}` })),
    ...hotels.map((h) => ({ id: h.id, group: "Hotels" as const, title: h.name, subtitle: h.location, href: `/admin/hotels/${h.id}` })),
  ];
}

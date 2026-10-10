import "server-only";
import type { Prisma, TripStatus } from "@prisma/client";
import { db, type Tx } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { assertAgent, type Actor, type AgentActor } from "../auth/session";
import { tripDatesSchema, tripDestinationsSchema, tripTravelersSchema } from "@/lib/schemas";
import { addDays, diffDays, eachDay, toDate, toISO } from "@/lib/dates";
import { TRIP_STATUS_LABEL, TRIP_TRANSITIONS, type TripStatusValue } from "@/lib/labels";
import { ensureDestination } from "../hotels";
import { allocateNights } from "@/lib/plan";
import { priceLines, tripTotals } from "@/lib/pricing";
import { notifyAgency } from "../notifications";

/** Load a trip only if it belongs to the agent's agency (tenant guard). */
export async function ownTrip(agencyId: string, tripId: string, tx: Tx | typeof db = db) {
  const trip = await tx.trip.findFirst({ where: { id: tripId, agencyId } });
  if (!trip) throw notFound("Trip");
  return trip;
}

export function guard(actor: Actor | null): asserts actor is AgentActor {
  assertAgent(actor);
}

/**
 * Record that guest-visible content changed. Once a trip has been published
 * to the guest page, edits are held as "unpublished changes" until the agent
 * publishes a new version.
 */
export async function touch(tx: Tx | typeof db, tripId: string) {
  await tx.trip.updateMany({ where: { id: tripId, publishedVersion: { not: null } }, data: { hasUnpublishedChanges: true } });
  await recalcTotal(tx, tripId);
}

/** Recompute the cached trip total from its priced lines. */
export async function recalcTotal(tx: Tx | typeof db, tripId: string) {
  const t = await tx.trip.findUnique({
    where: { id: tripId },
    select: {
      priceOverride: true,
      rooms: { select: { roomName: true, nightlyRate: true, quantity: true, checkIn: true, checkOut: true } },
      transports: { select: { pickup: true, dropoff: true, price: true } },
      activities: { select: { title: true, price: true } },
    },
  });
  if (!t) return;
  const { total } = tripTotals(priceLines({ rooms: t.rooms, transports: t.transports, activities: t.activities }), t.priceOverride);
  await tx.trip.update({ where: { id: tripId }, data: { totalAmount: total } });
}

export function tripTitle(t: { title: string | null; destinations?: { name: string }[] }) {
  if (t.title) return t.title;
  if (t.destinations?.length) return t.destinations.map((d) => d.name).join(" · ");
  return "Untitled trip";
}

// ---- Creation & basics ------------------------------------------------------

export async function startTrip(actor: Actor | null, raw: unknown) {
  guard(actor);
  const input = tripTravelersSchema.parse(raw);
  const ids = [...new Set([input.primaryGuestId, ...input.guestIds])];
  const guests = await db.guest.findMany({ where: { id: { in: ids }, agencyId: actor.agencyId }, select: { id: true, fullName: true } });
  if (guests.length !== ids.length) throw new AppError("FORBIDDEN", "One or more guests don't belong to your agency.");
  const primary = guests.find((g) => g.id === input.primaryGuestId)!;

  return db.$transaction(async (tx) => {
    const { tripSeq } = await tx.agency.update({ where: { id: actor.agencyId }, data: { tripSeq: { increment: 1 } }, select: { tripSeq: true } });
    const trip = await tx.trip.create({
      data: {
        agencyId: actor.agencyId,
        code: `TRV-${tripSeq}`,
        status: "DRAFT",
        primaryGuestId: primary.id,
        adults: Math.max(input.adults, 1),
        children: input.children,
        infants: input.infants,
        wizardStep: 2,
        createdById: actor.userId,
        guests: { create: ids.map((guestId) => ({ agencyId: actor.agencyId, guestId, isPrimary: guestId === primary.id })) },
      },
    });
    await audit(actor, { action: "trip.created", entity: "Trip", entityId: trip.id, summary: `Created trip ${trip.code} for ${primary.fullName}` }, tx);
    return trip;
  });
}

export async function updateTravelers(actor: Actor | null, tripId: string, raw: unknown) {
  guard(actor);
  const input = tripTravelersSchema.parse(raw);
  await ownTrip(actor.agencyId, tripId);
  const ids = [...new Set([input.primaryGuestId, ...input.guestIds])];
  const guests = await db.guest.findMany({ where: { id: { in: ids }, agencyId: actor.agencyId }, select: { id: true } });
  if (guests.length !== ids.length) throw new AppError("FORBIDDEN", "One or more guests don't belong to your agency.");
  await db.$transaction(async (tx) => {
    await tx.tripGuest.deleteMany({ where: { tripId, guestId: { notIn: ids } } });
    for (const guestId of ids) {
      await tx.tripGuest.upsert({
        where: { tripId_guestId: { tripId, guestId } },
        create: { tripId, guestId, agencyId: actor.agencyId, isPrimary: guestId === input.primaryGuestId },
        update: { isPrimary: guestId === input.primaryGuestId },
      });
    }
    await tx.trip.update({ where: { id: tripId }, data: { primaryGuestId: input.primaryGuestId, adults: input.adults, children: input.children, infants: input.infants } });
    await touch(tx, tripId);
    await audit(actor, { action: "trip.travelers_updated", entity: "Trip", entityId: tripId, summary: `Travellers: ${input.adults} adults, ${input.children} children, ${input.infants} infants`, after: { guestIds: ids } }, tx);
  });
}

/** Keep ItineraryDay rows aligned with the trip's dates. */
export async function syncDays(tx: Tx, trip: { id: string; agencyId: string; startDate: Date | null; endDate: Date | null }) {
  if (!trip.startDate || !trip.endDate) return;
  const dates = eachDay(toISO(trip.startDate)!, toISO(trip.endDate)!);
  const existing = await tx.itineraryDay.findMany({ where: { tripId: trip.id }, include: { _count: { select: { items: true } } }, orderBy: { dayNumber: "asc" } });
  if (!existing.length) return; // itinerary not generated yet
  const extra = existing.filter((d) => d.dayNumber > dates.length);
  const blocked = extra.filter((d) => d._count.items > 0);
  if (blocked.length) {
    throw new AppError(
      "CONFLICT",
      `Day ${blocked.map((d) => d.dayNumber).join(", ")} still has itinerary items. Move or delete them before shortening the trip.`,
    );
  }
  if (extra.length) await tx.itineraryDay.deleteMany({ where: { id: { in: extra.map((d) => d.id) } } });
  for (let i = 0; i < dates.length; i++) {
    const day = existing.find((d) => d.dayNumber === i + 1);
    if (day) {
      if (toISO(day.date) !== dates[i]) await tx.itineraryDay.update({ where: { id: day.id }, data: { date: toDate(dates[i]) } });
    } else {
      await tx.itineraryDay.create({ data: { tripId: trip.id, agencyId: trip.agencyId, dayNumber: i + 1, date: toDate(dates[i]) } });
    }
  }
}

export async function updateDates(actor: Actor | null, tripId: string, raw: unknown) {
  guard(actor);
  const input = tripDatesSchema.parse(raw);
  const trip = await ownTrip(actor.agencyId, tripId);
  const prevStart = toISO(trip.startDate);
  const prevEnd = toISO(trip.endDate);
  if (prevStart === input.startDate && prevEnd === input.endDate) return;

  await db.$transaction(async (tx) => {
    const updated = await tx.trip.update({
      where: { id: tripId },
      data: { startDate: toDate(input.startDate), endDate: toDate(input.endDate), wizardStep: Math.max(trip.wizardStep, 3) },
    });
    // Moving the whole trip (same length) shifts every dated line with it, so
    // the agent doesn't have to re-enter hotels, transfers and activities.
    if (prevStart && prevEnd && diffDays(prevStart, prevEnd) === diffDays(input.startDate, input.endDate)) {
      const shift = diffDays(prevStart, input.startDate);
      if (shift !== 0) await shiftTrip(tx, tripId, shift);
    }
    await syncDays(tx, updated);
    await touch(tx, tripId);
    await audit(
      actor,
      { action: "trip.dates_updated", entity: "Trip", entityId: tripId, summary: `Dates set to ${input.startDate} → ${input.endDate}`, before: { startDate: prevStart, endDate: prevEnd }, after: input },
      tx,
    );
  });
}

async function shiftTrip(tx: Tx, tripId: string, days: number) {
  const s = (d: Date) => toDate(addDays(toISO(d)!, days));
  for (const h of await tx.tripHotel.findMany({ where: { tripId } })) await tx.tripHotel.update({ where: { id: h.id }, data: { checkIn: s(h.checkIn), checkOut: s(h.checkOut) } });
  for (const r of await tx.tripRoom.findMany({ where: { tripId } })) await tx.tripRoom.update({ where: { id: r.id }, data: { checkIn: s(r.checkIn), checkOut: s(r.checkOut) } });
  for (const t of await tx.tripTransport.findMany({ where: { tripId } })) await tx.tripTransport.update({ where: { id: t.id }, data: { date: s(t.date) } });
  for (const a of await tx.tripActivity.findMany({ where: { tripId } })) await tx.tripActivity.update({ where: { id: a.id }, data: { date: s(a.date) } });
}

/** Split nights across destinations: explicit values first, the rest evenly. */
export { allocateNights } from "@/lib/plan";

export async function setDestinations(actor: Actor | null, tripId: string, raw: unknown) {
  guard(actor);
  const input = tripDestinationsSchema.parse(raw);
  const trip = await ownTrip(actor.agencyId, tripId);
  const nights = trip.startDate && trip.endDate ? diffDays(toISO(trip.startDate)!, toISO(trip.endDate)!) : 0;
  const fixed = input.destinations.reduce((sum, d) => sum + (d.nights ?? 0), 0);
  if (nights && fixed > nights) throw new AppError("VALIDATION_ERROR", `These destinations add up to ${fixed} nights, but the trip has ${nights}. Reduce some nights or change the trip dates.`);
  const allocated = allocateNights(
    nights,
    input.destinations.map((d) => d.nights),
  );
  await db.$transaction(async (tx) => {
    const rows = [];
    for (const [i, d] of input.destinations.entries()) {
      // Custom destinations become part of the shared catalogue so they can be reused.
      const dest = d.destinationId ? await tx.destination.findUnique({ where: { id: d.destinationId } }) : await ensureDestination(d.name, tx);
      rows.push({ agencyId: actor.agencyId, tripId, name: dest?.name ?? d.name, destinationId: dest?.id ?? null, position: i, nights: allocated[i] ?? null });
    }
    await tx.tripDestination.deleteMany({ where: { tripId } });
    if (rows.length) await tx.tripDestination.createMany({ data: rows });
    await tx.trip.update({ where: { id: tripId }, data: { wizardStep: Math.max(trip.wizardStep, 4) } });
    await touch(tx, tripId);
    await audit(actor, { action: "trip.destinations_updated", entity: "Trip", entityId: tripId, summary: `Destinations: ${rows.map((r) => `${r.name} (${r.nights ?? "?"}N)`).join(", ") || "none"}` }, tx);
  });
}

export async function updateTripMeta(actor: Actor | null, tripId: string, input: { title?: string | null; notes?: string | null; priceOverride?: number | null; wizardStep?: number }) {
  guard(actor);
  const trip = await ownTrip(actor.agencyId, tripId);
  const data: Prisma.TripUpdateInput = {};
  if (input.title !== undefined) data.title = input.title?.trim().slice(0, 120) || null;
  if (input.notes !== undefined) data.notes = input.notes?.trim().slice(0, 4000) || null;
  if (input.priceOverride !== undefined) {
    if (input.priceOverride !== null && (!Number.isInteger(input.priceOverride) || input.priceOverride < 0 || input.priceOverride > 100_000_000)) {
      throw new AppError("VALIDATION_ERROR", "Enter a valid package price.");
    }
    data.priceOverride = input.priceOverride;
  }
  if (input.wizardStep !== undefined) data.wizardStep = Math.min(10, Math.max(trip.wizardStep, Math.max(1, Math.floor(input.wizardStep))));
  await db.trip.update({ where: { id: tripId }, data });
  if (input.title !== undefined || input.priceOverride !== undefined) {
    await touch(db, tripId);
    await audit(actor, {
      action: "trip.updated",
      entity: "Trip",
      entityId: tripId,
      summary: input.priceOverride !== undefined ? `Package price ${input.priceOverride === null ? "reset to itemised total" : `set to ₹${input.priceOverride}`}` : "Trip details updated",
      before: { title: trip.title, priceOverride: trip.priceOverride },
      after: { title: data.title ?? trip.title, priceOverride: input.priceOverride ?? trip.priceOverride },
    });
  }
}

export async function setTripStatus(actor: Actor | null, tripId: string, next: TripStatus) {
  guard(actor);
  const trip = await ownTrip(actor.agencyId, tripId);
  if (trip.status === next) return;
  const allowed = TRIP_TRANSITIONS[trip.status as TripStatusValue] ?? [];
  if (!allowed.includes(next as TripStatusValue)) {
    throw new AppError("VALIDATION_ERROR", `A ${TRIP_STATUS_LABEL[trip.status as TripStatusValue]} trip can't move to ${TRIP_STATUS_LABEL[next as TripStatusValue]}.`);
  }
  if ((next === "READY" || next === "CONFIRMED") && (!trip.startDate || !trip.endDate || !trip.primaryGuestId)) {
    throw new AppError("VALIDATION_ERROR", "Add the guest and travel dates first.");
  }
  await db.$transaction(async (tx) => {
    await tx.trip.update({
      where: { id: tripId },
      data: {
        status: next,
        ...(next === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
        ...(next === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      },
    });
    await audit(actor, { action: "trip.status_changed", entity: "Trip", entityId: tripId, summary: `Moved ${trip.code} from ${TRIP_STATUS_LABEL[trip.status as TripStatusValue]} to ${TRIP_STATUS_LABEL[next as TripStatusValue]}`, before: { status: trip.status }, after: { status: next } }, tx);
  });
  if (next === "CANCELLED") await notifyAgency(actor.agencyId, { type: "trip.cancelled", title: `${trip.code} was cancelled`, href: `/app/trips/${tripId}` }, { exceptUserId: actor.userId });
}

export async function deleteDraft(actor: Actor | null, tripId: string) {
  guard(actor);
  const trip = await ownTrip(actor.agencyId, tripId);
  if (trip.status !== "DRAFT") throw new AppError("CONFLICT", "Only drafts can be deleted. Cancel the trip instead.");
  const docs = await db.document.findMany({ where: { tripId }, select: { storageKey: true } });
  await db.trip.delete({ where: { id: tripId } });
  const { storage } = await import("../storage");
  await Promise.all(docs.map((d) => storage().delete(d.storageKey).catch(() => {})));
  await audit(actor, { action: "trip.deleted", entity: "Trip", entityId: tripId, summary: `Deleted draft ${trip.code}` });
}

export async function addTripNote(actor: Actor | null, tripId: string, body: string) {
  guard(actor);
  await ownTrip(actor.agencyId, tripId);
  const text = body.trim();
  if (!text) throw new AppError("VALIDATION_ERROR", "Write a note first.");
  if (text.length > 4000) throw new AppError("VALIDATION_ERROR", "Notes are limited to 4,000 characters.");
  const note = await db.tripNote.create({ data: { tripId, agencyId: actor.agencyId, body: text, authorId: actor.userId, authorName: actor.name } });
  await audit(actor, { action: "trip.note_added", entity: "Trip", entityId: tripId, summary: "Added an internal note" });
  return note;
}

export async function deleteTripNote(actor: Actor | null, noteId: string) {
  guard(actor);
  const note = await db.tripNote.findFirst({ where: { id: noteId, agencyId: actor.agencyId } });
  if (!note) throw notFound("Note");
  await db.tripNote.delete({ where: { id: noteId } });
}

/** Move CONFIRMED → ONGOING → COMPLETED as dates pass (idempotent, cheap). */
export async function rollStatuses(today: Date, agencyId?: string) {
  const scope = agencyId ? { agencyId } : {};
  await db.trip.updateMany({ where: { ...scope, status: "CONFIRMED", startDate: { lte: today }, endDate: { gte: today } }, data: { status: "ONGOING" } });
  await db.trip.updateMany({ where: { ...scope, status: { in: ["CONFIRMED", "ONGOING"] }, endDate: { lt: today } }, data: { status: "COMPLETED" } });
}

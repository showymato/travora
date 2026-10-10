import "server-only";
import type { MealPlan } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { activitySchema, nul, stayCreateSchema, stayPlanSchema, stayRoomSchema, stayUpdateSchema, transportSchema } from "@/lib/schemas";
import { toDate, toISO } from "@/lib/dates";
import { ACTIVITY_KIND_LABEL, TRANSPORT_KIND_LABEL, type ActivityKindValue, type TransportKindValue } from "@/lib/labels";
import { effectiveRate } from "../hotels";
import { guard, ownTrip, touch } from "./core";
import { activityItem, syncLinked, syncStay, transportItem } from "./itinerary";

function assertWithinTrip(trip: { startDate: Date | null; endDate: Date | null }, from: string, to?: string) {
  if (!trip.startDate || !trip.endDate) throw new AppError("VALIDATION_ERROR", "Set the trip dates first.");
  const s = toISO(trip.startDate)!;
  const e = toISO(trip.endDate)!;
  if (from < s || from > e || (to && (to < s || to > e))) {
    throw new AppError("VALIDATION_ERROR", `Dates must fall within the trip (${s} → ${e}).`, { fieldErrors: { [to ? "checkIn" : "date"]: "Outside the trip dates." } });
  }
}

const hotelSelect = { select: { name: true, location: true, checkInTime: true, checkOutTime: true } } as const;

// ---- Hotel stays ------------------------------------------------------------

export async function addStay(actor: Actor | null, tripId: string, raw: unknown) {
  guard(actor);
  const input = stayCreateSchema.parse(raw);
  const trip = await ownTrip(actor.agencyId, tripId);
  assertWithinTrip(trip, input.checkIn, input.checkOut);
  // Only hotels assigned to this agency can be booked.
  const hotel = await db.hotel.findFirst({ where: { id: input.hotelId, status: "ACTIVE", agencies: { some: { agencyId: actor.agencyId } } }, select: { id: true, name: true } });
  if (!hotel) throw new AppError("FORBIDDEN", "That hotel isn't available to your agency.");
  return db.$transaction(async (tx) => {
    const count = await tx.tripHotel.count({ where: { tripId } });
    const stay = await tx.tripHotel.create({
      data: { tripId, agencyId: actor.agencyId, hotelId: hotel.id, checkIn: toDate(input.checkIn), checkOut: toDate(input.checkOut), position: count },
      include: { hotel: hotelSelect },
    });
    await syncStay(tx, stay);
    await tx.trip.update({ where: { id: tripId }, data: { wizardStep: Math.max(trip.wizardStep, 5) } });
    await touch(tx, tripId);
    await audit(actor, { action: "trip.hotel_added", entity: "Trip", entityId: tripId, summary: `Added ${hotel.name} (${input.checkIn} → ${input.checkOut})` }, tx);
    return stay;
  });
}

/**
 * Set a hotel and its exact room selection for one stay, atomically.
 *
 * - `stayId` given: that stay is edited in place, or replaced if the hotel changed.
 * - `stayId` null: an existing stay at the same hotel overlapping these dates is
 *   reused, so a retried or double-clicked request never creates a duplicate.
 *
 * Rooms are replaced with exactly the requested set. Nightly rates come from the
 * agency's authorised rate (rates already booked for an unchanged room type are
 * kept), and the trip row is locked so concurrent requests serialise.
 */
export async function planStay(actor: Actor | null, tripId: string, raw: unknown) {
  guard(actor);
  const input = stayPlanSchema.parse(raw);
  const trip = await ownTrip(actor.agencyId, tripId);
  assertWithinTrip(trip, input.checkIn, input.checkOut);
  const hotel = await db.hotel.findFirst({ where: { id: input.hotelId, status: "ACTIVE", agencies: { some: { agencyId: actor.agencyId } } }, select: { id: true, name: true } });
  if (!hotel) throw new AppError("FORBIDDEN", "That hotel isn't available to your agency.");

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Trip" WHERE id = ${tripId} FOR UPDATE`;
    const priced = [];
    for (const r of input.rooms) {
      const room = await effectiveRate(actor.agencyId, r.roomId, tx);
      if (room.hotelId !== hotel.id || room.status !== "ACTIVE") throw new AppError("VALIDATION_ERROR", "That room type isn't available at this hotel.");
      if (!room.mealPlans.includes(r.mealPlan as MealPlan)) throw new AppError("VALIDATION_ERROR", `${room.name} isn't offered with that meal plan.`);
      if (r.guests > room.capacity * r.quantity) throw new AppError("VALIDATION_ERROR", `${room.name} holds up to ${room.capacity * r.quantity} guests in ${r.quantity} room${r.quantity === 1 ? "" : "s"}.`);
      priced.push({ ...r, name: room.name, rate: room.rate });
    }

    let existing = input.stayId
      ? await tx.tripHotel.findFirst({ where: { id: input.stayId, tripId, agencyId: actor.agencyId }, include: { rooms: true, hotel: hotelSelect } })
      : await tx.tripHotel.findFirst({
          where: { tripId, agencyId: actor.agencyId, hotelId: hotel.id, checkIn: { lt: toDate(input.checkOut) }, checkOut: { gt: toDate(input.checkIn) } },
          include: { rooms: true, hotel: hotelSelect },
        });
    if (input.stayId && !existing) throw notFound("Hotel stay");

    let replaced: string | null = null;
    if (existing && existing.hotelId !== hotel.id) {
      // Replacing the hotel: drop the old stay (and its itinerary items) first.
      replaced = existing.hotel.name;
      await syncStay(tx, { id: existing.id, tripId, removed: true });
      await tx.tripHotel.delete({ where: { id: existing.id } });
      existing = null;
    }

    const keptRates = new Map((existing?.rooms ?? []).map((r) => [r.roomId, r.nightlyRate]));
    const stay = existing
      ? await tx.tripHotel.update({ where: { id: existing.id }, data: { checkIn: toDate(input.checkIn), checkOut: toDate(input.checkOut) }, include: { hotel: hotelSelect } })
      : await tx.tripHotel.create({
          data: { tripId, agencyId: actor.agencyId, hotelId: hotel.id, checkIn: toDate(input.checkIn), checkOut: toDate(input.checkOut), position: await tx.tripHotel.count({ where: { tripId } }) },
          include: { hotel: hotelSelect },
        });
    await tx.tripRoom.deleteMany({ where: { tripHotelId: stay.id } });
    await tx.tripRoom.createMany({
      data: priced.map((r) => ({
        tripId,
        agencyId: actor.agencyId,
        tripHotelId: stay.id,
        roomId: r.roomId,
        roomName: r.name,
        nightlyRate: keptRates.get(r.roomId) ?? r.rate,
        quantity: r.quantity,
        guests: r.guests,
        mealPlan: r.mealPlan,
        checkIn: toDate(input.checkIn),
        checkOut: toDate(input.checkOut),
      })),
    });
    await syncStay(tx, stay);
    await tx.trip.update({ where: { id: tripId }, data: { wizardStep: Math.max(trip.wizardStep, 5) } });
    await touch(tx, tripId);
    const rooms = priced.map((r) => `${r.quantity} × ${r.name} (${r.mealPlan})`).join(", ");
    await audit(
      actor,
      {
        action: existing ? "trip.hotel_updated" : "trip.hotel_added",
        entity: "Trip",
        entityId: tripId,
        summary: `${replaced ? `Replaced ${replaced} with` : existing ? "Updated" : "Added"} ${hotel.name} (${input.checkIn} → ${input.checkOut}): ${rooms}`,
      },
      tx,
    );
    return { stayId: stay.id, replaced: Boolean(replaced), created: !existing };
  });
}

async function ownStay(agencyId: string, stayId: string) {
  const stay = await db.tripHotel.findFirst({ where: { id: stayId, agencyId }, include: { hotel: hotelSelect, trip: true } });
  if (!stay) throw notFound("Hotel stay");
  return stay;
}

export async function updateStay(actor: Actor | null, stayId: string, raw: unknown) {
  guard(actor);
  const input = stayUpdateSchema.parse(raw);
  const stay = await ownStay(actor.agencyId, stayId);
  assertWithinTrip(stay.trip, input.checkIn, input.checkOut);
  await db.$transaction(async (tx) => {
    const datesChanged = toISO(stay.checkIn) !== input.checkIn || toISO(stay.checkOut) !== input.checkOut;
    const updated = await tx.tripHotel.update({
      where: { id: stayId },
      data: {
        checkIn: toDate(input.checkIn),
        checkOut: toDate(input.checkOut),
        confirmationStatus: input.confirmationStatus,
        confirmationNumber: nul(input.confirmationNumber),
        notes: nul(input.notes),
      },
      include: { hotel: hotelSelect },
    });
    // Rooms follow the stay's dates when they matched them before.
    if (datesChanged) {
      await tx.tripRoom.updateMany({
        where: { tripHotelId: stayId, checkIn: stay.checkIn, checkOut: stay.checkOut },
        data: { checkIn: toDate(input.checkIn), checkOut: toDate(input.checkOut) },
      });
      await syncStay(tx, updated);
    }
    await touch(tx, stay.tripId);
    await audit(
      actor,
      {
        action: stay.confirmationStatus !== input.confirmationStatus ? "trip.hotel_confirmation" : "trip.hotel_updated",
        entity: "Trip",
        entityId: stay.tripId,
        summary: `${stay.hotel.name}: ${stay.confirmationStatus !== input.confirmationStatus ? `confirmation ${input.confirmationStatus.toLowerCase()}` : "stay updated"}`,
        before: { checkIn: toISO(stay.checkIn), checkOut: toISO(stay.checkOut), confirmationStatus: stay.confirmationStatus, confirmationNumber: stay.confirmationNumber },
        after: { checkIn: input.checkIn, checkOut: input.checkOut, confirmationStatus: input.confirmationStatus, confirmationNumber: nul(input.confirmationNumber) },
      },
      tx,
    );
  });
}

export async function removeStay(actor: Actor | null, stayId: string) {
  guard(actor);
  const stay = await ownStay(actor.agencyId, stayId);
  await db.$transaction(async (tx) => {
    await syncStay(tx, { id: stay.id, tripId: stay.tripId, removed: true });
    await tx.tripHotel.delete({ where: { id: stayId } });
    await touch(tx, stay.tripId);
    await audit(actor, { action: "trip.hotel_removed", entity: "Trip", entityId: stay.tripId, summary: `Removed ${stay.hotel.name}` }, tx);
  });
}

export async function addStayRoom(actor: Actor | null, stayId: string, raw: unknown) {
  guard(actor);
  const input = stayRoomSchema.parse(raw);
  const stay = await ownStay(actor.agencyId, stayId);
  if (input.checkIn < toISO(stay.checkIn)! || input.checkOut > toISO(stay.checkOut)!) {
    throw new AppError("VALIDATION_ERROR", "Room dates must fall within the hotel stay.", { fieldErrors: { checkIn: "Outside the stay." } });
  }
  const room = await effectiveRate(actor.agencyId, input.roomId);
  if (room.hotelId !== stay.hotelId || room.status !== "ACTIVE") throw new AppError("VALIDATION_ERROR", "That room type isn't available at this hotel.");
  if (!room.mealPlans.includes(input.mealPlan as MealPlan)) throw new AppError("VALIDATION_ERROR", "That meal plan isn't offered for this room.", { fieldErrors: { mealPlan: "Not offered." } });
  await db.$transaction(async (tx) => {
    await tx.tripRoom.create({
      data: {
        tripId: stay.tripId,
        agencyId: actor.agencyId,
        tripHotelId: stayId,
        roomId: room.roomId,
        roomName: room.name,
        nightlyRate: room.rate,
        quantity: input.quantity,
        guests: input.guests,
        mealPlan: input.mealPlan,
        checkIn: toDate(input.checkIn),
        checkOut: toDate(input.checkOut),
      },
    });
    await tx.trip.update({ where: { id: stay.tripId }, data: { wizardStep: Math.max(stay.trip.wizardStep, 6) } });
    await touch(tx, stay.tripId);
    await audit(actor, { action: "trip.room_added", entity: "Trip", entityId: stay.tripId, summary: `${stay.hotel.name}: ${input.quantity} × ${room.name} (${input.mealPlan})` }, tx);
  });
}

export async function updateStayRoom(actor: Actor | null, tripRoomId: string, raw: unknown) {
  guard(actor);
  const input = stayRoomSchema.parse(raw);
  const row = await db.tripRoom.findFirst({ where: { id: tripRoomId, agencyId: actor.agencyId }, include: { tripHotel: { include: { hotel: { select: { name: true } } } } } });
  if (!row) throw notFound("Room");
  if (input.checkIn < toISO(row.tripHotel.checkIn)! || input.checkOut > toISO(row.tripHotel.checkOut)!) {
    throw new AppError("VALIDATION_ERROR", "Room dates must fall within the hotel stay.", { fieldErrors: { checkIn: "Outside the stay." } });
  }
  const room = await effectiveRate(actor.agencyId, input.roomId);
  if (room.hotelId !== row.tripHotel.hotelId) throw new AppError("VALIDATION_ERROR", "That room type isn't available at this hotel.");
  if (!room.mealPlans.includes(input.mealPlan as MealPlan)) throw new AppError("VALIDATION_ERROR", "That meal plan isn't offered for this room.", { fieldErrors: { mealPlan: "Not offered." } });
  // Keep the booked price unless the room type itself changed.
  const changedRoom = room.roomId !== row.roomId;
  await db.$transaction(async (tx) => {
    await tx.tripRoom.update({
      where: { id: tripRoomId },
      data: {
        roomId: room.roomId,
        roomName: room.name,
        nightlyRate: changedRoom ? room.rate : row.nightlyRate,
        quantity: input.quantity,
        guests: input.guests,
        mealPlan: input.mealPlan,
        checkIn: toDate(input.checkIn),
        checkOut: toDate(input.checkOut),
      },
    });
    await touch(tx, row.tripId);
    await audit(
      actor,
      { action: "trip.room_updated", entity: "Trip", entityId: row.tripId, summary: `${row.tripHotel.hotel.name}: ${input.quantity} × ${room.name} (${input.mealPlan})`, before: { room: row.roomName, quantity: row.quantity, mealPlan: row.mealPlan }, after: { room: room.name, quantity: input.quantity, mealPlan: input.mealPlan } },
      tx,
    );
  });
}

export async function removeStayRoom(actor: Actor | null, tripRoomId: string) {
  guard(actor);
  const row = await db.tripRoom.findFirst({ where: { id: tripRoomId, agencyId: actor.agencyId } });
  if (!row) throw notFound("Room");
  await db.$transaction(async (tx) => {
    await tx.tripRoom.delete({ where: { id: tripRoomId } });
    await touch(tx, row.tripId);
    await audit(actor, { action: "trip.room_removed", entity: "Trip", entityId: row.tripId, summary: `Removed ${row.quantity} × ${row.roomName}` }, tx);
  });
}

// ---- Transport ----------------------------------------------------------------

function transportData(input: ReturnType<typeof transportSchema.parse>) {
  return {
    kind: input.kind,
    date: toDate(input.date),
    time: nul(input.time),
    pickup: input.pickup,
    dropoff: input.dropoff,
    vehicle: nul(input.vehicle),
    driverName: nul(input.driverName),
    driverPhone: nul(input.driverPhone),
    vehicleNumber: nul(input.vehicleNumber),
    notes: nul(input.notes),
    price: input.price,
    addToItinerary: input.addToItinerary,
  };
}

export async function saveTransport(actor: Actor | null, tripId: string, transportId: string | null, raw: unknown) {
  guard(actor);
  const input = transportSchema.parse(raw);
  const trip = await ownTrip(actor.agencyId, tripId);
  assertWithinTrip(trip, input.date);
  const data = transportData(input);
  return db.$transaction(async (tx) => {
    let row;
    if (transportId) {
      const before = await tx.tripTransport.findFirst({ where: { id: transportId, tripId, agencyId: actor.agencyId } });
      if (!before) throw notFound("Transport");
      row = await tx.tripTransport.update({ where: { id: transportId }, data });
      await audit(actor, { action: "trip.transport_updated", entity: "Trip", entityId: tripId, summary: `${TRANSPORT_KIND_LABEL[input.kind as TransportKindValue]} ${input.pickup} → ${input.dropoff} updated`, before: { date: toISO(before.date), time: before.time, driver: before.driverName, vehicle: before.vehicleNumber }, after: { date: input.date, time: input.time, driver: input.driverName, vehicle: input.vehicleNumber } }, tx);
    } else {
      row = await tx.tripTransport.create({ data: { ...data, tripId, agencyId: actor.agencyId } });
      await tx.trip.update({ where: { id: tripId }, data: { wizardStep: Math.max(trip.wizardStep, 7) } });
      await audit(actor, { action: "trip.transport_added", entity: "Trip", entityId: tripId, summary: `Added ${TRANSPORT_KIND_LABEL[input.kind as TransportKindValue].toLowerCase()} ${input.pickup} → ${input.dropoff}` }, tx);
    }
    await syncLinked(tx, tripId, row.id, row.addToItinerary ? { date: input.date, item: transportItem(row) } : null);
    await touch(tx, tripId);
    return row;
  });
}

export async function removeTransport(actor: Actor | null, transportId: string) {
  guard(actor);
  const row = await db.tripTransport.findFirst({ where: { id: transportId, agencyId: actor.agencyId } });
  if (!row) throw notFound("Transport");
  await db.$transaction(async (tx) => {
    await syncLinked(tx, row.tripId, row.id, null);
    await tx.tripTransport.delete({ where: { id: transportId } });
    await touch(tx, row.tripId);
    await audit(actor, { action: "trip.transport_removed", entity: "Trip", entityId: row.tripId, summary: `Removed transfer ${row.pickup} → ${row.dropoff}` }, tx);
  });
}

// ---- Activities ---------------------------------------------------------------

function activityData(input: ReturnType<typeof activitySchema.parse>) {
  return {
    kind: input.kind,
    date: toDate(input.date),
    time: nul(input.time),
    title: input.title,
    location: nul(input.location),
    description: nul(input.description),
    durationMins: input.durationMins,
    notes: nul(input.notes),
    price: input.price,
    addToItinerary: input.addToItinerary,
  };
}

export async function saveActivity(actor: Actor | null, tripId: string, activityId: string | null, raw: unknown) {
  guard(actor);
  const input = activitySchema.parse(raw);
  const trip = await ownTrip(actor.agencyId, tripId);
  assertWithinTrip(trip, input.date);
  const data = activityData(input);
  return db.$transaction(async (tx) => {
    let row;
    if (activityId) {
      const before = await tx.tripActivity.findFirst({ where: { id: activityId, tripId, agencyId: actor.agencyId } });
      if (!before) throw notFound("Activity");
      row = await tx.tripActivity.update({ where: { id: activityId }, data });
      await audit(actor, { action: "trip.activity_updated", entity: "Trip", entityId: tripId, summary: `Updated ${input.title}`, before: { date: toISO(before.date), time: before.time, title: before.title }, after: { date: input.date, time: input.time, title: input.title } }, tx);
    } else {
      row = await tx.tripActivity.create({ data: { ...data, tripId, agencyId: actor.agencyId } });
      await tx.trip.update({ where: { id: tripId }, data: { wizardStep: Math.max(trip.wizardStep, 8) } });
      await audit(actor, { action: "trip.activity_added", entity: "Trip", entityId: tripId, summary: `Added ${ACTIVITY_KIND_LABEL[input.kind as ActivityKindValue].toLowerCase()}: ${input.title}` }, tx);
    }
    await syncLinked(tx, tripId, row.id, row.addToItinerary ? { date: input.date, item: activityItem(row) } : null);
    await touch(tx, tripId);
    return row;
  });
}

export async function removeActivity(actor: Actor | null, activityId: string) {
  guard(actor);
  const row = await db.tripActivity.findFirst({ where: { id: activityId, agencyId: actor.agencyId } });
  if (!row) throw notFound("Activity");
  await db.$transaction(async (tx) => {
    await syncLinked(tx, row.tripId, row.id, null);
    await tx.tripActivity.delete({ where: { id: activityId } });
    await touch(tx, row.tripId);
    await audit(actor, { action: "trip.activity_removed", entity: "Trip", entityId: row.tripId, summary: `Removed ${row.title}` }, tx);
  });
}

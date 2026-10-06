import "server-only";
import type { ItemSource, ItineraryItemType, TripActivity, TripHotel, TripTransport } from "@prisma/client";
import { db, type Tx } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { itineraryItemSchema, nul } from "@/lib/schemas";
import { eachDay, timeKey, toDate, toISO } from "@/lib/dates";
import type { ActivityKindValue } from "@/lib/labels";
import { guard, ownTrip, touch } from "./core";

type NewItem = {
  time: string | null;
  type: ItineraryItemType;
  title: string;
  description?: string | null;
  location?: string | null;
  durationMins?: number | null;
  notes?: string | null;
  source: ItemSource;
  sourceId?: string | null;
};

// ---- Days -------------------------------------------------------------------

/** Create one ItineraryDay per calendar day of the trip (no-op if they exist). */
export async function ensureDays(tx: Tx, trip: { id: string; agencyId: string; startDate: Date | null; endDate: Date | null }) {
  if (!trip.startDate || !trip.endDate) throw new AppError("VALIDATION_ERROR", "Set the trip dates before building the itinerary.");
  const dates = eachDay(toISO(trip.startDate)!, toISO(trip.endDate)!);
  const existing = await tx.itineraryDay.findMany({ where: { tripId: trip.id }, orderBy: { dayNumber: "asc" } });
  if (existing.length === dates.length) return existing;
  for (let i = existing.length; i < dates.length; i++) {
    await tx.itineraryDay.create({ data: { tripId: trip.id, agencyId: trip.agencyId, dayNumber: i + 1, date: toDate(dates[i]) } });
  }
  return tx.itineraryDay.findMany({ where: { tripId: trip.id }, orderBy: { dayNumber: "asc" } });
}

/** Insert an item in time order (untimed items go after timed ones). Respects manual order otherwise. */
async function insertInOrder(tx: Tx, day: { id: string; tripId: string; agencyId: string }, item: NewItem, forcePosition?: number) {
  const items = await tx.itineraryItem.findMany({ where: { dayId: day.id }, orderBy: { position: "asc" }, select: { id: true, time: true } });
  // Before the first *timed* item that is later; untimed items keep their place.
  let index = forcePosition ?? (item.time ? items.findIndex((i) => i.time !== null && timeKey(i.time) > timeKey(item.time)) : -1);
  if (index < 0 || index > items.length) index = items.length;
  for (let p = items.length - 1; p >= index; p--) {
    await tx.itineraryItem.update({ where: { id: items[p].id }, data: { position: p + 1 } });
  }
  return tx.itineraryItem.create({
    data: {
      tripId: day.tripId,
      agencyId: day.agencyId,
      dayId: day.id,
      position: index,
      time: item.time,
      type: item.type,
      title: item.title,
      description: item.description ?? null,
      location: item.location ?? null,
      durationMins: item.durationMins ?? null,
      notes: item.notes ?? null,
      source: item.source,
      sourceId: item.sourceId ?? null,
    },
  });
}

async function renumber(tx: Tx, dayId: string) {
  const items = await tx.itineraryItem.findMany({ where: { dayId }, orderBy: { position: "asc" }, select: { id: true, position: true } });
  for (const [i, it] of items.entries()) if (it.position !== i) await tx.itineraryItem.update({ where: { id: it.id }, data: { position: i } });
}

// ---- Items mirrored from structured trip data ------------------------------

export function transportItem(t: TripTransport): NewItem {
  const title = t.kind === "AIRPORT_TRANSFER" ? "Airport transfer" : `Transfer to ${t.dropoff}`;
  const vehicle = [t.vehicle, t.vehicleNumber].filter(Boolean).join(" · ");
  const driver = [t.driverName, t.driverPhone].filter(Boolean).join(" · ");
  return {
    time: t.time,
    type: "TRANSPORT",
    title,
    location: `${t.pickup} → ${t.dropoff}`,
    description: [vehicle && `Vehicle: ${vehicle}`, driver && `Driver: ${driver}`].filter(Boolean).join("\n") || null,
    notes: t.notes,
    source: "TRANSPORT",
    sourceId: t.id,
  };
}

const ACTIVITY_TYPE: Record<ActivityKindValue, ItineraryItemType> = {
  SIGHTSEEING: "SIGHTSEEING",
  ACTIVITY: "ACTIVITY",
  EXPERIENCE: "ACTIVITY",
  MEAL: "MEAL",
  FREE_TIME: "FREE_TIME",
  CUSTOM: "CUSTOM",
};

export function activityItem(a: TripActivity): NewItem {
  return {
    time: a.time,
    type: ACTIVITY_TYPE[a.kind as ActivityKindValue],
    title: a.title,
    location: a.location,
    description: a.description,
    durationMins: a.durationMins,
    notes: a.notes,
    source: "ACTIVITY",
    sourceId: a.id,
  };
}

type StayWithHotel = TripHotel & { hotel: { name: string; location: string; checkInTime: string; checkOutTime: string } };

export function stayItems(s: StayWithHotel): { date: string; item: NewItem }[] {
  return [
    {
      date: toISO(s.checkIn)!,
      item: { time: s.hotel.checkInTime, type: "HOTEL_CHECK_IN", title: `Check-in · ${s.hotel.name}`, location: s.hotel.location, source: "HOTEL", sourceId: s.id },
    },
    {
      date: toISO(s.checkOut)!,
      item: { time: s.hotel.checkOutTime, type: "HOTEL_CHECK_OUT", title: `Check-out · ${s.hotel.name}`, location: s.hotel.location, source: "HOTEL", sourceId: s.id },
    },
  ];
}

/** Create, move or remove the itinerary item that mirrors a transport/activity. No-op until days exist. */
export async function syncLinked(tx: Tx, tripId: string, sourceId: string, entry: { date: string; item: NewItem } | null) {
  const existing = await tx.itineraryItem.findMany({ where: { tripId, sourceId } });
  if (!entry) {
    for (const e of existing) await tx.itineraryItem.delete({ where: { id: e.id } });
    for (const dayId of new Set(existing.map((e) => e.dayId))) await renumber(tx, dayId);
    return;
  }
  const day = await tx.itineraryDay.findFirst({ where: { tripId, date: toDate(entry.date) } });
  const current = existing.find((e) => e.type === entry.item.type) ?? existing[0];
  if (!day) {
    // Outside the trip's days (or itinerary not generated): drop any stale copy.
    if (current) {
      await tx.itineraryItem.delete({ where: { id: current.id } });
      await renumber(tx, current.dayId);
    }
    return;
  }
  if (current && current.dayId === day.id) {
    await tx.itineraryItem.update({
      where: { id: current.id },
      data: { time: entry.item.time, type: entry.item.type, title: entry.item.title, location: entry.item.location ?? null, description: entry.item.description ?? null, durationMins: entry.item.durationMins ?? null, notes: entry.item.notes ?? null },
    });
    return;
  }
  if (current) {
    await tx.itineraryItem.delete({ where: { id: current.id } });
    await renumber(tx, current.dayId);
  }
  await insertInOrder(tx, day, entry.item);
}

/** Stays have two mirrored items (check-in and check-out). */
export async function syncStay(tx: Tx, stay: StayWithHotel | { id: string; tripId: string; removed: true }) {
  if ("removed" in stay) return syncLinked(tx, stay.tripId, stay.id, null);
  const [checkIn, checkOut] = stayItems(stay);
  const existing = await tx.itineraryItem.findMany({ where: { tripId: stay.tripId, sourceId: stay.id } });
  for (const entry of [checkIn, checkOut]) {
    const cur = existing.find((e) => e.type === entry.item.type);
    const day = await tx.itineraryDay.findFirst({ where: { tripId: stay.tripId, date: toDate(entry.date) } });
    if (cur && (!day || cur.dayId !== day.id)) {
      await tx.itineraryItem.delete({ where: { id: cur.id } });
      await renumber(tx, cur.dayId);
    }
    if (day && (!cur || cur.dayId !== day.id)) await insertInOrder(tx, day, entry.item);
    else if (day && cur) await tx.itineraryItem.update({ where: { id: cur.id }, data: { title: entry.item.title, time: entry.item.time, location: entry.item.location ?? null } });
  }
}

// ---- Generation ---------------------------------------------------------------

/**
 * Build a sensible skeleton from what the agent already entered: arrival,
 * hotel check-ins/outs (with the hotel's real times), transfers and activities
 * on their dates, and a clear placeholder wherever information is missing.
 * Nothing critical (flight times, bookings) is invented.
 */
export async function generateItinerary(actor: Actor | null, tripId: string, opts: { templateId?: string | null } = {}) {
  guard(actor);
  const trip = await ownTrip(actor.agencyId, tripId);
  const template = opts.templateId
    ? await db.itineraryTemplate.findFirst({
        where: { id: opts.templateId, status: "ACTIVE", OR: [{ agencyId: null }, { agencyId: actor.agencyId }] },
        include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } } },
      })
    : null;
  if (opts.templateId && !template) throw notFound("Template");

  await db.$transaction(
    async (tx) => {
      const days = await ensureDays(tx, trip);
      await tx.itineraryItem.deleteMany({ where: { tripId } });
      const [destinations, stays, transports, activities] = await Promise.all([
        tx.tripDestination.findMany({ where: { tripId }, orderBy: { position: "asc" } }),
        tx.tripHotel.findMany({ where: { tripId }, include: { hotel: { select: { name: true, location: true, checkInTime: true, checkOutTime: true } } }, orderBy: { checkIn: "asc" } }),
        tx.tripTransport.findMany({ where: { tripId, addToItinerary: true } }),
        tx.tripActivity.findMany({ where: { tripId, addToItinerary: true } }),
      ]);

      const placeFor = (date: string) => {
        const stay = stays.find((s) => toISO(s.checkIn)! <= date && toISO(s.checkOut)! > date);
        if (stay) return stay.hotel.location.split(",")[0];
        // Fall back to the destination plan (nights per destination).
        let cursor = toISO(trip.startDate)!;
        for (const d of destinations) {
          const end = toDate(cursor).getTime() + (d.nights ?? 0) * 86_400_000;
          if (toDate(date).getTime() < end) return d.name;
          cursor = toISO(new Date(end))!;
        }
        return destinations.at(-1)?.name ?? null;
      };

      const last = days.length - 1;
      for (const [i, day] of days.entries()) {
        const date = toISO(day.date)!;
        const place = placeFor(date);
        const prevPlace = i > 0 ? placeFor(toISO(days[i - 1].date)!) : null;
        const tDay = template?.days.find((d) => d.dayNumber === i + 1);
        const title =
          tDay?.title ??
          (i === 0 ? `Arrival${place ? ` in ${place}` : ""}` : i === last ? "Departure" : place && prevPlace && place !== prevPlace ? `${prevPlace} → ${place}` : place ?? `Day ${i + 1}`);
        await tx.itineraryDay.update({ where: { id: day.id }, data: { title, summary: tDay?.summary ?? null } });

        const items: NewItem[] = [];
        // Real bookings replace the template's generic placeholders for the same day.
        const dayStays = stays.flatMap(stayItems).filter((e) => e.date === date);
        const dayTransports = transports.filter((t) => toISO(t.date) === date);
        if (template && tDay) {
          for (const it of tDay.items) {
            if (it.type === "HOTEL_CHECK_IN" && dayStays.some((e) => e.item.type === "HOTEL_CHECK_IN")) continue;
            if (it.type === "HOTEL_CHECK_OUT" && dayStays.some((e) => e.item.type === "HOTEL_CHECK_OUT")) continue;
            if (it.type === "TRANSPORT" && dayTransports.length) continue;
            items.push({ time: it.time, type: it.type, title: it.title, description: it.description, location: it.location, durationMins: it.durationMins, notes: it.notes, source: "TEMPLATE" });
          }
        }
        // Arrival/departure placeholders are only added when nothing covers them.
        const hasArrivalTransfer = transports.some((t) => toISO(t.date) === date && t.kind === "AIRPORT_TRANSFER");
        if (i === 0 && !items.some((x) => x.type === "AIRPORT_ARRIVAL")) {
          items.push({ time: null, type: "AIRPORT_ARRIVAL", title: `Arrival${place ? ` in ${place}` : ""}`, notes: hasArrivalTransfer ? null : "Add flight or train details", source: "GENERATED" });
        }
        if (i === last && last > 0 && !items.some((x) => x.type === "AIRPORT_DEPARTURE")) {
          items.push({ time: null, type: "AIRPORT_DEPARTURE", title: "Departure", notes: "Add flight or train details", source: "GENERATED" });
        }
        for (const s of stays) for (const e of stayItems(s)) if (e.date === date) items.push(e.item);
        for (const t of transports) if (toISO(t.date) === date) items.push(transportItem(t));
        for (const a of activities) if (toISO(a.date) === date) items.push(activityItem(a));

        // A change of base with no transfer booked gets an explicit reminder.
        if (!template && i > 0 && place && prevPlace && place !== prevPlace && !transports.some((t) => toISO(t.date) === date)) {
          items.push({ time: null, type: "NOTE", title: `Transfer ${prevPlace} → ${place}`, notes: "Transport not arranged yet", source: "GENERATED" });
        }
        if (!template && i > 0 && i < last && !items.some((x) => ["SIGHTSEEING", "ACTIVITY", "MEAL", "FREE_TIME", "TRANSPORT", "NOTE", "HOTEL_CHECK_IN"].includes(x.type))) {
          items.push({ time: null, type: "FREE_TIME", title: `At leisure${place ? ` in ${place}` : ""}`, notes: "Add sightseeing or activities", source: "GENERATED" });
        }

        // Untimed items keep their place: they sort just after the item before
        // them (template order), arrivals first and departures last.
        let prevKey = "00:00";
        const keyed = items.map((x, idx) => {
          const k = x.time ? timeKey(x.time) : x.type === "AIRPORT_ARRIVAL" ? "00:00" : x.type === "AIRPORT_DEPARTURE" ? "99:98" : x.source === "TEMPLATE" ? prevKey : "99:97";
          if (x.time) prevKey = k;
          return { x, k, idx };
        });
        keyed.sort((a, b) => a.k.localeCompare(b.k) || a.idx - b.idx);
        items.splice(0, items.length, ...keyed.map((e) => e.x));
        if (items.length) {
          await tx.itineraryItem.createMany({
            data: items.map((it, p) => ({
              tripId,
              agencyId: actor.agencyId,
              dayId: day.id,
              position: p,
              time: it.time,
              type: it.type,
              title: it.title,
              description: it.description ?? null,
              location: it.location ?? null,
              durationMins: it.durationMins ?? null,
              notes: it.notes ?? null,
              source: it.source,
              sourceId: it.sourceId ?? null,
            })),
          });
        }
      }
      await tx.trip.update({ where: { id: tripId }, data: { wizardStep: Math.max(trip.wizardStep, 8), ...(trip.status === "DRAFT" ? { status: "PLANNING" } : {}) } });
      await touch(tx, tripId);
      await audit(
        actor,
        { action: "itinerary.generated", entity: "Trip", entityId: tripId, summary: template ? `Itinerary built from template "${template.name}"` : "Itinerary skeleton generated from trip details" },
        tx,
      );
    },
    { timeout: 20_000 },
  );
}

// ---- Manual editing -----------------------------------------------------------

async function ownDay(agencyId: string, dayId: string) {
  const day = await db.itineraryDay.findFirst({ where: { id: dayId, agencyId } });
  if (!day) throw notFound("Day");
  return day;
}

async function ownItem(agencyId: string, itemId: string) {
  const item = await db.itineraryItem.findFirst({ where: { id: itemId, agencyId }, include: { day: { select: { dayNumber: true } } } });
  if (!item) throw notFound("Itinerary item");
  return item;
}

export async function createDays(actor: Actor | null, tripId: string) {
  guard(actor);
  const trip = await ownTrip(actor.agencyId, tripId);
  await db.$transaction(async (tx) => {
    await ensureDays(tx, trip);
    if (trip.status === "DRAFT") await tx.trip.update({ where: { id: tripId }, data: { status: "PLANNING" } });
  });
}

export async function addItem(actor: Actor | null, dayId: string, raw: unknown) {
  guard(actor);
  const input = itineraryItemSchema.parse(raw);
  const day = await ownDay(actor.agencyId, dayId);
  const item = await db.$transaction(async (tx) => {
    const created = await insertInOrder(tx, day, {
      time: nul(input.time),
      type: input.type,
      title: input.title,
      description: nul(input.description),
      location: nul(input.location),
      durationMins: input.durationMins,
      notes: nul(input.notes),
      source: "MANUAL",
    });
    await touch(tx, day.tripId);
    await audit(actor, { action: "itinerary.item_added", entity: "Trip", entityId: day.tripId, summary: `Day ${day.dayNumber}: added "${input.title}"`, after: { title: input.title, time: input.time } }, tx);
    return created;
  });
  return item;
}

export async function updateItem(actor: Actor | null, itemId: string, raw: unknown) {
  guard(actor);
  const input = itineraryItemSchema.parse(raw);
  const before = await ownItem(actor.agencyId, itemId);
  const data = {
    time: nul(input.time),
    type: input.type,
    title: input.title,
    description: nul(input.description),
    location: nul(input.location),
    durationMins: input.durationMins,
    notes: nul(input.notes),
  };
  await db.$transaction(async (tx) => {
    await tx.itineraryItem.update({ where: { id: itemId }, data });
    await touch(tx, before.tripId);
    await audit(
      actor,
      {
        action: "itinerary.item_updated",
        entity: "Trip",
        entityId: before.tripId,
        summary: `Day ${before.day.dayNumber}: updated "${input.title}"`,
        before: { title: before.title, time: before.time, type: before.type, location: before.location, description: before.description },
        after: { title: data.title, time: data.time, type: data.type, location: data.location, description: data.description },
      },
      tx,
    );
  });
}

export async function deleteItem(actor: Actor | null, itemId: string) {
  guard(actor);
  const item = await ownItem(actor.agencyId, itemId);
  await db.$transaction(async (tx) => {
    await tx.itineraryItem.delete({ where: { id: itemId } });
    await renumber(tx, item.dayId);
    await touch(tx, item.tripId);
    await audit(actor, { action: "itinerary.item_deleted", entity: "Trip", entityId: item.tripId, summary: `Day ${item.day.dayNumber}: removed "${item.title}"`, before: { title: item.title, time: item.time } }, tx);
  });
}

export async function duplicateItem(actor: Actor | null, itemId: string) {
  guard(actor);
  const item = await ownItem(actor.agencyId, itemId);
  return db.$transaction(async (tx) => {
    const copy = await insertInOrder(
      tx,
      { id: item.dayId, tripId: item.tripId, agencyId: item.agencyId },
      { time: item.time, type: item.type, title: item.title, description: item.description, location: item.location, durationMins: item.durationMins, notes: item.notes, source: "MANUAL" },
      item.position + 1,
    );
    await touch(tx, item.tripId);
    await audit(actor, { action: "itinerary.item_duplicated", entity: "Trip", entityId: item.tripId, summary: `Day ${item.day.dayNumber}: duplicated "${item.title}"` }, tx);
    return copy;
  });
}

/**
 * Persist a new order for one or two days (drag within a day, or across days).
 * `layout` maps dayId → ordered itemIds. Every id must belong to the trip.
 */
export async function reorderItems(actor: Actor | null, tripId: string, layout: Record<string, string[]>) {
  guard(actor);
  await ownTrip(actor.agencyId, tripId);
  const dayIds = Object.keys(layout);
  if (!dayIds.length || dayIds.length > 40) throw new AppError("VALIDATION_ERROR", "Nothing to reorder.");
  const days = await db.itineraryDay.findMany({ where: { id: { in: dayIds }, tripId, agencyId: actor.agencyId }, select: { id: true, dayNumber: true } });
  if (days.length !== dayIds.length) throw notFound("Day");
  const itemIds = dayIds.flatMap((d) => layout[d]);
  if (new Set(itemIds).size !== itemIds.length) throw new AppError("VALIDATION_ERROR", "Duplicate items in order.");
  const items = await db.itineraryItem.findMany({ where: { id: { in: itemIds }, tripId, agencyId: actor.agencyId }, select: { id: true, dayId: true } });
  if (items.length !== itemIds.length) throw notFound("Itinerary item");
  // The submitted days must contain exactly the items they hold today, plus moved ones.
  const current = await db.itineraryItem.count({ where: { dayId: { in: dayIds } } });
  if (current !== itemIds.length) throw new AppError("CONFLICT", "The itinerary changed in another window. Refresh and try again.");

  await db.$transaction(async (tx) => {
    for (const dayId of dayIds) {
      for (const [position, id] of layout[dayId].entries()) {
        await tx.itineraryItem.update({ where: { id }, data: { dayId, position } });
      }
    }
    await touch(tx, tripId);
    const moved = items.filter((i) => !layout[i.dayId]?.includes(i.id));
    await audit(
      actor,
      { action: "itinerary.reordered", entity: "Trip", entityId: tripId, summary: moved.length ? `Moved ${moved.length} item(s) between days` : `Reordered Day ${days.map((d) => d.dayNumber).join(", ")}` },
      tx,
    );
  });
}

export async function updateDay(actor: Actor | null, dayId: string, input: { title: string; summary: string }) {
  guard(actor);
  const day = await ownDay(actor.agencyId, dayId);
  const title = input.title.trim().slice(0, 120) || null;
  const summary = input.summary.trim().slice(0, 600) || null;
  await db.$transaction(async (tx) => {
    await tx.itineraryDay.update({ where: { id: dayId }, data: { title, summary } });
    await touch(tx, day.tripId);
    await audit(actor, { action: "itinerary.day_updated", entity: "Trip", entityId: day.tripId, summary: `Day ${day.dayNumber} renamed to "${title ?? `Day ${day.dayNumber}`}"`, before: { title: day.title }, after: { title } }, tx);
  });
}

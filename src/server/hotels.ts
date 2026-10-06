import "server-only";
import type { HotelCategory, MealPlan, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, diff } from "./audit";
import { AppError, notFound } from "./errors";
import { assertAgent, assertSuperAdmin, type Actor } from "./auth/session";
import { hotelSchema, nul, ratesSchema, roomSchema } from "@/lib/schemas";
import { randomToken } from "./auth/crypto";
import { storage } from "./storage";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "hotel";
}

export async function ensureDestination(name: string, tx: Prisma.TransactionClient | typeof db = db) {
  const clean = name.trim().replace(/\s+/g, " ");
  const existing = await tx.destination.findFirst({ where: { name: { equals: clean, mode: "insensitive" } } });
  return existing ?? tx.destination.create({ data: { name: clean } });
}

export async function listDestinations() {
  return db.destination.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, region: true } });
}

// ---- Admin catalog ---------------------------------------------------------

export async function listHotelsAdmin(actor: Actor | null, query: { q?: string; category?: HotelCategory | ""; destination?: string; status?: string } = {}) {
  assertSuperAdmin(actor);
  const q = query.q?.trim();
  return db.hotel.findMany({
    where: {
      ...(query.category ? { category: query.category } : {}),
      ...(query.destination ? { destinationId: query.destination } : {}),
      ...(query.status === "ACTIVE" || query.status === "INACTIVE" ? { status: query.status } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      destination: { select: { name: true } },
      rooms: { select: { id: true, baseRate: true, status: true }, orderBy: { baseRate: "asc" } },
      _count: { select: { agencies: true, tripHotels: true } },
    },
  });
}

export async function getHotelAdmin(actor: Actor | null, hotelId: string) {
  assertSuperAdmin(actor);
  const hotel = await db.hotel.findUnique({
    where: { id: hotelId },
    include: {
      destination: true,
      rooms: { orderBy: [{ sortOrder: "asc" }, { baseRate: "asc" }], include: { rates: { include: { agency: { select: { id: true, name: true } } } } } },
      agencies: { include: { agency: { select: { id: true, name: true, status: true } } }, orderBy: { createdAt: "asc" } },
      _count: { select: { tripHotels: true } },
    },
  });
  if (!hotel) throw notFound("Hotel");
  return hotel;
}

function hotelData(input: ReturnType<typeof hotelSchema.parse>) {
  return {
    name: input.name,
    category: input.category,
    description: nul(input.description),
    location: input.location,
    address: nul(input.address),
    latitude: input.latitude === "" ? null : Number(input.latitude),
    longitude: input.longitude === "" ? null : Number(input.longitude),
    phone: nul(input.phone),
    email: nul(input.email),
    website: nul(input.website),
    amenities: [...new Set(input.amenities)],
    checkInTime: input.checkInTime,
    checkOutTime: input.checkOutTime,
    cancellationPolicy: nul(input.cancellationPolicy),
    notes: nul(input.notes),
    status: input.status,
  };
}

export async function createHotel(actor: Actor | null, raw: unknown) {
  assertSuperAdmin(actor);
  const input = hotelSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const dest = await ensureDestination(input.destination, tx);
    let slug = slugify(input.name);
    if (await tx.hotel.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-${randomToken(3).toLowerCase()}`;
    const hotel = await tx.hotel.create({ data: { ...hotelData(input), slug, destinationId: dest.id } });
    await audit(actor, { action: "hotel.created", entity: "Hotel", entityId: hotel.id, agencyId: null, summary: `Created hotel ${hotel.name}`, after: { name: hotel.name, category: hotel.category, destination: dest.name } }, tx);
    return hotel;
  });
}

export async function updateHotel(actor: Actor | null, hotelId: string, raw: unknown) {
  assertSuperAdmin(actor);
  const input = hotelSchema.parse(raw);
  const before = await db.hotel.findUnique({ where: { id: hotelId } });
  if (!before) throw notFound("Hotel");
  await db.$transaction(async (tx) => {
    const dest = await ensureDestination(input.destination, tx);
    const data = { ...hotelData(input), destinationId: dest.id };
    const d = diff(before as unknown as Record<string, unknown>, data);
    await tx.hotel.update({ where: { id: hotelId }, data });
    if (d.changed) await audit(actor, { action: "hotel.updated", entity: "Hotel", entityId: hotelId, agencyId: null, summary: `Updated ${input.name}`, before: d.before, after: d.after }, tx);
  });
}

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function addHotelImage(actor: Actor | null, hotelId: string, file: File) {
  assertSuperAdmin(actor);
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new AppError("INVALID_FILE", "Use a JPG, PNG or WebP image.");
  if (file.size > 4 * 1024 * 1024) throw new AppError("INVALID_FILE", "Images must be 4 MB or smaller.");
  const hotel = await db.hotel.findUnique({ where: { id: hotelId }, select: { images: true, name: true } });
  if (!hotel) throw notFound("Hotel");
  if (hotel.images.length >= 12) throw new AppError("VALIDATION_ERROR", "A hotel can have up to 12 images.");
  const key = `hotels/${hotelId}/${randomToken(12)}.${ext}`;
  await storage().put(key, Buffer.from(await file.arrayBuffer()), file.type);
  await db.hotel.update({ where: { id: hotelId }, data: { images: { push: key } } });
  await audit(actor, { action: "hotel.image_added", entity: "Hotel", entityId: hotelId, agencyId: null, summary: `Added an image to ${hotel.name}` });
  return key;
}

export async function removeHotelImage(actor: Actor | null, hotelId: string, key: string) {
  assertSuperAdmin(actor);
  const hotel = await db.hotel.findUnique({ where: { id: hotelId }, select: { images: true } });
  if (!hotel || !hotel.images.includes(key)) throw notFound("Image");
  await db.hotel.update({ where: { id: hotelId }, data: { images: hotel.images.filter((k) => k !== key) } });
  await storage().delete(key).catch(() => {});
}

export async function upsertRoom(actor: Actor | null, hotelId: string, roomId: string | null, raw: unknown) {
  assertSuperAdmin(actor);
  const input = roomSchema.parse(raw);
  const hotel = await db.hotel.findUnique({ where: { id: hotelId }, select: { id: true, name: true } });
  if (!hotel) throw notFound("Hotel");
  const data = {
    name: input.name,
    description: nul(input.description),
    capacity: input.capacity,
    bedConfig: nul(input.bedConfig),
    inventory: input.inventory,
    baseRate: input.baseRate,
    mealPlans: input.mealPlans as MealPlan[],
    amenities: [...new Set(input.amenities)],
    status: input.status,
  };
  if (roomId) {
    const before = await db.hotelRoom.findFirst({ where: { id: roomId, hotelId } });
    if (!before) throw notFound("Room");
    const d = diff(before as unknown as Record<string, unknown>, data);
    await db.hotelRoom.update({ where: { id: roomId }, data });
    if (d.changed) await audit(actor, { action: "room.updated", entity: "HotelRoom", entityId: roomId, agencyId: null, summary: `Updated ${hotel.name} · ${input.name}`, before: d.before, after: d.after });
    return roomId;
  }
  const count = await db.hotelRoom.count({ where: { hotelId } });
  const room = await db.hotelRoom.create({ data: { ...data, hotelId, sortOrder: count } });
  await audit(actor, { action: "room.created", entity: "HotelRoom", entityId: room.id, agencyId: null, summary: `Added ${input.name} to ${hotel.name}`, after: { baseRate: input.baseRate } });
  return room.id;
}

export async function deleteRoom(actor: Actor | null, hotelId: string, roomId: string) {
  assertSuperAdmin(actor);
  const room = await db.hotelRoom.findFirst({ where: { id: roomId, hotelId }, include: { _count: { select: { tripRooms: true } } } });
  if (!room) throw notFound("Room");
  if (room._count.tripRooms > 0) {
    // Booked rooms are kept for history; deactivate instead.
    await db.hotelRoom.update({ where: { id: roomId }, data: { status: "INACTIVE" } });
    await audit(actor, { action: "room.deactivated", entity: "HotelRoom", entityId: roomId, agencyId: null, summary: `Deactivated ${room.name} (used by trips)` });
    return "deactivated" as const;
  }
  await db.hotelRoom.delete({ where: { id: roomId } });
  await audit(actor, { action: "room.deleted", entity: "HotelRoom", entityId: roomId, agencyId: null, summary: `Deleted ${room.name}` });
  return "deleted" as const;
}

/** Set (or clear, with rate=null) agency-specific nightly rates for one room. */
export async function setRoomRates(actor: Actor | null, raw: unknown) {
  assertSuperAdmin(actor);
  const input = ratesSchema.parse(raw);
  const room = await db.hotelRoom.findUnique({ where: { id: input.roomId }, include: { hotel: { select: { name: true } }, rates: true } });
  if (!room) throw notFound("Room");
  await db.$transaction(async (tx) => {
    for (const r of input.rates) {
      const prev = room.rates.find((x) => x.agencyId === r.agencyId);
      if (r.rate === null) {
        if (prev) await tx.hotelRate.delete({ where: { id: prev.id } });
      } else if (!prev || prev.rate !== r.rate) {
        await tx.hotelRate.upsert({ where: { roomId_agencyId: { roomId: room.id, agencyId: r.agencyId } }, create: { roomId: room.id, agencyId: r.agencyId, rate: r.rate }, update: { rate: r.rate } });
      } else continue;
      await audit(
        actor,
        { action: "rate.updated", entity: "HotelRoom", entityId: room.id, agencyId: r.agencyId, summary: `${room.hotel.name} · ${room.name}: agency rate ${r.rate === null ? "cleared" : `set to ₹${r.rate}`}`, before: { rate: prev?.rate ?? null }, after: { rate: r.rate } },
        tx,
      );
    }
  });
}

// ---- Agency ↔ hotel assignment ----------------------------------------------

export async function getAssignments(actor: Actor | null, agencyId: string) {
  assertSuperAdmin(actor);
  const [agency, hotels, links] = await Promise.all([
    db.agency.findUnique({ where: { id: agencyId }, select: { id: true, name: true } }),
    db.hotel.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, category: true, location: true, status: true, images: true, destination: { select: { name: true } }, _count: { select: { rooms: true } } } }),
    db.agentHotel.findMany({ where: { agencyId }, select: { hotelId: true } }),
  ]);
  if (!agency) throw notFound("Agency");
  return { agency, hotels, assigned: links.map((l) => l.hotelId) };
}

export async function setAssignments(actor: Actor | null, agencyId: string, hotelIds: string[]) {
  assertSuperAdmin(actor);
  const agency = await db.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
  if (!agency) throw notFound("Agency");
  const valid = new Set((await db.hotel.findMany({ where: { id: { in: hotelIds } }, select: { id: true } })).map((h) => h.id));
  const wanted = [...new Set(hotelIds)].filter((id) => valid.has(id));
  const current = (await db.agentHotel.findMany({ where: { agencyId }, select: { hotelId: true } })).map((l) => l.hotelId);
  const add = wanted.filter((id) => !current.includes(id));
  const remove = current.filter((id) => !wanted.includes(id));
  if (!add.length && !remove.length) return { added: 0, removed: 0 };
  await db.$transaction(async (tx) => {
    if (remove.length) await tx.agentHotel.deleteMany({ where: { agencyId, hotelId: { in: remove } } });
    if (add.length) await tx.agentHotel.createMany({ data: add.map((hotelId) => ({ agencyId, hotelId, assignedById: actor.userId })), skipDuplicates: true });
    await audit(actor, { action: "agency.hotels_assigned", entity: "Agency", entityId: agencyId, agencyId, summary: `Hotel access for ${agency.name}: +${add.length} / −${remove.length}`, before: { hotelIds: current }, after: { hotelIds: wanted } }, tx);
  });
  return { added: add.length, removed: remove.length };
}

/** Assign or unassign one hotel across many agencies (from the hotel page). */
export async function setHotelAgencies(actor: Actor | null, hotelId: string, agencyIds: string[]) {
  assertSuperAdmin(actor);
  const hotel = await db.hotel.findUnique({ where: { id: hotelId }, select: { name: true } });
  if (!hotel) throw notFound("Hotel");
  const current = (await db.agentHotel.findMany({ where: { hotelId }, select: { agencyId: true } })).map((l) => l.agencyId);
  const valid = new Set((await db.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true } })).map((a) => a.id));
  const wanted = [...new Set(agencyIds)].filter((id) => valid.has(id));
  const add = wanted.filter((id) => !current.includes(id));
  const remove = current.filter((id) => !wanted.includes(id));
  await db.$transaction(async (tx) => {
    if (remove.length) await tx.agentHotel.deleteMany({ where: { hotelId, agencyId: { in: remove } } });
    if (add.length) await tx.agentHotel.createMany({ data: add.map((agencyId) => ({ agencyId, hotelId, assignedById: actor.userId })), skipDuplicates: true });
    for (const agencyId of [...add, ...remove]) {
      await audit(actor, { action: add.includes(agencyId) ? "agency.hotel_assigned" : "agency.hotel_unassigned", entity: "Hotel", entityId: hotelId, agencyId, summary: `${add.includes(agencyId) ? "Assigned" : "Removed"} ${hotel.name}` }, tx);
    }
  });
}

// ---- Agent-facing ----------------------------------------------------------
//
// Agents only see hotels assigned to their agency, and only their own
// effective nightly rate. baseRate and other agencies' rates are never
// selected into these payloads.

export type AgentRoom = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  bedConfig: string | null;
  mealPlans: MealPlan[];
  amenities: string[];
  rate: number;
};

export type AgentHotel = {
  id: string;
  name: string;
  category: HotelCategory;
  description: string | null;
  location: string;
  address: string | null;
  destination: string | null;
  destinationId: string | null;
  amenities: string[];
  images: string[];
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: string | null;
  phone: string | null;
  rooms: AgentRoom[];
  fromRate: number | null;
};

export async function listAgentHotels(actor: Actor | null, opts: { hotelId?: string; includeInactive?: boolean } = {}): Promise<AgentHotel[]> {
  assertAgent(actor);
  const hotels = await db.hotel.findMany({
    where: {
      agencies: { some: { agencyId: actor.agencyId } },
      ...(opts.includeInactive ? {} : { status: "ACTIVE" }),
      ...(opts.hotelId ? { id: opts.hotelId } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      location: true,
      address: true,
      amenities: true,
      images: true,
      checkInTime: true,
      checkOutTime: true,
      cancellationPolicy: true,
      phone: true,
      destinationId: true,
      destination: { select: { name: true } },
      rooms: {
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          capacity: true,
          bedConfig: true,
          mealPlans: true,
          amenities: true,
          baseRate: true,
          rates: { where: { agencyId: actor.agencyId }, select: { rate: true } },
        },
      },
    },
  });
  return hotels.map(({ destination, rooms, ...h }) => {
    const mapped: AgentRoom[] = rooms.map(({ baseRate, rates, ...r }) => ({ ...r, rate: rates[0]?.rate ?? baseRate }));
    return {
      ...h,
      destination: destination?.name ?? null,
      rooms: mapped,
      fromRate: mapped.length ? Math.min(...mapped.map((r) => r.rate)) : null,
    };
  });
}

export async function getAgentHotel(actor: Actor | null, hotelId: string) {
  const [hotel] = await listAgentHotels(actor, { hotelId, includeInactive: true });
  if (!hotel) throw notFound("Hotel");
  return hotel;
}

/** The nightly rate an agency pays for a room, or a FORBIDDEN error if the hotel isn't assigned. */
export async function effectiveRate(agencyId: string, roomId: string, tx: Prisma.TransactionClient | typeof db = db) {
  const room = await tx.hotelRoom.findFirst({
    where: { id: roomId, hotel: { agencies: { some: { agencyId } } } },
    select: { id: true, name: true, hotelId: true, baseRate: true, status: true, mealPlans: true, rates: { where: { agencyId }, select: { rate: true } } },
  });
  if (!room) throw new AppError("FORBIDDEN", "That room isn't available to your agency.");
  return { roomId: room.id, name: room.name, hotelId: room.hotelId, rate: room.rates[0]?.rate ?? room.baseRate, mealPlans: room.mealPlans, status: room.status };
}

export async function hotelActivity(actor: Actor | null, hotelId: string, take = 50) {
  assertSuperAdmin(actor);
  const rooms = await db.hotelRoom.findMany({ where: { hotelId }, select: { id: true } });
  return db.auditLog.findMany({ where: { entityId: { in: [hotelId, ...rooms.map((r) => r.id)] } }, orderBy: { createdAt: "desc" }, take, include: { agency: { select: { name: true } } } });
}

import "server-only";
import type { Gender, IdType, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, diff } from "./audit";
import { AppError, notFound } from "./errors";
import { assertAgent, type Actor } from "./auth/session";
import { guestSchema, nul } from "@/lib/schemas";
import { ID_TYPES } from "@/lib/labels";
import { toDate, todayISO } from "@/lib/dates";
import { randomToken } from "./auth/crypto";
import { storage } from "./storage";

const PAGE_SIZE = 15;

/** Fetch a guest only if it belongs to the actor's agency. */
export async function ownGuest(agencyId: string, guestId: string) {
  const g = await db.guest.findFirst({ where: { id: guestId, agencyId } });
  if (!g) throw notFound("Guest");
  return g;
}

function guestData(input: ReturnType<typeof guestSchema.parse>) {
  return {
    fullName: input.fullName,
    phone: nul(input.phone),
    email: nul(input.email)?.toLowerCase() ?? null,
    whatsapp: nul(input.whatsapp),
    nationality: nul(input.nationality),
    dateOfBirth: input.dateOfBirth ? toDate(input.dateOfBirth) : null,
    gender: (input.gender || null) as Gender | null,
    address: nul(input.address),
    idType: (input.idType || null) as IdType | null,
    idNumber: nul(input.idNumber),
    notes: nul(input.notes),
  };
}

export type GuestListQuery = { q?: string; filter?: "all" | "upcoming" | "past" | "none"; sort?: "name" | "created" | "trips"; page?: number };

export async function listGuests(actor: Actor | null, query: GuestListQuery = {}) {
  assertAgent(actor);
  const page = Math.max(1, query.page ?? 1);
  const q = query.q?.trim();
  const today = toDate(todayISO());
  const where: Prisma.GuestWhereInput = {
    agencyId: actor.agencyId,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.filter === "upcoming" ? { trips: { some: { trip: { startDate: { gte: today }, status: { notIn: ["CANCELLED"] } } } } } : {}),
    ...(query.filter === "past" ? { trips: { some: { trip: { endDate: { lt: today } } } } } : {}),
    ...(query.filter === "none" ? { trips: { none: {} } } : {}),
  };
  const orderBy: Prisma.GuestOrderByWithRelationInput =
    query.sort === "name" ? { fullName: "asc" } : query.sort === "trips" ? { trips: { _count: "desc" } } : { createdAt: "desc" };
  const [total, rows] = await Promise.all([
    db.guest.count({ where }),
    db.guest.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: { select: { trips: true } },
        trips: {
          where: { trip: { status: { not: "CANCELLED" } } },
          select: { trip: { select: { id: true, code: true, startDate: true, endDate: true, status: true } } },
        },
      },
    }),
  ]);
  const shaped = rows.map((g) => {
    const trips = g.trips.map((t) => t.trip).filter((t) => t.startDate);
    const upcoming = trips.filter((t) => t.startDate! >= today).sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())[0] ?? null;
    const last = trips.filter((t) => t.startDate! < today).sort((a, b) => b.startDate!.getTime() - a.startDate!.getTime())[0] ?? null;
    return { id: g.id, fullName: g.fullName, phone: g.phone, email: g.email, createdAt: g.createdAt, tripCount: g._count.trips, upcoming, last };
  });
  return { rows: shaped, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Lightweight lookup for pickers (trip wizard). */
export async function searchGuests(actor: Actor | null, q: string, take = 8) {
  assertAgent(actor);
  const term = q.trim();
  return db.guest.findMany({
    where: {
      agencyId: actor.agencyId,
      ...(term ? { OR: [{ fullName: { contains: term, mode: "insensitive" } }, { phone: { contains: term } }, { email: { contains: term, mode: "insensitive" } }] } : {}),
    },
    orderBy: term ? { fullName: "asc" } : { updatedAt: "desc" },
    take,
    select: { id: true, fullName: true, phone: true, email: true, _count: { select: { trips: true } } },
  });
}

export async function createGuest(actor: Actor | null, raw: unknown) {
  assertAgent(actor);
  const input = guestSchema.parse(raw);
  const data = guestData(input);
  // Soft duplicate guard: same name + same phone/email in this agency.
  if (data.phone || data.email) {
    const dupe = await db.guest.findFirst({
      where: {
        agencyId: actor.agencyId,
        fullName: { equals: data.fullName, mode: "insensitive" },
        OR: [...(data.phone ? [{ phone: data.phone }] : []), ...(data.email ? [{ email: data.email }] : [])],
      },
      select: { id: true },
    });
    if (dupe) throw new AppError("CONFLICT", `${data.fullName} already exists with the same contact details.`);
  }
  const guest = await db.guest.create({ data: { ...data, agencyId: actor.agencyId } });
  await audit(actor, { action: "guest.created", entity: "Guest", entityId: guest.id, summary: `Added guest ${guest.fullName}` });
  return guest;
}

export async function updateGuest(actor: Actor | null, guestId: string, raw: unknown) {
  assertAgent(actor);
  const before = await ownGuest(actor.agencyId, guestId);
  const data = guestData(guestSchema.parse(raw));
  const d = diff(before as unknown as Record<string, unknown>, data);
  await db.guest.update({ where: { id: guestId }, data });
  // ID numbers are sensitive: record that they changed, not their values.
  const scrub = (o: Record<string, unknown>) => ("idNumber" in o ? { ...o, idNumber: "•••" } : o);
  if (d.changed)
    await audit(actor, {
      action: "guest.updated",
      entity: "Guest",
      entityId: guestId,
      summary: `Updated guest ${data.fullName}`,
      before: scrub(d.before as Record<string, unknown>) as Prisma.InputJsonValue,
      after: scrub(d.after as Record<string, unknown>) as Prisma.InputJsonValue,
    });
}

export async function deleteGuest(actor: Actor | null, guestId: string) {
  assertAgent(actor);
  const g = await db.guest.findFirst({ where: { id: guestId, agencyId: actor.agencyId }, include: { _count: { select: { trips: true } }, documents: { select: { storageKey: true } } } });
  if (!g) throw notFound("Guest");
  if (g._count.trips > 0) throw new AppError("CONFLICT", "This guest is on one or more trips. Remove them from those trips first.");
  await db.guest.delete({ where: { id: guestId } });
  await Promise.all(g.documents.map((d) => storage().delete(d.storageKey).catch(() => {})));
  await audit(actor, { action: "guest.deleted", entity: "Guest", entityId: guestId, summary: `Deleted guest ${g.fullName}` });
}

export async function getGuestProfile(actor: Actor | null, guestId: string) {
  assertAgent(actor);
  const guest = await db.guest.findFirst({
    where: { id: guestId, agencyId: actor.agencyId },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      trips: {
        orderBy: { trip: { startDate: "desc" } },
        include: {
          trip: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              startDate: true,
              endDate: true,
              priceOverride: true,
              destinations: { orderBy: { position: "asc" }, select: { name: true } },
              payments: { where: { voidedAt: null }, select: { id: true, amount: true, paidAt: true, method: true, reference: true } },
            },
          },
        },
      },
    },
  });
  if (!guest) throw notFound("Guest");
  return guest;
}

// ---- Private documents ------------------------------------------------------

const DOC_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_DOC_BYTES = 8 * 1024 * 1024;

/** Content type from magic bytes — the browser's declared type is not trusted. */
function sniff(b: Buffer) {
  if (b.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function uploadGuestDocument(actor: Actor | null, guestId: string, file: File, kindRaw: string, label: string) {
  assertAgent(actor);
  const guest = await ownGuest(actor.agencyId, guestId);
  const kind = (ID_TYPES as readonly string[]).includes(kindRaw) ? (kindRaw as IdType) : "OTHER";
  if (!file || file.size === 0) throw new AppError("INVALID_FILE", "Choose a file to upload.");
  if (file.size > MAX_DOC_BYTES) throw new AppError("INVALID_FILE", "Files must be 8 MB or smaller.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || !DOC_TYPES[type]) throw new AppError("INVALID_FILE", "Upload a PDF, JPG, PNG or WebP file.");
  const count = await db.guestDocument.count({ where: { guestId } });
  if (count >= 20) throw new AppError("VALIDATION_ERROR", "A guest can have up to 20 documents.");
  const key = `agencies/${actor.agencyId}/guests/${guest.id}/${randomToken(16)}.${DOC_TYPES[type]}`;
  await storage().put(key, bytes, type);
  const doc = await db.guestDocument.create({
    data: {
      agencyId: actor.agencyId,
      guestId,
      kind,
      label: nul(label)?.slice(0, 80) ?? null,
      fileName: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || `document.${DOC_TYPES[type]}`,
      storageKey: key,
      contentType: type,
      sizeBytes: file.size,
      uploadedById: actor.userId,
    },
  });
  await audit(actor, { action: "guest.document_uploaded", entity: "Guest", entityId: guestId, summary: `Uploaded ${doc.fileName} for ${guest.fullName}` });
  return doc;
}

export async function deleteGuestDocument(actor: Actor | null, docId: string) {
  assertAgent(actor);
  const doc = await db.guestDocument.findFirst({ where: { id: docId, agencyId: actor.agencyId } });
  if (!doc) throw notFound("Document");
  await db.guestDocument.delete({ where: { id: doc.id } });
  await storage().delete(doc.storageKey).catch(() => {});
  await audit(actor, { action: "guest.document_deleted", entity: "Guest", entityId: doc.guestId, summary: `Deleted ${doc.fileName}` });
}

/** Authorised read of a private guest document; every access is audited. */
export async function readGuestDocument(actor: Actor | null, docId: string) {
  assertAgent(actor);
  const doc = await db.guestDocument.findFirst({ where: { id: docId, agencyId: actor.agencyId } });
  if (!doc) throw notFound("Document");
  const file = await storage().get(doc.storageKey);
  if (!file) throw notFound("File");
  await audit(actor, { action: "guest.document_viewed", entity: "Guest", entityId: doc.guestId, summary: `Viewed ${doc.fileName}` });
  return { ...file, contentType: doc.contentType, fileName: doc.fileName };
}

import "server-only";
import type { DocumentKind, Prisma } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { assertAgent, type Actor } from "../auth/session";
import { randomToken } from "../auth/crypto";
import { storage } from "../storage";
import { sendEmail } from "../email";
import { templates } from "../email/templates";
import { enforceRateLimit } from "../rate-limit";
import { DOCUMENT_KIND_LABEL, DOCUMENT_KINDS, type DocumentKindValue } from "@/lib/labels";
import { invoiceAmounts } from "@/lib/pricing";
import { computeTrip, tripFullInclude } from "../trips/queries";
import { tripTitle } from "../trips/core";
import { guestTripUrl } from "../trips/publish";
import { renderTripPdf, type RenderRequest } from "./pdf";

/**
 * Generate a PDF from the trip's current data, store it privately and record
 * it. Hotel vouchers are generated per stay (subjectId = TripHotel id);
 * receipts per payment (subjectId = Payment id, defaults to the latest).
 */
export async function generateDocument(actor: Actor | null, tripId: string, kindRaw: string, subjectId?: string | null) {
  assertAgent(actor);
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kindRaw)) throw new AppError("VALIDATION_ERROR", "Unknown document type.");
  const kind = kindRaw as DocumentKindValue;
  await enforceRateLimit(`docs:${actor.agencyId}`, 120, 60 * 60);
  const trip = await db.trip.findFirst({ where: { id: tripId, agencyId: actor.agencyId }, include: tripFullInclude });
  if (!trip) throw notFound("Trip");
  if (!trip.primaryGuest || !trip.startDate || !trip.endDate) throw new AppError("VALIDATION_ERROR", "Add the guest and travel dates before generating documents.");
  const money = computeTrip(trip);
  const moneyCtx = { lines: money.lines, total: money.total, overridden: money.overridden, paid: money.payment.paid, pending: money.payment.pending };
  const title = tripTitle(trip);

  let req: RenderRequest;
  let docTitle: string = DOCUMENT_KIND_LABEL[kind];
  let number: string | null = null;
  let subject: string | null = null;
  let invoice: Prisma.InvoiceUncheckedCreateInput | null = null;

  switch (kind) {
    case "HOTEL_VOUCHER": {
      const stay = trip.hotels.find((h) => h.id === subjectId) ?? (subjectId ? null : trip.hotels[0]);
      if (!stay) throw new AppError("VALIDATION_ERROR", subjectId ? "That hotel isn't on this trip." : "Add a hotel before generating a voucher.");
      req = { kind, stayId: stay.id };
      docTitle = `Hotel voucher — ${stay.hotel.name}`;
      subject = stay.id;
      break;
    }
    case "TRANSPORT_VOUCHER":
      if (!trip.transports.length) throw new AppError("VALIDATION_ERROR", "Add transport before generating a voucher.");
      req = { kind };
      break;
    case "PAYMENT_RECEIPT": {
      const live = trip.payments.filter((p) => !p.voidedAt);
      const p = subjectId ? live.find((x) => x.id === subjectId) : live[0];
      if (!p) throw new AppError("VALIDATION_ERROR", "Record a payment before generating a receipt.");
      req = { kind, paymentId: p.id };
      docTitle = `Payment receipt — ₹${p.amount.toLocaleString("en-IN")}`;
      subject = p.id;
      break;
    }
    case "INVOICE": {
      if (money.total <= 0) throw new AppError("VALIDATION_ERROR", "This trip has no priced items yet. Add rooms, transfers or a package price first.");
      const { invoiceSeq } = await db.agency.update({ where: { id: actor.agencyId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true } });
      number = `INV-${new Date().getFullYear()}-${String(invoiceSeq).padStart(4, "0")}`;
      const amounts = invoiceAmounts(money.total);
      const issuedAt = new Date();
      req = { kind, number, tax: amounts.tax, subtotal: amounts.subtotal, issuedAt };
      docTitle = `Invoice ${number}`;
      invoice = {
        agencyId: actor.agencyId,
        tripId,
        number,
        issuedAt,
        subtotal: amounts.subtotal,
        tax: amounts.tax,
        total: amounts.total,
        lines: money.lines as unknown as Prisma.InputJsonValue,
      };
      break;
    }
    default:
      req = { kind } as RenderRequest;
  }

  const bytes = await renderTripPdf({ trip, title, docTitle, number }, moneyCtx, req);
  const key = `agencies/${actor.agencyId}/trips/${tripId}/${kind.toLowerCase()}-${randomToken(10)}.pdf`;
  await storage().put(key, bytes, "application/pdf");
  const doc = await db.$transaction(async (tx) => {
    if (invoice) await tx.invoice.create({ data: invoice });
    const d = await tx.document.create({
      data: {
        agencyId: actor.agencyId,
        tripId,
        kind: kind as DocumentKind,
        title: docTitle,
        number,
        storageKey: key,
        sizeBytes: bytes.length,
        // Guest summaries contain other travellers' details: internal only.
        visibleToGuest: kind !== "GUEST_SUMMARY",
        subjectId: subject,
        generatedById: actor.userId,
      },
    });
    await audit(actor, { action: "document.generated", entity: "Trip", entityId: tripId, summary: `Generated ${docTitle}` }, tx);
    return d;
  });
  return doc;
}

export async function ownDocument(agencyId: string, docId: string) {
  const doc = await db.document.findFirst({ where: { id: docId, agencyId } });
  if (!doc) throw notFound("Document");
  return doc;
}

export async function readDocument(actor: Actor | null, docId: string) {
  assertAgent(actor);
  const doc = await ownDocument(actor.agencyId, docId);
  const file = await storage().get(doc.storageKey);
  if (!file) throw notFound("File");
  return { doc, bytes: file.bytes };
}

/** Guest access through the share token: only published trips, only guest-visible docs. */
export async function readDocumentForGuest(token: string, docId: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const doc = await db.document.findFirst({
    where: { id: docId, visibleToGuest: true, trip: { shareToken: token, shareEnabled: true, publishedVersion: { not: null }, status: { not: "CANCELLED" } } },
  });
  if (!doc) return null;
  const file = await storage().get(doc.storageKey);
  return file ? { doc, bytes: file.bytes } : null;
}

export async function deleteDocument(actor: Actor | null, docId: string) {
  assertAgent(actor);
  const doc = await ownDocument(actor.agencyId, docId);
  await db.document.delete({ where: { id: docId } });
  await storage().delete(doc.storageKey).catch(() => {});
  await audit(actor, { action: "document.deleted", entity: "Trip", entityId: doc.tripId, summary: `Deleted ${doc.title}` });
}

export async function setDocumentVisibility(actor: Actor | null, docId: string, visible: boolean) {
  assertAgent(actor);
  const doc = await ownDocument(actor.agencyId, docId);
  if (doc.kind === "GUEST_SUMMARY" && visible) throw new AppError("VALIDATION_ERROR", "Guest summaries include every traveller's details and stay internal.");
  await db.document.update({ where: { id: docId }, data: { visibleToGuest: visible } });
  await audit(actor, { action: "document.visibility_changed", entity: "Trip", entityId: doc.tripId, summary: `${doc.title} ${visible ? "shared with" : "hidden from"} guest` });
}

/** Email the guest that a document is ready on their trip page. */
export async function sendDocument(actor: Actor | null, docId: string) {
  assertAgent(actor);
  const doc = await ownDocument(actor.agencyId, docId);
  const trip = await db.trip.findUniqueOrThrow({ where: { id: doc.tripId }, include: { primaryGuest: true, agency: true } });
  if (!doc.visibleToGuest) throw new AppError("VALIDATION_ERROR", "Share this document with the guest first.");
  if (!trip.shareToken || !trip.shareEnabled || !trip.publishedVersion) throw new AppError("CONFLICT", "Send the trip to the guest first, so they have a trip page to open.");
  if (!trip.primaryGuest?.email) throw new AppError("VALIDATION_ERROR", "The primary guest has no email address.");
  const res = await sendEmail(
    "documentAvailable",
    trip.primaryGuest.email,
    templates.documentAvailable({ agencyName: trip.agency.name, supportEmail: trip.agency.supportEmail, supportPhone: trip.agency.supportPhone, guestName: trip.primaryGuest.fullName, documentTitle: doc.title, url: guestTripUrl(trip.shareToken) }),
    { agencyId: actor.agencyId, tripId: trip.id },
  );
  if (!res.ok) throw new AppError("EMAIL_FAILED", res.error ?? "The email could not be sent.");
  await db.document.update({ where: { id: docId }, data: { sentAt: new Date() } });
  await audit(actor, { action: "email.sent", entity: "Trip", entityId: trip.id, summary: `Emailed ${doc.title} to ${trip.primaryGuest.email}` });
  return res.status;
}

export async function listAgencyDocuments(actor: Actor | null, query: { q?: string; kind?: string; page?: number } = {}) {
  assertAgent(actor);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = 20;
  const q = query.q?.trim();
  const where: Prisma.DocumentWhereInput = {
    agencyId: actor.agencyId,
    ...((DOCUMENT_KINDS as readonly string[]).includes(query.kind ?? "") ? { kind: query.kind as DocumentKind } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { trip: { code: { contains: q, mode: "insensitive" } } }, { trip: { primaryGuest: { fullName: { contains: q, mode: "insensitive" } } } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { trip: { select: { id: true, code: true, primaryGuest: { select: { fullName: true } } } } },
    }),
  ]);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

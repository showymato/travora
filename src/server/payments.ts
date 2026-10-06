import "server-only";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { AppError, notFound } from "./errors";
import { assertAgent, type Actor } from "./auth/session";
import { nul, paymentSchema } from "@/lib/schemas";
import { formatINR, paymentSummary } from "@/lib/money";
import { toDate, todayISO } from "@/lib/dates";
import { sendEmail } from "./email";
import { templates } from "./email/templates";
import { computeTrip, tripFullInclude } from "./trips/queries";
import { tripTitle } from "./trips/core";
import { guestTripUrl } from "./trips/publish";

export async function recordPayment(actor: Actor | null, tripId: string, raw: unknown) {
  assertAgent(actor);
  const input = paymentSchema.parse(raw);
  if (input.paidAt > todayISO()) throw new AppError("VALIDATION_ERROR", "Payment date can't be in the future.", { fieldErrors: { paidAt: "In the future." } });
  const trip = await db.trip.findFirst({ where: { id: tripId, agencyId: actor.agencyId }, include: tripFullInclude });
  if (!trip) throw notFound("Trip");
  if (trip.status === "CANCELLED") throw new AppError("CONFLICT", "This trip is cancelled.");

  const payment = await db.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        agencyId: actor.agencyId,
        tripId,
        amount: input.amount,
        paidAt: toDate(input.paidAt),
        method: input.method as PaymentMethod,
        reference: nul(input.reference),
        notes: nul(input.notes),
        provider: "MANUAL",
        recordedById: actor.userId,
      },
    });
    await audit(actor, { action: "payment.recorded", entity: "Trip", entityId: tripId, summary: `Recorded ${formatINR(input.amount)} via ${input.method.replace("_", " ").toLowerCase()}`, after: { paymentId: p.id, amount: input.amount, method: input.method, reference: nul(input.reference) } }, tx);
    return p;
  });

  const { total } = computeTrip(trip);
  const summary = paymentSummary(total, [...trip.payments, payment]);
  let emailStatus = "SKIPPED";
  if (input.notifyGuest && trip.primaryGuest?.email) {
    const res = await sendEmail(
      "paymentRecorded",
      trip.primaryGuest.email,
      templates.paymentRecorded({
        agencyName: trip.agency.name,
        supportEmail: trip.agency.supportEmail,
        supportPhone: trip.agency.supportPhone,
        guestName: trip.primaryGuest.fullName,
        amount: formatINR(input.amount),
        tripTitle: tripTitle(trip),
        paid: formatINR(summary.paid),
        pending: formatINR(summary.pending),
        url: trip.shareToken && trip.shareEnabled ? guestTripUrl(trip.shareToken) : null,
      }),
      { agencyId: actor.agencyId, tripId },
    );
    emailStatus = res.status;
  }
  return { paymentId: payment.id, summary, emailStatus };
}

export async function voidPayment(actor: Actor | null, paymentId: string, reason: string) {
  assertAgent(actor);
  const p = await db.payment.findFirst({ where: { id: paymentId, agencyId: actor.agencyId } });
  if (!p) throw notFound("Payment");
  if (p.voidedAt) return;
  const why = reason.trim().slice(0, 200);
  if (!why) throw new AppError("VALIDATION_ERROR", "Give a reason for voiding this payment.");
  await db.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), notes: [p.notes, `Voided: ${why}`].filter(Boolean).join("\n") } });
    await audit(actor, { action: "payment.voided", entity: "Trip", entityId: p.tripId, summary: `Voided ${formatINR(p.amount)} payment — ${why}`, before: { amount: p.amount, voided: false }, after: { voided: true, reason: why } }, tx);
  });
}

export type PaymentListQuery = { q?: string; state?: "UNPAID" | "PARTIAL" | "PAID" | ""; page?: number };

/** Per-trip balances for the Payments page (computed, not stored). */
export async function listBalances(actor: Actor | null, query: PaymentListQuery = {}) {
  assertAgent(actor);
  const q = query.q?.trim();
  const where: Prisma.TripWhereInput = {
    agencyId: actor.agencyId,
    status: { notIn: ["DRAFT", "CANCELLED"] },
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { primaryGuest: { fullName: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const trips = await db.trip.findMany({
    where,
    orderBy: { startDate: "asc" },
    take: 500,
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      priceOverride: true,
      primaryGuest: { select: { fullName: true } },
      destinations: { orderBy: { position: "asc" }, select: { name: true } },
      hotels: { select: { hotel: { select: { name: true } }, rooms: { select: { roomName: true, nightlyRate: true, quantity: true, checkIn: true, checkOut: true } } } },
      transports: { select: { pickup: true, dropoff: true, price: true } },
      activities: { select: { title: true, price: true } },
      payments: { select: { amount: true, voidedAt: true, paidAt: true } },
    },
  });
  const { priceLines, tripTotals } = await import("@/lib/pricing");
  const rows = trips.map((t) => {
    const lines = priceLines({ rooms: t.hotels.flatMap((h) => h.rooms.map((r) => ({ ...r, hotelName: h.hotel.name }))), transports: t.transports, activities: t.activities });
    const { total } = tripTotals(lines, t.priceOverride);
    const s = paymentSummary(total, t.payments);
    const lastPaid = t.payments.filter((p) => !p.voidedAt).sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())[0]?.paidAt ?? null;
    return { id: t.id, code: t.code, title: tripTitle(t), status: t.status, startDate: t.startDate, endDate: t.endDate, guest: t.primaryGuest?.fullName ?? null, lastPaid, ...s };
  });
  const filtered = query.state ? rows.filter((r) => r.state === query.state) : rows;
  const totals = filtered.reduce((acc, r) => ({ total: acc.total + r.total, paid: acc.paid + r.paid, pending: acc.pending + r.pending }), { total: 0, paid: 0, pending: 0 });
  const page = Math.max(1, query.page ?? 1);
  const pageSize = 15;
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), totals, total: filtered.length, page, pageSize, pages: Math.max(1, Math.ceil(filtered.length / pageSize)) };
}

export async function recentPayments(actor: Actor | null, take = 10) {
  assertAgent(actor);
  return db.payment.findMany({
    where: { agencyId: actor.agencyId },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take,
    include: { trip: { select: { id: true, code: true, primaryGuest: { select: { fullName: true } } } } },
  });
}

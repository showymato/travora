import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { randomToken } from "../auth/crypto";
import { appUrl, sendEmail } from "../email";
import { templates } from "../email/templates";
import { notifyAgency } from "../notifications";
import { enforceRateLimit } from "../rate-limit";
import { fmtDate, fmtRange, nightsBetween, toISO } from "@/lib/dates";
import type { TripSnapshot } from "@/lib/snapshot";
import { guard, tripTitle } from "./core";
import { tripFullInclude, type TripFull } from "./queries";

export function buildSnapshot(trip: TripFull, agentName: string | null): TripSnapshot {
  return {
    schema: 1,
    agency: {
      name: trip.agency.name,
      email: trip.agency.supportEmail ?? trip.agency.email,
      phone: trip.agency.supportPhone ?? trip.agency.phone,
      address: trip.agency.address,
    },
    trip: {
      code: trip.code,
      title: tripTitle(trip),
      startDate: toISO(trip.startDate),
      endDate: toISO(trip.endDate),
      nights: nightsBetween(toISO(trip.startDate), toISO(trip.endDate)),
      travelers: { adults: trip.adults, children: trip.children, infants: trip.infants },
      destinations: trip.destinations.map((d) => d.name),
      status: trip.status,
    },
    guests: trip.guests.map((g) => ({ name: g.guest.fullName, primary: g.isPrimary })),
    days: trip.days.map((d) => ({
      dayNumber: d.dayNumber,
      date: toISO(d.date)!,
      title: d.title,
      summary: d.summary,
      items: d.items.map((i) => ({ time: i.time, type: i.type, title: i.title, description: i.description, location: i.location, durationMins: i.durationMins })),
    })),
    hotels: trip.hotels.map((h) => ({
      name: h.hotel.name,
      category: h.hotel.category,
      location: h.hotel.location,
      address: h.hotel.address,
      phone: h.hotel.phone,
      checkIn: toISO(h.checkIn)!,
      checkOut: toISO(h.checkOut)!,
      checkInTime: h.hotel.checkInTime,
      checkOutTime: h.hotel.checkOutTime,
      confirmationNumber: h.confirmationStatus === "CONFIRMED" ? h.confirmationNumber : null,
      confirmed: h.confirmationStatus === "CONFIRMED",
      rooms: h.rooms.map((r) => ({ name: r.roomName, quantity: r.quantity, mealPlan: r.mealPlan })),
    })),
    transports: trip.transports.map((t) => ({
      kind: t.kind,
      date: toISO(t.date)!,
      time: t.time,
      pickup: t.pickup,
      dropoff: t.dropoff,
      vehicle: t.vehicle,
      vehicleNumber: t.vehicleNumber,
      driverName: t.driverName,
      driverPhone: t.driverPhone,
    })),
    agent: { name: agentName },
    publishedAt: new Date().toISOString(),
  };
}

export function readinessIssues(trip: TripFull) {
  const issues: string[] = [];
  if (!trip.primaryGuestId) issues.push("Add the primary guest.");
  if (!trip.startDate || !trip.endDate) issues.push("Set the travel dates.");
  if (!trip.days.some((d) => d.items.length)) issues.push("Build the itinerary.");
  return issues;
}

async function publishVersion(actor: Actor & { kind: "AGENT" }, tripId: string, summary: string) {
  return db.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({ where: { id: tripId, agencyId: actor.agencyId }, include: tripFullInclude });
    if (!trip) throw notFound("Trip");
    const issues = readinessIssues(trip);
    if (issues.length) throw new AppError("VALIDATION_ERROR", issues.join(" "));
    const latest = await tx.tripVersion.findFirst({ where: { tripId }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (latest?.version ?? 0) + 1;
    const snapshot = buildSnapshot(trip, actor.name);
    await tx.tripVersion.create({
      data: { tripId, agencyId: actor.agencyId, version, summary: summary.slice(0, 300), snapshot: snapshot as unknown as Prisma.InputJsonValue, createdById: actor.userId },
    });
    const shareToken = trip.shareToken ?? randomToken(32);
    await tx.trip.update({ where: { id: tripId }, data: { publishedVersion: version, hasUnpublishedChanges: false, shareToken, shareEnabled: true } });
    return { trip, version, shareToken };
  });
}

export function guestTripUrl(token: string) {
  return appUrl(`/trip/${token}`);
}

/** Review → "Send to guest": publish version, mark SENT, email the guest. */
export async function sendTrip(actor: Actor | null, tripId: string, input: { message?: string; email?: boolean }) {
  guard(actor);
  await enforceRateLimit(`send:${actor.agencyId}`, 60, 60 * 60);
  const before = await db.trip.findFirst({ where: { id: tripId, agencyId: actor.agencyId }, select: { status: true, publishedVersion: true } });
  if (!before) throw notFound("Trip");
  if (["CANCELLED", "COMPLETED"].includes(before.status)) throw new AppError("CONFLICT", "This trip can no longer be sent.");
  const { trip, version, shareToken } = await publishVersion(actor, tripId, before.publishedVersion ? "Itinerary re-sent" : "Itinerary sent to guest");
  const nextStatus = ["DRAFT", "PLANNING", "READY"].includes(trip.status) ? "SENT" : trip.status;
  await db.trip.update({ where: { id: tripId }, data: { status: nextStatus, sentAt: new Date() } });

  let emailStatus: string = "SKIPPED";
  const guest = trip.primaryGuest;
  if (input.email !== false && guest?.email) {
    const res = await sendEmail(
      "itinerarySent",
      guest.email,
      templates.itinerarySent({
        agencyName: trip.agency.name,
        supportEmail: trip.agency.supportEmail,
        supportPhone: trip.agency.supportPhone,
        guestName: guest.fullName,
        tripTitle: tripTitle(trip),
        dates: fmtRange(trip.startDate, trip.endDate),
        url: guestTripUrl(shareToken),
        agentName: actor.name,
        message: input.message?.trim() || null,
      }),
      { agencyId: actor.agencyId, tripId },
    );
    emailStatus = res.status;
  }
  await audit(actor, {
    action: "trip.sent",
    entity: "Trip",
    entityId: tripId,
    summary: `Sent ${trip.code} to ${guest?.fullName ?? "the guest"} (version ${version}${emailStatus === "SKIPPED" ? ", no email" : `, email ${emailStatus.toLowerCase()}`})`,
    before: { status: trip.status },
    after: { status: nextStatus, version },
  });
  await notifyAgency(actor.agencyId, { type: "trip.sent", title: `${trip.code} sent to ${guest?.fullName ?? "guest"}`, href: `/app/trips/${tripId}` }, { exceptUserId: actor.userId });
  return { version, url: guestTripUrl(shareToken), emailStatus, hasEmail: Boolean(guest?.email) };
}

/** Push held changes to the guest page as a new version; optionally tell the guest. */
export async function publishUpdate(actor: Actor | null, tripId: string, input: { summary: string; notify: boolean }) {
  guard(actor);
  const current = await db.trip.findFirst({ where: { id: tripId, agencyId: actor.agencyId }, select: { publishedVersion: true } });
  if (!current) throw notFound("Trip");
  if (!current.publishedVersion) throw new AppError("CONFLICT", "Send the trip to the guest first.");
  const summary = input.summary.trim() || "Itinerary updated";
  const { trip, version, shareToken } = await publishVersion(actor, tripId, summary);
  let emailStatus = "SKIPPED";
  if (input.notify && trip.primaryGuest?.email) {
    const res = await sendEmail(
      "itineraryUpdated",
      trip.primaryGuest.email,
      templates.itineraryUpdated({
        agencyName: trip.agency.name,
        supportEmail: trip.agency.supportEmail,
        supportPhone: trip.agency.supportPhone,
        guestName: trip.primaryGuest.fullName,
        tripTitle: tripTitle(trip),
        url: guestTripUrl(shareToken),
        summary,
      }),
      { agencyId: actor.agencyId, tripId },
    );
    emailStatus = res.status;
  }
  await audit(actor, { action: "trip.version_published", entity: "Trip", entityId: tripId, summary: `Version ${version} published: ${summary}`, after: { version } });
  return { version, emailStatus };
}

export async function setShareEnabled(actor: Actor | null, tripId: string, enabled: boolean, rotate = false) {
  guard(actor);
  const trip = await db.trip.findFirst({ where: { id: tripId, agencyId: actor.agencyId }, select: { shareToken: true, publishedVersion: true } });
  if (!trip) throw notFound("Trip");
  if (enabled && !trip.publishedVersion) throw new AppError("CONFLICT", "Send the trip to the guest first.");
  await db.trip.update({ where: { id: tripId }, data: { shareEnabled: enabled, ...(rotate ? { shareToken: randomToken(32) } : {}) } });
  await audit(actor, { action: rotate ? "trip.share_link_rotated" : enabled ? "trip.share_enabled" : "trip.share_disabled", entity: "Trip", entityId: tripId, summary: rotate ? "Generated a new guest link (old link stops working)" : enabled ? "Guest page enabled" : "Guest page disabled" });
}

/** Confirm a trip and optionally email the guest. */
export async function confirmTrip(actor: Actor | null, tripId: string, notify: boolean) {
  guard(actor);
  const trip = await db.trip.findFirst({ where: { id: tripId, agencyId: actor.agencyId }, include: { primaryGuest: true, agency: true, destinations: { orderBy: { position: "asc" } } } });
  if (!trip) throw notFound("Trip");
  if (trip.status !== "SENT") throw new AppError("CONFLICT", "Only trips that were sent to the guest can be confirmed.");
  await db.trip.update({ where: { id: tripId }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  await audit(actor, { action: "trip.status_changed", entity: "Trip", entityId: tripId, summary: `Moved ${trip.code} from Sent to Confirmed`, before: { status: "SENT" }, after: { status: "CONFIRMED" } });
  if (notify && trip.primaryGuest?.email && trip.shareToken) {
    await sendEmail(
      "tripConfirmed",
      trip.primaryGuest.email,
      templates.tripConfirmed({ agencyName: trip.agency.name, supportEmail: trip.agency.supportEmail, supportPhone: trip.agency.supportPhone, guestName: trip.primaryGuest.fullName, tripTitle: tripTitle(trip), dates: fmtRange(trip.startDate, trip.endDate), url: guestTripUrl(trip.shareToken) }),
      { agencyId: actor.agencyId, tripId },
    );
  }
}

// ---- Public guest page ------------------------------------------------------

/** Resolve a share token to the published snapshot. Constant shape for "not found" and "disabled". */
export async function getPublicTrip(token: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const trip = await db.trip.findUnique({
    where: { shareToken: token },
    select: { id: true, agencyId: true, shareEnabled: true, publishedVersion: true, status: true },
  });
  if (!trip || !trip.shareEnabled || !trip.publishedVersion || trip.status === "CANCELLED") return null;
  const [version, documents] = await Promise.all([
    db.tripVersion.findUnique({ where: { tripId_version: { tripId: trip.id, version: trip.publishedVersion } } }),
    db.document.findMany({ where: { tripId: trip.id, visibleToGuest: true }, orderBy: { createdAt: "desc" }, select: { id: true, kind: true, title: true, createdAt: true, sizeBytes: true } }),
  ]);
  if (!version) return null;
  // Only the newest document of each kind/subject is shown to the guest.
  const seen = new Set<string>();
  const latestDocs = documents.filter((d) => {
    const k = `${d.kind}:${d.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { tripId: trip.id, version: version.version, updatedAt: version.createdAt, snapshot: version.snapshot as unknown as TripSnapshot, documents: latestDocs };
}

export function fmtPublishedAt(d: Date) {
  return fmtDate(d);
}

import { beforeAll, describe, expect, it } from "vitest";
import { buildWorld, db, PASSWORD, type World } from "./fixtures";
import { AppError } from "@/server/errors";
import { login, changePassword } from "@/server/auth/service";
import { actorFromToken } from "@/server/auth/session";
import * as agencies from "@/server/agencies";
import * as hotels from "@/server/hotels";
import * as templates from "@/server/templates";
import * as guests from "@/server/guests";
import * as core from "@/server/trips/core";
import * as lines from "@/server/trips/lines";
import * as itin from "@/server/trips/itinerary";
import * as publish from "@/server/trips/publish";
import * as queries from "@/server/trips/queries";
import * as payments from "@/server/payments";
import * as docs from "@/server/documents/service";
import { pendingActions } from "@/server/ops";
import { addDays, todayISO } from "@/lib/dates";
import { storage } from "@/server/storage";

let w: World;
beforeAll(async () => {
  w = await buildWorld();
});

describe("authentication", () => {
  it("signs in with the right password and resolves the session to an actor", async () => {
    const r = await login({ email: "A@TEST.local", password: PASSWORD });
    expect(r.actor.kind).toBe("AGENT");
    const actor = await actorFromToken(r.token);
    expect(actor).toMatchObject({ kind: "AGENT", agencyId: w.A.agency.id });
  });
  it("rejects a wrong password without revealing whether the account exists", async () => {
    const a = await login({ email: "a@test.local", password: "wrong-password" }).catch((e) => e);
    const b = await login({ email: "nobody@test.local", password: "wrong-password" }).catch((e) => e);
    expect(a.code).toBe("INVALID_CREDENTIALS");
    expect(b.code).toBe("INVALID_CREDENTIALS");
    expect(a.message).toBe(b.message);
  });
  it("rejects garbage session tokens", async () => {
    expect(await actorFromToken("nope")).toBeNull();
    expect(await actorFromToken("x".repeat(43))).toBeNull();
  });
  it("blocks suspended agencies and signs their sessions out", async () => {
    const s = await login({ email: "b@test.local", password: PASSWORD });
    await agencies.setAgencyStatus(w.admin, w.B.agency.id, "SUSPENDED");
    expect(await actorFromToken(s.token)).toBeNull();
    const err = await login({ email: "b@test.local", password: PASSWORD }).catch((e) => e);
    expect(err.code).toBe("AGENCY_SUSPENDED");
    await agencies.setAgencyStatus(w.admin, w.B.agency.id, "ACTIVE");
    expect((await login({ email: "b@test.local", password: PASSWORD })).actor.kind).toBe("AGENT");
  });
  it("changes a password only with the current one", async () => {
    await expect(changePassword(w.A.actor, { current: "wrong", next: "New-password-456" })).rejects.toBeInstanceOf(AppError);
    await changePassword(w.A.actor, { current: PASSWORD, next: "New-password-456" });
    await expect(login({ email: "a@test.local", password: PASSWORD })).rejects.toBeInstanceOf(AppError);
    await changePassword(w.A.actor, { current: "New-password-456", next: PASSWORD });
  });
});

describe("super admin: agencies, hotels, rates, templates", () => {
  let newAgencyId: string;
  it("creates an agency with user, role, subscription, welcome email and audit entry", async () => {
    const r = await agencies.createAgency(w.admin, {
      name: "ABC Travels",
      ownerName: "Rahul Verma",
      email: "hello@abc.example",
      phone: "+91 98100 11223",
      city: "Delhi",
      state: "",
      country: "India",
      address: "",
      gstNumber: "",
      plan: "PROFESSIONAL",
      status: "TRIAL",
      loginEmail: "rahul@abc.example",
      tempPassword: "Temp-pass-12345",
    });
    newAgencyId = r.agencyId;
    const a = await db.agency.findUniqueOrThrow({ where: { id: r.agencyId }, include: { users: true, subscription: { include: { plan: true } } } });
    expect(a.users[0]).toMatchObject({ role: "AGENT", email: "rahul@abc.example", mustChangePassword: true });
    expect(a.subscription).toMatchObject({ status: "TRIALING" });
    expect(a.subscription?.plan.code).toBe("PROFESSIONAL");
    expect(await db.emailLog.count({ where: { agencyId: r.agencyId, template: "welcomeAgent" } })).toBe(1);
    expect(await db.auditLog.count({ where: { agencyId: r.agencyId, action: "agency.created" } })).toBe(1);
    const s = await login({ email: "rahul@abc.example", password: "Temp-pass-12345" });
    expect(s.mustChangePassword).toBe(true);
  });
  it("refuses a duplicate login email", async () => {
    const err = await agencies
      .createAgency(w.admin, { name: "Dup", ownerName: "D", email: "d@x.example", phone: "+91 98100 11224", city: "", state: "", country: "", address: "", gstNumber: "", plan: "STARTER", status: "ACTIVE", loginEmail: "rahul@abc.example", tempPassword: "Temp-pass-12345" })
      .catch((e) => e);
    expect(err.code).toBe("CONFLICT");
  });
  it("resets access with a new temporary password", async () => {
    const r = await agencies.resetAgencyAccess(w.admin, newAgencyId);
    expect((await login({ email: r.email, password: r.tempPassword })).mustChangePassword).toBe(true);
  });
  it("creates a hotel and room, assigns it and sets an agency rate the agent then sees", async () => {
    const h = await hotels.createHotel(w.admin, {
      name: "Blanco Hotel",
      category: "FIVE_STAR",
      description: "",
      destination: "Srinagar",
      location: "Srinagar, Boulevard Road",
      address: "",
      latitude: "34.08",
      longitude: "74.83",
      phone: "",
      email: "",
      website: "",
      amenities: ["Wi-Fi", "Spa"],
      checkInTime: "14:00",
      checkOutTime: "11:00",
      cancellationPolicy: "",
      notes: "",
      status: "ACTIVE",
    });
    const roomId = await hotels.upsertRoom(w.admin, h.id, null, { name: "Deluxe", description: "", capacity: 3, bedConfig: "", inventory: 10, baseRate: 8000, mealPlans: ["CP", "MAP"], amenities: [], status: "ACTIVE" });
    const actor = (await login({ email: "rahul@abc.example", password: (await agencies.resetAgencyAccess(w.admin, newAgencyId)).tempPassword })).actor;
    expect((await hotels.listAgentHotels(actor)).length).toBe(0);
    await hotels.setAssignments(w.admin, newAgencyId, [h.id]);
    expect((await hotels.listAgentHotels(actor))[0].rooms[0].rate).toBe(8000);
    await hotels.setRoomRates(w.admin, { roomId, rates: [{ agencyId: newAgencyId, rate: 7200 }] });
    expect((await hotels.listAgentHotels(actor))[0].rooms[0].rate).toBe(7200);
    await hotels.setRoomRates(w.admin, { roomId, rates: [{ agencyId: newAgencyId, rate: null }] });
    expect((await hotels.listAgentHotels(actor))[0].rooms[0].rate).toBe(8000);
  });
  it("creates templates that agents can list", async () => {
    await templates.saveTemplate(w.admin, null, {
      name: "Kashmir 2N / 3D",
      description: "",
      destination: "Kashmir",
      nights: 2,
      tags: ["Short"],
      status: "ACTIVE",
      days: [
        { title: "Arrival", summary: "", items: [{ time: "17:00", type: "ACTIVITY", title: "Shikara ride", description: "", location: "Dal Lake", durationMins: 60, notes: "" }] },
        { title: "Gardens", summary: "", items: [{ time: "10:00", type: "SIGHTSEEING", title: "Mughal gardens", description: "", location: "", durationMins: null, notes: "" }] },
        { title: "Departure", summary: "", items: [] },
      ],
    });
    const list = await templates.listTemplatesForAgent(w.A.actor);
    expect(list.map((t) => t.name)).toContain("Kashmir 2N / 3D");
  });
});

describe("agent: guests, trips, itinerary, documents, payments, publishing", () => {
  let tripId: string;
  let guestId: string;
  const A = () => w.A.actor;

  it("creates a guest and refuses an exact duplicate", async () => {
    const g = await guests.createGuest(A(), { fullName: "Rahul Sharma", phone: "+91 98111 00000", email: "rahul.sharma@example.com", whatsapp: "", nationality: "Indian", dateOfBirth: "", gender: "MALE", address: "", idType: "PASSPORT", idNumber: "Z1234567", notes: "" });
    guestId = g.id;
    const dup = await guests.createGuest(A(), { fullName: "rahul sharma", phone: "+91 98111 00000", email: "", whatsapp: "", nationality: "", dateOfBirth: "", gender: "", address: "", idType: "", idNumber: "", notes: "" }).catch((e) => e);
    expect(dup.code).toBe("CONFLICT");
  });

  it("stores guest documents privately and rejects non-documents", async () => {
    const pdf = new File([Buffer.from("%PDF-1.4 passport")], "passport.pdf", { type: "application/pdf" });
    const doc = await guests.uploadGuestDocument(A(), guestId, pdf, "PASSPORT", "Front page");
    expect(doc.storageKey).toMatch(new RegExp(`^agencies/${w.A.agency.id}/guests/${guestId}/`));
    const read = await guests.readGuestDocument(A(), doc.id);
    expect(read.bytes.toString()).toContain("passport");
    expect(await db.auditLog.count({ where: { action: "guest.document_viewed", entityId: guestId } })).toBe(1);
    const fake = new File([Buffer.from("<script>alert(1)</script>")], "evil.pdf", { type: "application/pdf" });
    await expect(guests.uploadGuestDocument(A(), guestId, fake, "OTHER", "")).rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("creates a trip, sets dates and destinations, and allocates nights", async () => {
    const t = await core.startTrip(A(), { primaryGuestId: guestId, guestIds: [w.guestA.id], adults: 4, children: 1, infants: 0 });
    tripId = t.id;
    expect(t.code).toMatch(/^TRV-\d+$/);
    expect(t.status).toBe("DRAFT");
    await expect(core.updateDates(A(), tripId, { startDate: w.start, endDate: w.start })).rejects.toBeTruthy();
    await core.updateDates(A(), tripId, { startDate: w.start, endDate: addDays(w.start, 6) });
    await core.setDestinations(A(), tripId, { destinations: ["Srinagar", "Gulmarg", "Pahalgam"].map((name) => ({ name, destinationId: null, nights: null })) });
    const dests = await db.tripDestination.findMany({ where: { tripId }, orderBy: { position: "asc" } });
    expect(dests.map((d) => [d.name, d.nights])).toEqual([
      ["Srinagar", 2],
      ["Gulmarg", 2],
      ["Pahalgam", 2],
    ]);
    expect(await db.tripGuest.count({ where: { tripId } })).toBe(2);
  });

  it("books hotels and rooms at the agency's rate and keeps the trip total current", async () => {
    const stay = await lines.addStay(A(), tripId, { hotelId: w.shared.hotel.id, checkIn: w.start, checkOut: addDays(w.start, 2) });
    await expect(lines.addStay(A(), tripId, { hotelId: w.hotelA.hotel.id, checkIn: addDays(w.start, -1), checkOut: w.start })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await lines.addStayRoom(A(), stay.id, { roomId: w.shared.room.id, quantity: 2, guests: 5, mealPlan: "MAP", checkIn: w.start, checkOut: addDays(w.start, 2) });
    await expect(lines.addStayRoom(A(), stay.id, { roomId: w.shared.room.id, quantity: 1, guests: 2, mealPlan: "AP", checkIn: w.start, checkOut: addDays(w.start, 2) })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const room = await db.tripRoom.findFirstOrThrow({ where: { tripId } });
    expect(room.nightlyRate).toBe(7200);
    expect((await db.trip.findUniqueOrThrow({ where: { id: tripId } })).totalAmount).toBe(7200 * 2 * 2);
  });

  it("adds transport and activities and mirrors them into the itinerary", async () => {
    await lines.saveTransport(A(), tripId, null, { kind: "AIRPORT_TRANSFER", date: w.start, time: "09:30", pickup: "Srinagar Airport", dropoff: "Shared Hotel", vehicle: "Innova", driverName: "", driverPhone: "", vehicleNumber: "", notes: "", price: 1500, addToItinerary: true });
    await lines.saveActivity(A(), tripId, null, { kind: "ACTIVITY", date: addDays(w.start, 1), time: "15:00", title: "Gondola", location: "Gulmarg", description: "", durationMins: 120, notes: "", price: 3600, addToItinerary: true });
    await itin.generateItinerary(A(), tripId);
    const days = await db.itineraryDay.findMany({ where: { tripId }, orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } });
    expect(days).toHaveLength(7);
    const d1 = days[0].items.map((i) => i.type);
    expect(d1[0]).toBe("AIRPORT_ARRIVAL");
    expect(d1).toContain("TRANSPORT");
    expect(d1).toContain("HOTEL_CHECK_IN");
    expect(days[1].items.some((i) => i.title === "Gondola")).toBe(true);
    expect(days[6].items.some((i) => i.type === "AIRPORT_DEPARTURE")).toBe(true);
    // Nothing critical is invented: no flight times.
    expect(days[0].items.find((i) => i.type === "AIRPORT_ARRIVAL")?.time).toBeNull();
    const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId } });
    expect(trip.status).toBe("PLANNING");
    expect(trip.totalAmount).toBe(7200 * 4 + 1500 + 3600);
    // Editing the transport updates its itinerary item in place.
    const tr = await db.tripTransport.findFirstOrThrow({ where: { tripId } });
    await lines.saveTransport(A(), tripId, tr.id, { kind: "AIRPORT_TRANSFER", date: w.start, time: "10:15", pickup: "Srinagar Airport", dropoff: "Shared Hotel", vehicle: "Innova", driverName: "Bashir", driverPhone: "+91 94191 10001", vehicleNumber: "JK01 AB 1", notes: "", price: 1500, addToItinerary: true });
    const mirrored = await db.itineraryItem.findMany({ where: { sourceId: tr.id } });
    expect(mirrored).toHaveLength(1);
    expect(mirrored[0].time).toBe("10:15");
  });

  it("edits, duplicates, reorders and moves itinerary items", async () => {
    const days = await db.itineraryDay.findMany({ where: { tripId }, orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } });
    // A timed item lands after earlier timed items even when an untimed one leads the day.
    await itin.addItem(A(), days[0].id, { time: "16:00", type: "ACTIVITY", title: "Welcome kahwa", description: "", location: "", durationMins: null, notes: "" });
    const d1 = await db.itineraryItem.findMany({ where: { dayId: days[0].id }, orderBy: { position: "asc" } });
    const order = d1.map((i) => i.title);
    expect(order.indexOf("Welcome kahwa")).toBeGreaterThan(order.findIndex((t) => t.startsWith("Check-in")));
    expect(d1[0].type).toBe("AIRPORT_ARRIVAL");
    const d3 = days[2];
    await itin.addItem(A(), d3.id, { time: "18:00", type: "MEAL", title: "Dinner at Ahdoos", description: "", location: "Srinagar", durationMins: 90, notes: "" });
    const added = await db.itineraryItem.findFirstOrThrow({ where: { dayId: d3.id, title: "Dinner at Ahdoos" } });
    await itin.updateItem(A(), added.id, { time: "19:30", type: "MEAL", title: "Dinner at Ahdoos", description: "Wazwan", location: "Srinagar", durationMins: 90, notes: "" });
    await itin.duplicateItem(A(), added.id);
    expect(await db.itineraryItem.count({ where: { dayId: d3.id, title: "Dinner at Ahdoos" } })).toBe(2);
    const ids = (await db.itineraryItem.findMany({ where: { dayId: d3.id }, orderBy: { position: "asc" } })).map((i) => i.id);
    await itin.reorderItems(A(), tripId, { [d3.id]: [...ids].reverse() });
    expect((await db.itineraryItem.findMany({ where: { dayId: d3.id }, orderBy: { position: "asc" } })).map((i) => i.id)).toEqual([...ids].reverse());
    // Move one item to Day 4 (both days submitted).
    const d4 = days[3];
    const d4ids = (await db.itineraryItem.findMany({ where: { dayId: d4.id }, orderBy: { position: "asc" } })).map((i) => i.id);
    const moving = ids[0];
    await itin.reorderItems(A(), tripId, { [d3.id]: [...ids].reverse().filter((i) => i !== moving), [d4.id]: [...d4ids, moving] });
    expect((await db.itineraryItem.findUniqueOrThrow({ where: { id: moving } })).dayId).toBe(d4.id);
    // Stale layouts are refused.
    await expect(itin.reorderItems(A(), tripId, { [d3.id]: ids })).rejects.toBeInstanceOf(AppError);
    await itin.deleteItem(A(), moving);
    await itin.updateDay(A(), d3.id, { title: "Srinagar → Gulmarg", summary: "Drive and gondola" });
  });

  it("applies a template while keeping real bookings", async () => {
    const t = (await templates.listTemplatesForAgent(A())).find((x) => x.name === "Kashmir 2N / 3D")!;
    await itin.generateItinerary(A(), tripId, { templateId: t.id });
    const items = await db.itineraryItem.findMany({ where: { tripId } });
    expect(items.some((i) => i.source === "TEMPLATE" && i.title === "Shikara ride")).toBe(true);
    expect(items.some((i) => i.source === "HOTEL")).toBe(true);
    expect(items.some((i) => i.source === "TRANSPORT")).toBe(true);
  });

  it("generates branded PDF documents into private storage", async () => {
    for (const kind of ["ITINERARY", "HOTEL_VOUCHER", "TRANSPORT_VOUCHER", "INVOICE", "GUEST_SUMMARY", "TRIP_CONFIRMATION"]) {
      const d = await docs.generateDocument(A(), tripId, kind);
      const file = await storage().get(d.storageKey);
      expect(file?.bytes.subarray(0, 4).toString()).toBe("%PDF");
      expect(d.storageKey.startsWith(`agencies/${w.A.agency.id}/trips/${tripId}/`)).toBe(true);
    }
    const inv = await db.invoice.findFirstOrThrow({ where: { tripId } });
    expect(inv.total).toBe(inv.subtotal + inv.tax);
    expect((await db.document.findFirstOrThrow({ where: { tripId, kind: "GUEST_SUMMARY" } })).visibleToGuest).toBe(false);
    await expect(docs.generateDocument(A(), tripId, "PAYMENT_RECEIPT")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("records payments and calculates paid / pending / state", async () => {
    const total = (await db.trip.findUniqueOrThrow({ where: { id: tripId } })).totalAmount;
    const r1 = await payments.recordPayment(A(), tripId, { amount: 10000, paidAt: todayISO(), method: "UPI", reference: "UTR1", notes: "", notifyGuest: true });
    expect(r1.summary).toMatchObject({ paid: 10000, pending: total - 10000, state: "PARTIAL" });
    expect(r1.emailStatus).toBe("LOGGED");
    await expect(payments.recordPayment(A(), tripId, { amount: 1, paidAt: addDays(todayISO(), 3), method: "UPI", reference: "", notes: "", notifyGuest: false })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const r2 = await payments.recordPayment(A(), tripId, { amount: total - 10000, paidAt: todayISO(), method: "BANK_TRANSFER", reference: "", notes: "", notifyGuest: false });
    expect(r2.summary.state).toBe("PAID");
    await payments.voidPayment(A(), r2.paymentId, "Duplicate");
    const { payment } = await queries.getTrip(A(), tripId);
    expect(payment).toMatchObject({ paid: 10000, state: "PARTIAL" });
    const receipt = await docs.generateDocument(A(), tripId, "PAYMENT_RECEIPT");
    expect(receipt.subjectId).toBe(r1.paymentId);
  });

  it("sends to the guest, versions changes and only shows published content", async () => {
    const sent = await publish.sendTrip(A(), tripId, { email: true, message: "Have a lovely trip" });
    expect(sent.version).toBe(1);
    expect(sent.emailStatus).toBe("LOGGED");
    const token = sent.url.split("/trip/")[1];
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect((await db.trip.findUniqueOrThrow({ where: { id: tripId } })).status).toBe("SENT");

    const pub1 = await publish.getPublicTrip(token);
    expect(pub1?.version).toBe(1);
    const day3 = pub1!.snapshot.days[2];
    // Guest snapshot carries no internal data.
    const json = JSON.stringify(pub1!.snapshot);
    expect(json).not.toContain("nightlyRate");
    expect(json).not.toContain("Z1234567");
    expect(json).not.toContain("UTR1");
    expect(pub1!.documents.some((d) => d.kind === "GUEST_SUMMARY")).toBe(false);

    // Edit Day 3: held back until published.
    const d3 = await db.itineraryDay.findFirstOrThrow({ where: { tripId, dayNumber: 3 } });
    await itin.addItem(A(), d3.id, { time: "21:00", type: "NOTE", title: "Late check-in arranged", description: "", location: "", durationMins: null, notes: "" });
    expect((await db.trip.findUniqueOrThrow({ where: { id: tripId } })).hasUnpublishedChanges).toBe(true);
    const still = await publish.getPublicTrip(token);
    expect(still?.snapshot.days[2].items.length).toBe(day3.items.length);

    const up = await publish.publishUpdate(A(), tripId, { summary: "Day 3 updated", notify: true });
    expect(up.version).toBe(2);
    const pub2 = await publish.getPublicTrip(token);
    expect(pub2?.snapshot.days[2].items.some((i) => i.title === "Late check-in arranged")).toBe(true);
    expect(await db.emailLog.count({ where: { tripId, template: "itineraryUpdated" } })).toBe(1);
    expect(await db.tripVersion.count({ where: { tripId } })).toBe(2);

    // Disabling or rotating the link cuts off access.
    await publish.setShareEnabled(A(), tripId, true, true);
    expect(await publish.getPublicTrip(token)).toBeNull();
  });

  it("enforces status transitions", async () => {
    await expect(core.setTripStatus(A(), tripId, "COMPLETED")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await publish.confirmTrip(A(), tripId, true);
    expect((await db.trip.findUniqueOrThrow({ where: { id: tripId } })).status).toBe("CONFIRMED");
  });

  it("raises pending actions for what the agent needs to do next", async () => {
    const t = await core.startTrip(A(), { primaryGuestId: w.guestA.id, guestIds: [], adults: 2, children: 0, infants: 0 });
    const tomorrow = addDays(todayISO(), 1);
    await core.updateDates(A(), t.id, { startDate: tomorrow, endDate: addDays(tomorrow, 2) });
    const stay = await lines.addStay(A(), t.id, { hotelId: w.hotelA.hotel.id, checkIn: tomorrow, checkOut: addDays(tomorrow, 2) });
    await lines.addStayRoom(A(), stay.id, { roomId: w.hotelA.room.id, quantity: 1, guests: 2, mealPlan: "CP", checkIn: tomorrow, checkOut: addDays(tomorrow, 2) });
    await lines.saveTransport(A(), t.id, null, { kind: "AIRPORT_TRANSFER", date: tomorrow, time: "10:00", pickup: "Airport", dropoff: "Hotel", vehicle: "", driverName: "", driverPhone: "", vehicleNumber: "", notes: "", price: 0, addToItinerary: true });
    await itin.generateItinerary(A(), t.id);
    await publish.sendTrip(A(), t.id, { email: false });
    const kinds = (await pendingActions(w.A.agency.id)).filter((p) => p.tripId === t.id).map((p) => p.kind);
    expect(kinds).toEqual(expect.arrayContaining(["TRIP_TOMORROW", "HOTEL_CONFIRMATION", "TRANSPORT_DETAILS", "PAYMENT_PENDING"]));
  });

  it("audits trip changes with before/after values", async () => {
    const log = await queries.tripActivityLog(A(), tripId, 200);
    const actions = log.map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["trip.created", "trip.dates_updated", "trip.hotel_added", "itinerary.item_updated", "payment.recorded", "payment.voided", "document.generated", "trip.sent", "trip.version_published"]));
    const upd = log.find((l) => l.action === "itinerary.item_updated")!;
    expect(upd.before).toMatchObject({ time: "18:00" });
    expect(upd.after).toMatchObject({ time: "19:30" });
  });
});

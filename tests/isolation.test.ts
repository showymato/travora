import { beforeAll, describe, expect, it } from "vitest";
import { buildWorld, db, type World } from "./fixtures";
import { AppError } from "@/server/errors";
import * as core from "@/server/trips/core";
import * as lines from "@/server/trips/lines";
import * as itin from "@/server/trips/itinerary";
import * as publish from "@/server/trips/publish";
import * as queries from "@/server/trips/queries";
import * as guests from "@/server/guests";
import * as hotels from "@/server/hotels";
import * as agencies from "@/server/agencies";
import * as payments from "@/server/payments";
import * as docs from "@/server/documents/service";
import * as templates from "@/server/templates";
import { globalSearch, calendarEvents, pendingActions } from "@/server/ops";
import { addDays } from "@/lib/dates";

let w: World;
let tripB: string;
let stayB: string;
let docB: string;
let paymentB: string;
let itemB: string;
let guestDocB: string;

async function denied(p: Promise<unknown>) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err, "expected the call to be rejected").toBeInstanceOf(AppError);
  expect(["NOT_FOUND", "FORBIDDEN", "UNAUTHENTICATED"]).toContain((err as AppError).code);
}

beforeAll(async () => {
  w = await buildWorld();
  // Build a full trip for agency B through the real services.
  const t = await core.startTrip(w.B.actor, { primaryGuestId: w.guestB.id, guestIds: [], adults: 2, children: 0, infants: 0 });
  tripB = t.id;
  await core.updateDates(w.B.actor, tripB, { startDate: w.start, endDate: addDays(w.start, 3) });
  const stay = await lines.addStay(w.B.actor, tripB, { hotelId: w.hotelB.hotel.id, checkIn: w.start, checkOut: addDays(w.start, 3) });
  stayB = stay.id;
  await lines.addStayRoom(w.B.actor, stayB, { roomId: w.hotelB.room.id, quantity: 1, guests: 2, mealPlan: "CP", checkIn: w.start, checkOut: addDays(w.start, 3) });
  await itin.generateItinerary(w.B.actor, tripB);
  itemB = (await db.itineraryItem.findFirstOrThrow({ where: { tripId: tripB } })).id;
  const pay = await payments.recordPayment(w.B.actor, tripB, { amount: 5000, paidAt: addDays(w.start, -20), method: "UPI", reference: "B-REF", notes: "", notifyGuest: false });
  paymentB = pay.paymentId;
  docB = (await docs.generateDocument(w.B.actor, tripB, "ITINERARY")).id;
  const pdf = new File([Buffer.from("%PDF-1.4 test")], "id.pdf", { type: "application/pdf" });
  guestDocB = (await guests.uploadGuestDocument(w.B.actor, w.guestB.id, pdf, "PASSPORT", "")).id;
});

describe("tenant isolation — Agency A must never reach Agency B's data", () => {
  const A = () => w.A.actor;

  it("cannot read B's trip, its activity or its documents", async () => {
    await denied(queries.getTrip(A(), tripB));
    expect(await queries.tripActivityLog(A(), tripB)).toHaveLength(0);
    await denied(docs.readDocument(A(), docB));
  });

  it("cannot modify any part of B's trip", async () => {
    await denied(core.updateDates(A(), tripB, { startDate: w.start, endDate: addDays(w.start, 2) }));
    await denied(core.updateTravelers(A(), tripB, { primaryGuestId: w.guestA.id, guestIds: [], adults: 1, children: 0, infants: 0 }));
    await denied(core.setDestinations(A(), tripB, { destinations: [] }));
    await denied(core.updateTripMeta(A(), tripB, { priceOverride: 1 }));
    await denied(core.setTripStatus(A(), tripB, "CANCELLED"));
    await denied(core.deleteDraft(A(), tripB));
    await denied(core.addTripNote(A(), tripB, "hi"));
    await denied(lines.addStay(A(), tripB, { hotelId: w.hotelA.hotel.id, checkIn: w.start, checkOut: addDays(w.start, 1) }));
    await denied(lines.updateStay(A(), stayB, { checkIn: w.start, checkOut: addDays(w.start, 1), confirmationStatus: "CONFIRMED", confirmationNumber: "", notes: "" }));
    await denied(lines.removeStay(A(), stayB));
    await denied(lines.saveTransport(A(), tripB, null, { kind: "LOCAL", date: w.start, time: "", pickup: "x", dropoff: "y", vehicle: "", driverName: "", driverPhone: "", vehicleNumber: "", notes: "", price: 0, addToItinerary: true }));
    await denied(itin.generateItinerary(A(), tripB));
    await denied(itin.updateItem(A(), itemB, { time: "", type: "NOTE", title: "hacked", description: "", location: "", durationMins: null, notes: "" }));
    await denied(itin.deleteItem(A(), itemB));
    await denied(itin.duplicateItem(A(), itemB));
    await denied(itin.reorderItems(A(), tripB, {}));
    await denied(publish.sendTrip(A(), tripB, {}));
    await denied(publish.publishUpdate(A(), tripB, { summary: "", notify: false }));
    await denied(payments.recordPayment(A(), tripB, { amount: 1, paidAt: w.start.slice(0, 4) + "-01-01", method: "UPI", reference: "", notes: "", notifyGuest: false }));
    await denied(payments.voidPayment(A(), paymentB, "x"));
    await denied(docs.generateDocument(A(), tripB, "INVOICE"));
    await denied(docs.deleteDocument(A(), docB));
    await denied(docs.sendDocument(A(), docB));
    // Nothing changed.
    const t = await db.trip.findUniqueOrThrow({ where: { id: tripB }, include: { payments: true, items: true } });
    expect(t.status).toBe("PLANNING");
    expect(t.payments.every((p) => !p.voidedAt)).toBe(true);
    expect(t.items.some((i) => i.title === "hacked")).toBe(false);
  });

  it("cannot see or touch B's guests and their private documents", async () => {
    await denied(guests.getGuestProfile(A(), w.guestB.id));
    await denied(guests.updateGuest(A(), w.guestB.id, { fullName: "x", phone: "", email: "", whatsapp: "", nationality: "", dateOfBirth: "", gender: "", address: "", idType: "", idNumber: "", notes: "" }));
    await denied(guests.deleteGuest(A(), w.guestB.id));
    await denied(guests.readGuestDocument(A(), guestDocB));
    await denied(guests.deleteGuestDocument(A(), guestDocB));
    const list = await guests.listGuests(A(), {});
    expect(list.rows.map((g) => g.id)).not.toContain(w.guestB.id);
    expect((await guests.searchGuests(A(), "Guest of B")).length).toBe(0);
  });

  it("cannot put another agency's guest on its own trip", async () => {
    await denied(core.startTrip(A(), { primaryGuestId: w.guestB.id, guestIds: [], adults: 1, children: 0, infants: 0 }));
  });

  it("only sees its assigned hotels, at its own rate, never the base rate", async () => {
    const list = await hotels.listAgentHotels(A());
    const ids = list.map((h) => h.id);
    expect(ids).toContain(w.hotelA.hotel.id);
    expect(ids).toContain(w.shared.hotel.id);
    expect(ids).not.toContain(w.hotelB.hotel.id);
    const shared = list.find((h) => h.id === w.shared.hotel.id)!;
    expect(shared.rooms[0].rate).toBe(7200);
    // No base rate field and no other agency's rate anywhere in the payload.
    expect(JSON.stringify(list)).not.toContain("baseRate");
    expect(JSON.stringify(list)).not.toContain('"rates"');
    expect(list.flatMap((h) => h.rooms.map((r) => r.rate))).not.toContain(7500);
    await denied(hotels.getAgentHotel(A(), w.hotelB.hotel.id));
  });

  it("cannot book a hotel or room that isn't assigned to it", async () => {
    const t = await core.startTrip(A(), { primaryGuestId: w.guestA.id, guestIds: [], adults: 2, children: 0, infants: 0 });
    await core.updateDates(A(), t.id, { startDate: w.start, endDate: addDays(w.start, 2) });
    await denied(lines.addStay(A(), t.id, { hotelId: w.hotelB.hotel.id, checkIn: w.start, checkOut: addDays(w.start, 2) }));
    const stay = await lines.addStay(A(), t.id, { hotelId: w.hotelA.hotel.id, checkIn: w.start, checkOut: addDays(w.start, 2) });
    await expect(lines.addStayRoom(A(), stay.id, { roomId: w.hotelB.room.id, quantity: 1, guests: 2, mealPlan: "CP", checkIn: w.start, checkOut: addDays(w.start, 2) })).rejects.toBeInstanceOf(AppError);
  });

  it("search, calendar and pending actions never include B's records", async () => {
    const hits = await globalSearch(A(), "Guest of B");
    expect(hits).toHaveLength(0);
    const code = (await db.trip.findUniqueOrThrow({ where: { id: tripB } })).code;
    expect((await globalSearch(A(), code)).some((h) => h.id === tripB)).toBe(false);
    const ev = await calendarEvents(A(), addDays(w.start, -5), addDays(w.start, 10));
    expect(ev.some((e) => e.tripId === tripB)).toBe(false);
    const pending = await pendingActions(w.A.agency.id);
    expect(pending.some((p) => p.tripId === tripB)).toBe(false);
  });

  it("agents cannot call platform-admin services", async () => {
    await denied(agencies.listAgencies(A(), {}));
    await denied(agencies.getAgencyDetail(A(), w.B.agency.id));
    await denied(agencies.setAgencyStatus(A(), w.B.agency.id, "SUSPENDED"));
    await denied(agencies.resetAgencyAccess(A(), w.B.agency.id));
    await denied(hotels.createHotel(A(), {}));
    await denied(hotels.setAssignments(A(), w.A.agency.id, [w.hotelB.hotel.id]));
    await denied(hotels.setRoomRates(A(), { roomId: w.shared.room.id, rates: [{ agencyId: w.A.agency.id, rate: 1 }] }));
    await denied(templates.saveTemplate(A(), null, {}));
    expect((await db.agentHotel.count({ where: { agencyId: w.A.agency.id, hotelId: w.hotelB.hotel.id } }))).toBe(0);
  });

  it("anonymous callers are rejected everywhere", async () => {
    await denied(queries.getTrip(null, tripB));
    await denied(guests.listGuests(null, {}));
    await denied(agencies.listAgencies(null, {}));
  });

  it("guest share tokens only expose the published snapshot of their own trip", async () => {
    expect(await publish.getPublicTrip("short")).toBeNull();
    expect(await publish.getPublicTrip("x".repeat(43))).toBeNull();
    expect(await docs.readDocumentForGuest("x".repeat(43), docB)).toBeNull();
  });
});

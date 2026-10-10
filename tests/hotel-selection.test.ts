import { beforeAll, describe, expect, it } from "vitest";
import { buildWorld, db, type World } from "./fixtures";
import { AppError } from "@/server/errors";
import * as core from "@/server/trips/core";
import * as lines from "@/server/trips/lines";
import * as itin from "@/server/trips/itinerary";
import * as queries from "@/server/trips/queries";
import * as hotels from "@/server/hotels";
import { stepAttention } from "@/server/trips/checks";
import { addDays } from "@/lib/dates";
import { allocateNights, segmentsFor, toRanges } from "@/lib/plan";
import { distributeGuests, groupTotals, stayQuote } from "@/lib/pricing";
import { NO_FILTERS, cheapestFit, filterHotels, hotelsForDestination, policySummary, sortHotels, stayEstimate, type SearchableHotel } from "@/lib/hotel-search";

// ---- Pure discovery & pricing --------------------------------------------------

const H = (o: Partial<SearchableHotel> & { id: string }): SearchableHotel => ({
  name: o.id,
  category: "FOUR_STAR",
  location: "Srinagar",
  description: null,
  destination: "Srinagar",
  destinationId: "d-sxr",
  amenities: [],
  rooms: [],
  fromRate: null,
  ...o,
});
const catalog = [
  H({ id: "Lake Palace", category: "FIVE_STAR", amenities: ["Spa", "Wi-Fi"], rooms: [{ id: "lp1", rate: 12000, capacity: 2, mealPlans: ["CP", "MAP"] }], fromRate: 12000 }),
  H({ id: "City Inn", category: "THREE_STAR", amenities: ["Wi-Fi"], rooms: [{ id: "ci1", rate: 3500, capacity: 2, mealPlans: ["EP", "CP"] }], fromRate: 3500 }),
  H({ id: "Family Lodge", category: "FOUR_STAR", amenities: ["Parking"], rooms: [{ id: "fl1", rate: 6000, capacity: 4, mealPlans: ["MAP"] }], fromRate: 6000 }),
  H({ id: "Snow Resort", destination: "Gulmarg", destinationId: "d-gul", location: "Gulmarg", rooms: [{ id: "sr1", rate: 9000, capacity: 2, mealPlans: ["AP"] }], fromRate: 9000 }),
  H({ id: "Empty House", rooms: [], fromRate: null }),
];

describe("hotel discovery", () => {
  it("scopes hotels to the destination and never mixes others in", () => {
    expect(hotelsForDestination(catalog, { destinationId: "d-gul", name: "Gulmarg" }).map((h) => h.id)).toEqual(["Snow Resort"]);
    // Custom destinations (no catalog id) match by name.
    expect(hotelsForDestination(catalog, { destinationId: null, name: "gulmarg" }).map((h) => h.id)).toEqual(["Snow Resort"]);
    expect(hotelsForDestination(catalog, { destinationId: "d-leh", name: "Leh" })).toEqual([]);
    expect(hotelsForDestination(catalog, { destinationId: null, name: "Whole trip", isWholeTrip: true })).toHaveLength(catalog.length);
  });

  it("filters by search, category, price, amenities and meal plan", () => {
    const ids = (f: Partial<typeof NO_FILTERS>) => filterHotels(catalog, { ...NO_FILTERS, ...f }).map((h) => h.id);
    expect(ids({ q: "spa" })).toEqual(["Lake Palace"]);
    expect(ids({ categories: ["THREE_STAR", "FIVE_STAR"] })).toEqual(["Lake Palace", "City Inn"]);
    expect(ids({ maxPrice: 6000 })).toEqual(["City Inn", "Family Lodge"]);
    expect(ids({ amenities: ["Wi-Fi", "Spa"] })).toEqual(["Lake Palace"]);
    expect(ids({ mealPlans: ["MAP"] })).toEqual(["Lake Palace", "Family Lodge"]);
    // A hotel without a rate never passes a price filter.
    expect(ids({ maxPrice: 1_000_000 })).not.toContain("Empty House");
  });

  it("sorts by price, name and a transparent recommendation", () => {
    expect(sortHotels(catalog, "price-asc").map((h) => h.id).slice(0, 3)).toEqual(["City Inn", "Family Lodge", "Snow Resort"]);
    expect(sortHotels(catalog, "price-desc")[0].id).toBe("Lake Palace");
    expect(sortHotels(catalog, "name")[0].id).toBe("City Inn");
    const rec = sortHotels(catalog, "recommended", 4).map((h) => h.id);
    expect(rec[0]).toBe("Family Lodge"); // houses 4 in one room
    expect(rec.at(-1)).toBe("Empty House"); // nothing bookable
  });

  it("estimates the cheapest way to house the party", () => {
    expect(cheapestFit(catalog[2], 4)).toEqual({ roomId: "fl1", rooms: 1, nightly: 6000 });
    expect(stayEstimate(catalog[1], 3, 2)).toEqual({ roomId: "ci1", rooms: 2, nightly: 7000, total: 14000 });
    expect(stayEstimate(catalog[4], 2, 2)).toBeNull();
    expect(policySummary("Free cancellation up to 15 days before arrival; 50% after.")).toBe("Free cancellation up to 15 days before arrival");
  });
});

describe("stay pricing", () => {
  it("prices room lines explicitly in whole rupees", () => {
    const q = stayQuote(
      [
        { roomId: "deluxe", quantity: 2, nightlyRate: 8000, capacity: 2, guests: 4 },
        { roomId: "suite", quantity: 0, nightlyRate: 20000, capacity: 3, guests: 0 },
      ],
      2,
      4,
    );
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].amount).toBe(32000); // 2 rooms × 2 nights × ₹8,000
    expect(q.total).toBe(32000);
    expect(q.roomCount).toBe(2);
    expect(q.fitsParty).toBe(true);
    expect(q.problems).toEqual([]);
  });

  it("flags rooms that can't hold the party", () => {
    const q = stayQuote([{ roomId: "r", quantity: 1, nightlyRate: 5000, capacity: 2, guests: 3 }], 1, 3);
    expect(q.fitsParty).toBe(false);
    expect(q.problems).toHaveLength(1);
  });

  it("spreads the party across rooms without exceeding capacity", () => {
    expect(distributeGuests([{ capacity: 2, quantity: 2 }, { capacity: 3, quantity: 1 }], 5)).toEqual([4, 1]);
    expect(distributeGuests([{ capacity: 2, quantity: 1 }], 5)).toEqual([2]);
  });

  it("groups totals for the summary", () => {
    expect(
      groupTotals([
        { group: "Hotels", label: "a", amount: 100 },
        { group: "Hotels", label: "b", amount: 50 },
        { group: "Transport", label: "c", amount: 20 },
      ]),
    ).toEqual({ Hotels: 150, Transport: 20, Activities: 0 });
  });
});

describe("destination dates", () => {
  it("allocates nights and produces consecutive ranges", () => {
    const n = allocateNights(7, [null, 2, null]);
    expect(n).toEqual([3, 2, 2]);
    expect(toRanges("2026-11-01", n)).toEqual([
      { from: "2026-11-01", to: "2026-11-04" },
      { from: "2026-11-04", to: "2026-11-06" },
      { from: "2026-11-06", to: "2026-11-08" },
    ]);
    // Moving the start date shifts every range downstream.
    expect(toRanges("2026-11-03", n).at(-1)).toEqual({ from: "2026-11-08", to: "2026-11-10" });
  });
});

// ---- Server: planning stays ------------------------------------------------------

let w: World;
let gulmarg: { hotel: { id: string }; deluxe: { id: string }; suite: { id: string } };
let tripId: string;
let start: string;

async function rejected(p: Promise<unknown>, codes = ["NOT_FOUND", "FORBIDDEN", "VALIDATION_ERROR"]) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err, "expected the call to be rejected").not.toBeNull();
  if (err instanceof AppError) expect(codes).toContain(err.code);
  else expect((err as Error).name).toBe("ZodError");
}

beforeAll(async () => {
  w = await buildWorld();
  start = w.start;
  const dest = await db.destination.create({ data: { name: "Gulmarg" } });
  const hotel = await db.hotel.create({ data: { name: "Snow Peak", slug: "snow-peak", category: "FIVE_STAR", destinationId: dest.id, location: "Gulmarg", amenities: ["Spa", "Heating"] } });
  const deluxe = await db.hotelRoom.create({ data: { hotelId: hotel.id, name: "Deluxe", capacity: 2, inventory: 10, baseRate: 10000, mealPlans: ["CP", "MAP"] } });
  const suite = await db.hotelRoom.create({ data: { hotelId: hotel.id, name: "Suite", capacity: 4, inventory: 2, baseRate: 25000, mealPlans: ["MAP"] } });
  await db.agentHotel.create({ data: { agencyId: w.A.agency.id, hotelId: hotel.id } });
  await db.hotelRate.create({ data: { roomId: deluxe.id, agencyId: w.A.agency.id, rate: 8000 } });
  gulmarg = { hotel, deluxe, suite };

  const t = await core.startTrip(w.A.actor, { primaryGuestId: w.guestA.id, guestIds: [], adults: 3, children: 0, infants: 0 });
  tripId = t.id;
  await core.updateDates(w.A.actor, tripId, { startDate: start, endDate: addDays(start, 5) });
  await core.setDestinations(w.A.actor, tripId, {
    destinations: [
      { name: "Srinagar", destinationId: null, nights: 3 },
      { name: "Gulmarg", destinationId: dest.id, nights: 2 },
    ],
  });
});

const sxr = () => ({ checkIn: start, checkOut: addDays(start, 3) });
const gul = () => ({ checkIn: addDays(start, 3), checkOut: addDays(start, 5) });

describe("planning a stay", () => {
  it("agents only see assigned hotels, at their own rate", async () => {
    const list = await hotels.listAgentHotels(w.A.actor);
    const names = list.map((h) => h.name);
    expect(names).toContain("Snow Peak");
    expect(names).not.toContain("Hotel B Only");
    const shared = list.find((h) => h.id === w.shared.hotel.id)!;
    expect(shared.rooms[0].rate).toBe(7200); // A's negotiated rate, never B's 7,500
    expect(JSON.stringify(list)).not.toMatch(/baseRate|7500/);
  });

  it("saves a hotel with rooms in one step, priced on the server", async () => {
    const r = await lines.planStay(w.A.actor, tripId, {
      stayId: null,
      hotelId: w.shared.hotel.id,
      ...sxr(),
      // Extra fields such as a client price are ignored.
      rooms: [{ roomId: w.shared.room.id, quantity: 2, guests: 3, mealPlan: "CP", nightlyRate: 1, amount: 1 }],
    });
    expect(r.created).toBe(true);
    const rooms = await db.tripRoom.findMany({ where: { tripHotelId: r.stayId } });
    expect(rooms).toHaveLength(1);
    expect(rooms[0].nightlyRate).toBe(7200);
    expect(rooms[0].quantity).toBe(2);
    const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId } });
    expect(trip.totalAmount).toBe(7200 * 2 * 3);
  });

  it("never duplicates a stay on retry or double submit, and replaces rooms instead of appending", async () => {
    const input = { stayId: null, hotelId: w.shared.hotel.id, ...sxr(), rooms: [{ roomId: w.shared.room.id, quantity: 1, guests: 3, mealPlan: "MAP" as const }] };
    await Promise.all([lines.planStay(w.A.actor, tripId, input), lines.planStay(w.A.actor, tripId, input)]);
    await lines.planStay(w.A.actor, tripId, input);
    const stays = await db.tripHotel.findMany({ where: { tripId }, include: { rooms: true } });
    expect(stays).toHaveLength(1);
    expect(stays[0].rooms).toHaveLength(1);
    expect(stays[0].rooms[0]).toMatchObject({ quantity: 1, mealPlan: "MAP", nightlyRate: 7200 });
  });

  it("supports a different hotel per destination with multiple room types, and totals stay consistent", async () => {
    await lines.planStay(w.A.actor, tripId, {
      stayId: null,
      hotelId: gulmarg.hotel.id,
      ...gul(),
      rooms: [
        { roomId: gulmarg.deluxe.id, quantity: 1, guests: 2, mealPlan: "CP" },
        { roomId: gulmarg.suite.id, quantity: 1, guests: 1, mealPlan: "MAP" },
      ],
    });
    const { trip, total, lines: priced } = await queries.getTrip(w.A.actor, tripId);
    expect(trip.hotels.map((h) => h.hotel.name)).toEqual(["Shared Hotel", "Snow Peak"]);
    const expected = 7200 * 1 * 3 + 8000 * 1 * 2 + 25000 * 1 * 2; // agency rate for Deluxe, base rate for Suite
    expect(total).toBe(expected);
    expect(groupTotals(priced).Hotels).toBe(expected);
    expect((await db.trip.findUniqueOrThrow({ where: { id: tripId } })).totalAmount).toBe(expected);
    expect(stepAttention(trip)[4]).toBeUndefined();
  });

  it("replaces the hotel for a destination, cleaning up the old stay and its itinerary items", async () => {
    await itin.generateItinerary(w.A.actor, tripId);
    const old = await db.tripHotel.findFirstOrThrow({ where: { tripId, hotelId: w.shared.hotel.id } });
    expect(await db.itineraryItem.count({ where: { tripId, sourceId: old.id } })).toBeGreaterThan(0);
    const r = await lines.planStay(w.A.actor, tripId, { stayId: old.id, hotelId: w.hotelA.hotel.id, ...sxr(), rooms: [{ roomId: w.hotelA.room.id, quantity: 1, guests: 3, mealPlan: "CP" }] });
    expect(r.replaced).toBe(true);
    expect(await db.tripHotel.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await db.itineraryItem.count({ where: { tripId, sourceId: old.id } })).toBe(0);
    expect(await db.itineraryItem.count({ where: { tripId, sourceId: r.stayId } })).toBeGreaterThan(0);
    expect(await db.tripHotel.count({ where: { tripId } })).toBe(2);
  });

  it("flags destinations without a stay", async () => {
    const gulStay = await db.tripHotel.findFirstOrThrow({ where: { tripId, hotelId: gulmarg.hotel.id } });
    await lines.removeStay(w.A.actor, gulStay.id);
    const { trip } = await queries.getTrip(w.A.actor, tripId);
    expect(stepAttention(trip)[4]).toContain("Gulmarg");
  });

  it("rejects over-capacity rooms and meal plans the room doesn't offer", async () => {
    await rejected(lines.planStay(w.A.actor, tripId, { stayId: null, hotelId: gulmarg.hotel.id, ...gul(), rooms: [{ roomId: gulmarg.deluxe.id, quantity: 1, guests: 3, mealPlan: "CP" }] }));
    await rejected(lines.planStay(w.A.actor, tripId, { stayId: null, hotelId: gulmarg.hotel.id, ...gul(), rooms: [{ roomId: gulmarg.suite.id, quantity: 1, guests: 2, mealPlan: "AP" }] }));
    await rejected(lines.planStay(w.A.actor, tripId, { stayId: null, hotelId: gulmarg.hotel.id, ...gul(), rooms: [] }));
    await rejected(lines.planStay(w.A.actor, tripId, { stayId: null, hotelId: gulmarg.hotel.id, checkIn: addDays(start, 4), checkOut: addDays(start, 9), rooms: [{ roomId: gulmarg.deluxe.id, quantity: 1, guests: 2, mealPlan: "CP" }] }));
    expect(await db.tripHotel.count({ where: { tripId, hotelId: gulmarg.hotel.id } })).toBe(0);
  });

  it("rejects hotels, rooms, stays and trips outside the agency", async () => {
    // Hotel not assigned to A.
    await rejected(lines.planStay(w.A.actor, tripId, { stayId: null, hotelId: w.hotelB.hotel.id, ...gul(), rooms: [{ roomId: w.hotelB.room.id, quantity: 1, guests: 2, mealPlan: "CP" }] }));
    // Assigned hotel, but a room from another hotel.
    await rejected(lines.planStay(w.A.actor, tripId, { stayId: null, hotelId: gulmarg.hotel.id, ...gul(), rooms: [{ roomId: w.hotelB.room.id, quantity: 1, guests: 2, mealPlan: "CP" }] }));
    // B can't plan stays on A's trip, nor see Snow Peak.
    await rejected(lines.planStay(w.B.actor, tripId, { stayId: null, hotelId: w.shared.hotel.id, ...sxr(), rooms: [{ roomId: w.shared.room.id, quantity: 1, guests: 2, mealPlan: "CP" }] }));
    expect((await hotels.listAgentHotels(w.B.actor)).map((h) => h.name)).not.toContain("Snow Peak");
    // B can't edit A's stay through its own trip.
    const tB = await core.startTrip(w.B.actor, { primaryGuestId: w.guestB.id, guestIds: [], adults: 2, children: 0, infants: 0 });
    await core.updateDates(w.B.actor, tB.id, { startDate: start, endDate: addDays(start, 3) });
    const aStay = await db.tripHotel.findFirstOrThrow({ where: { tripId } });
    await rejected(lines.planStay(w.B.actor, tB.id, { stayId: aStay.id, hotelId: w.shared.hotel.id, ...sxr(), rooms: [{ roomId: w.shared.room.id, quantity: 1, guests: 2, mealPlan: "CP" }] }));
    expect(await db.tripHotel.count({ where: { tripId: tB.id } })).toBe(0);
  });

  it("rejects a destination schedule longer than the trip", async () => {
    await rejected(
      core.setDestinations(w.A.actor, tripId, {
        destinations: [
          { name: "Srinagar", destinationId: null, nights: 4 },
          { name: "Gulmarg", destinationId: null, nights: 3 },
        ],
      }),
    );
    const { trip } = await queries.getTrip(w.A.actor, tripId);
    expect(trip.destinations.map((d) => d.nights)).toEqual([3, 2]);
    expect(segmentsFor(start, addDays(start, 5), trip.destinations).map((s) => [s.from, s.to])).toEqual([
      [start, addDays(start, 3)],
      [addDays(start, 3), addDays(start, 5)],
    ]);
  });
});

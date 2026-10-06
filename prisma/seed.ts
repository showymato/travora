/**
 * Development / demo seed. WIPES the database, then creates clearly fictional
 * data: 1 super admin, 3 agencies, 5 hotels with rooms and agency rates,
 * 8 itinerary templates, guests and trips in every status — with dates
 * relative to today so the dashboards always have something happening.
 *
 * Trips are built through the real service layer (the same code the UI
 * calls), so seeded data obeys every rule the app enforces.
 *
 *   npm run db:seed
 *
 * Development credentials (password for all: Travora@2026):
 *   admin@travora.local  — Super Admin
 *   demo@travora.local   — Agent, ABC Travels
 *   kashmir@travora.local, paradise@travora.local — other agencies
 */
import { PrismaClient, type HotelCategory, type MealPlan } from "@prisma/client";
import { hashPassword } from "../src/server/auth/crypto";
import type { AgentActor } from "../src/server/auth/session";
import { addDays, todayISO, toDate } from "../src/lib/dates";
import { SEED_TEMPLATES } from "./seed-templates";
import { PLANS } from "../src/lib/plans";

if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to seed demo data with NODE_ENV=production.");
  process.exit(1);
}
process.env.EMAIL_PROVIDER = "log";

const db = new PrismaClient();
export const DEV_PASSWORD = "Travora@2026";
const today = todayISO();
const day = (n: number) => addDays(today, n);

async function wipe() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}


const DESTINATIONS = [
  { name: "Srinagar", region: "Kashmir", description: "Lakes, houseboats and Mughal gardens." },
  { name: "Gulmarg", region: "Kashmir", description: "Alpine meadow and Gondola." },
  { name: "Pahalgam", region: "Kashmir", description: "Lidder valley and pine forests." },
  { name: "Sonamarg", region: "Kashmir", description: "Meadow of gold, Thajiwas glacier." },
  { name: "Leh", region: "Ladakh", description: "High-desert monasteries." },
];

type RoomSeed = { name: string; description: string; capacity: number; bedConfig: string; inventory: number; baseRate: number; mealPlans: MealPlan[]; amenities: string[] };
type HotelSeed = { name: string; category: HotelCategory; destination: string; location: string; address: string; lat: number; lng: number; phone: string; email: string; website: string; description: string; amenities: string[]; checkIn: string; checkOut: string; policy: string; rooms: RoomSeed[] };

const HOTELS: HotelSeed[] = [
  {
    name: "Blanco Hotel",
    category: "FIVE_STAR",
    destination: "Srinagar",
    location: "Srinagar, Boulevard Road",
    address: "Boulevard Road, Dalgate, Srinagar 190001",
    lat: 34.0837,
    lng: 74.8371,
    phone: "+91 194 250 0100",
    email: "reservations@blanco.example",
    website: "https://blanco.example",
    description: "A lakeside five-star on Boulevard Road with views across Dal Lake to the Zabarwan hills.",
    amenities: ["Wi-Fi", "Restaurant", "Spa", "Lake view", "Room service", "Airport shuttle", "Heating", "Parking"],
    checkIn: "14:00",
    checkOut: "11:00",
    policy: "Free cancellation up to 15 days before arrival; 50% charge 7–14 days; non-refundable within 7 days.",
    rooms: [
      { name: "Deluxe", description: "32 m² with garden or partial lake view.", capacity: 3, bedConfig: "1 king or 2 twin", inventory: 24, baseRate: 8000, mealPlans: ["EP", "CP", "MAP"], amenities: ["Heating", "Tea/coffee", "Rain shower"] },
      { name: "Premium", description: "38 m² with full lake view and window seat.", capacity: 3, bedConfig: "1 king", inventory: 14, baseRate: 11500, mealPlans: ["CP", "MAP", "AP"], amenities: ["Lake view", "Bathtub", "Minibar"] },
      { name: "Suite", description: "70 m² suite with separate living room and balcony.", capacity: 4, bedConfig: "1 king + sofa bed", inventory: 4, baseRate: 22000, mealPlans: ["CP", "MAP", "AP"], amenities: ["Balcony", "Butler", "Lake view"] },
    ],
  },
  {
    name: "Hotel Grand",
    category: "FOUR_STAR",
    destination: "Srinagar",
    location: "Srinagar, Rajbagh",
    address: "Rajbagh, Srinagar 190008",
    lat: 34.0679,
    lng: 74.8233,
    phone: "+91 194 247 1200",
    email: "stay@hotelgrand.example",
    website: "https://hotelgrand.example",
    description: "A comfortable city hotel close to the river Jhelum and Lal Chowk.",
    amenities: ["Wi-Fi", "Restaurant", "Room service", "Parking", "Heating", "Family rooms"],
    checkIn: "13:00",
    checkOut: "11:00",
    policy: "Free cancellation up to 7 days before arrival.",
    rooms: [
      { name: "Superior", description: "26 m² city-view room.", capacity: 3, bedConfig: "1 queen or 2 twin", inventory: 30, baseRate: 5200, mealPlans: ["EP", "CP", "MAP"], amenities: ["Heating", "Work desk"] },
      { name: "Family Room", description: "Two connected rooms for families.", capacity: 5, bedConfig: "1 king + 2 twin", inventory: 8, baseRate: 8800, mealPlans: ["CP", "MAP"], amenities: ["Connecting rooms", "Heating"] },
    ],
  },
  {
    name: "Royal Kashmir",
    category: "LUXURY",
    destination: "Gulmarg",
    location: "Gulmarg, Upper Meadow",
    address: "Upper Meadow, Gulmarg 193403",
    lat: 34.0484,
    lng: 74.3805,
    phone: "+91 195 425 4400",
    email: "hello@royalkashmir.example",
    website: "https://royalkashmir.example",
    description: "A luxury lodge on the meadow, a short walk from the Gondola base station.",
    amenities: ["Wi-Fi", "Spa", "Restaurant", "Bar", "Mountain view", "Fireplace", "Ski storage", "Heating"],
    checkIn: "14:00",
    checkOut: "11:00",
    policy: "Free cancellation up to 21 days before arrival; non-refundable within 7 days.",
    rooms: [
      { name: "Deluxe Mountain View", description: "Meadow-facing room with fireplace.", capacity: 3, bedConfig: "1 king", inventory: 18, baseRate: 14000, mealPlans: ["CP", "MAP"], amenities: ["Fireplace", "Mountain view"] },
      { name: "Chalet", description: "Private two-room chalet.", capacity: 4, bedConfig: "1 king + 2 twin", inventory: 6, baseRate: 26000, mealPlans: ["MAP", "AP"], amenities: ["Private deck", "Fireplace"] },
    ],
  },
  {
    name: "Mountain View",
    category: "FOUR_STAR",
    destination: "Pahalgam",
    location: "Pahalgam, Lidder Riverside",
    address: "Laripora Road, Pahalgam 192126",
    lat: 34.0161,
    lng: 75.3150,
    phone: "+91 193 624 3300",
    email: "front@mountainview.example",
    website: "https://mountainview.example",
    description: "Riverside rooms facing the pine forests of the Lidder valley.",
    amenities: ["Wi-Fi", "Restaurant", "Garden", "Mountain view", "Parking", "Heating"],
    checkIn: "14:00",
    checkOut: "10:00",
    policy: "Free cancellation up to 10 days before arrival.",
    rooms: [
      { name: "Deluxe", description: "Valley-view room with balcony.", capacity: 3, bedConfig: "1 king or 2 twin", inventory: 20, baseRate: 6500, mealPlans: ["CP", "MAP"], amenities: ["Balcony", "Heating"] },
      { name: "Riverside Cottage", description: "Standalone cottage on the river bank.", capacity: 4, bedConfig: "1 king + sofa bed", inventory: 6, baseRate: 12000, mealPlans: ["MAP", "AP"], amenities: ["River view", "Sit-out"] },
    ],
  },
  {
    name: "Pine Retreat",
    category: "BOUTIQUE",
    destination: "Sonamarg",
    location: "Sonamarg, Thajiwas Road",
    address: "Thajiwas Road, Sonamarg 191202",
    lat: 34.3036,
    lng: 75.2932,
    phone: "+91 194 241 7700",
    email: "stay@pineretreat.example",
    website: "https://pineretreat.example",
    description: "Twelve-room boutique lodge at the foot of the Thajiwas glacier trail.",
    amenities: ["Wi-Fi", "Restaurant", "Mountain view", "Garden", "Heating"],
    checkIn: "13:00",
    checkOut: "11:00",
    policy: "Free cancellation up to 14 days before arrival.",
    rooms: [{ name: "Glacier Room", description: "Pine-panelled room with glacier view.", capacity: 2, bedConfig: "1 queen", inventory: 12, baseRate: 7200, mealPlans: ["CP", "MAP"], amenities: ["Glacier view"] }],
  },
];

async function main() {
  console.log(`[seed] wiping database… (today = ${today})`);
  await wipe();

  for (const [i, p] of PLANS.entries()) await db.subscriptionPlan.create({ data: { ...p, features: [...p.features], sortOrder: i } });
  for (const d of DESTINATIONS) await db.destination.create({ data: d });

  const passwordHash = await hashPassword(DEV_PASSWORD);
  const admin = await db.user.create({ data: { email: "admin@travora.local", name: "Aisha Khan", role: "SUPER_ADMIN", passwordHash } });

  // ---- Agencies --------------------------------------------------------------
  const agencySpecs = [
    { name: "ABC Travels", ownerName: "Rahul Verma", email: "demo@travora.local", phone: "+91 98100 11223", city: "New Delhi", state: "Delhi", gst: "07AABCA1234F1Z5", plan: "PROFESSIONAL", status: "ACTIVE", ageDays: 120 },
    { name: "Kashmir Holidays", ownerName: "Irfan Bhat", email: "kashmir@travora.local", phone: "+91 94190 55667", city: "Srinagar", state: "Jammu & Kashmir", gst: "01AAKCK5678L1Z2", plan: "GROWTH", status: "ACTIVE", ageDays: 75 },
    { name: "Paradise Tours", ownerName: "Sana Kapoor", email: "paradise@travora.local", phone: "+91 99870 33445", city: "Mumbai", state: "Maharashtra", gst: "", plan: "STARTER", status: "TRIAL", ageDays: 6 },
  ] as const;
  const agencies: Record<string, { id: string; actor: AgentActor }> = {};
  for (const a of agencySpecs) {
    const plan = await db.subscriptionPlan.findUniqueOrThrow({ where: { code: a.plan } });
    const created = new Date(Date.now() - a.ageDays * 86_400_000);
    const agency = await db.agency.create({
      data: {
        name: a.name,
        slug: a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        ownerName: a.ownerName,
        email: a.email,
        phone: a.phone,
        city: a.city,
        state: a.state,
        country: "India",
        gstNumber: a.gst || null,
        address: `${a.city}, ${a.state}`,
        supportEmail: a.email.replace("@travora.local", "@agency.example"),
        supportPhone: a.phone,
        status: a.status,
        createdAt: created,
      },
    });
    const user = await db.user.create({ data: { email: a.email, name: a.ownerName, phone: a.phone, role: "AGENT", agencyId: agency.id, passwordHash, lastLoginAt: new Date() } });
    await db.subscription.create({
      data: {
        agencyId: agency.id,
        planId: plan.id,
        status: a.status === "TRIAL" ? "TRIALING" : "ACTIVE",
        currentPeriodStart: new Date(Date.now() - 10 * 86_400_000),
        currentPeriodEnd: new Date(Date.now() + (a.status === "TRIAL" ? 4 : 20) * 86_400_000),
        trialEndsAt: a.status === "TRIAL" ? new Date(Date.now() + 4 * 86_400_000) : null,
      },
    });
    await db.auditLog.create({ data: { action: "agency.created", entity: "Agency", entityId: agency.id, agencyId: agency.id, userId: admin.id, userName: admin.name, summary: `Created agency ${a.name} on the ${plan.name} plan`, createdAt: created } });
    agencies[a.name] = { id: agency.id, actor: { kind: "AGENT", userId: user.id, name: user.name, email: user.email, agencyId: agency.id, agencyName: agency.name } };
  }

  // ---- Hotels, rooms, rates, assignments ----------------------------------------
  const hotelIds: Record<string, { id: string; rooms: Record<string, string> }> = {};
  for (const h of HOTELS) {
    const dest = await db.destination.findUniqueOrThrow({ where: { name: h.destination } });
    const hotel = await db.hotel.create({
      data: {
        name: h.name,
        slug: h.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        category: h.category,
        destinationId: dest.id,
        location: h.location,
        address: h.address,
        latitude: h.lat,
        longitude: h.lng,
        phone: h.phone,
        email: h.email,
        website: h.website,
        description: h.description,
        amenities: h.amenities,
        checkInTime: h.checkIn,
        checkOutTime: h.checkOut,
        cancellationPolicy: h.policy,
      },
    });
    const rooms: Record<string, string> = {};
    for (const [i, r] of h.rooms.entries()) {
      const room = await db.hotelRoom.create({ data: { ...r, hotelId: hotel.id, sortOrder: i } });
      rooms[r.name] = room.id;
    }
    hotelIds[h.name] = { id: hotel.id, rooms };
  }
  const assign: Record<string, string[]> = {
    "ABC Travels": ["Blanco Hotel", "Hotel Grand", "Royal Kashmir", "Mountain View", "Pine Retreat"],
    "Kashmir Holidays": ["Blanco Hotel", "Hotel Grand", "Mountain View"],
    "Paradise Tours": ["Hotel Grand", "Mountain View"],
  };
  for (const [agency, hotels] of Object.entries(assign)) {
    await db.agentHotel.createMany({ data: hotels.map((h) => ({ agencyId: agencies[agency].id, hotelId: hotelIds[h].id, assignedById: admin.id })) });
  }
  // Negotiated rates — each agency sees only its own.
  const rates: [string, string, string, number][] = [
    ["ABC Travels", "Blanco Hotel", "Deluxe", 7200],
    ["ABC Travels", "Blanco Hotel", "Premium", 10400],
    ["ABC Travels", "Royal Kashmir", "Deluxe Mountain View", 12600],
    ["ABC Travels", "Mountain View", "Deluxe", 5900],
    ["Kashmir Holidays", "Blanco Hotel", "Deluxe", 7500],
    ["Kashmir Holidays", "Mountain View", "Deluxe", 6100],
  ];
  for (const [agency, hotel, room, rate] of rates) {
    await db.hotelRate.create({ data: { agencyId: agencies[agency].id, roomId: hotelIds[hotel].rooms[room], rate } });
  }

  // ---- Templates -------------------------------------------------------------
  for (const t of SEED_TEMPLATES) {
    await db.itineraryTemplate.create({
      data: {
        name: t.name,
        description: t.description,
        destination: t.destination,
        nights: t.nights,
        tags: t.tags,
        createdById: admin.id,
        days: {
          create: t.days.slice(0, t.nights + 1).map((d, i) => ({
            dayNumber: i + 1,
            title: d.title,
            summary: d.summary ?? null,
            items: { create: d.items.map(([time, type, title, location, description, durationMins], p) => ({ position: p, time, type, title, location: location ?? null, description: description ?? null, durationMins: durationMins ?? null })) },
          })),
        },
      },
    });
  }

  // ---- Guests ------------------------------------------------------------------
  const svc = {
    guests: await import("../src/server/guests"),
    core: await import("../src/server/trips/core"),
    lines: await import("../src/server/trips/lines"),
    itin: await import("../src/server/trips/itinerary"),
    publish: await import("../src/server/trips/publish"),
    payments: await import("../src/server/payments"),
    docs: await import("../src/server/documents/service"),
  };
  const g = async (agency: string, fullName: string, extra: Partial<Record<string, string>> = {}) =>
    svc.guests.createGuest(agencies[agency].actor, {
      fullName,
      phone: extra.phone ?? "",
      email: extra.email ?? "",
      whatsapp: extra.whatsapp ?? extra.phone ?? "",
      nationality: extra.nationality ?? "Indian",
      dateOfBirth: extra.dob ?? "",
      gender: extra.gender ?? "",
      address: extra.address ?? "",
      idType: extra.idType ?? "",
      idNumber: extra.idNumber ?? "",
      notes: extra.notes ?? "",
    });

  const abc = "ABC Travels";
  const amit = await g(abc, "Amit Gupta", { phone: "+91 98111 20001", email: "amit.gupta@example.com", gender: "MALE", dob: "1984-03-12", idType: "AADHAAR", idNumber: "4321 8765 0001", address: "Saket, New Delhi" });
  const ritu = await g(abc, "Ritu Gupta", { phone: "+91 98111 20002", gender: "FEMALE", dob: "1987-07-02" });
  const priya = await g(abc, "Priya Singh", { phone: "+91 98111 20003", email: "priya.singh@example.com", gender: "FEMALE", dob: "1995-11-20", idType: "PASSPORT", idNumber: "Z1234567", notes: "Honeymoon — requested a lake-view room and a cake on the first night." });
  const arjun = await g(abc, "Arjun Singh", { phone: "+91 98111 20004", gender: "MALE" });
  const kabir = await g(abc, "Kabir Malhotra", { phone: "+91 98111 20005", email: "kabir.m@example.com", gender: "MALE", idType: "PAN", idNumber: "ABCPM1234K" });
  const meera = await g(abc, "Meera Nair", { phone: "+91 98111 20006", gender: "FEMALE", notes: "Vegetarian; prefers ground-floor rooms." });
  const ananya = await g(abc, "Ananya Iyer", { phone: "+91 98111 20007", email: "ananya.iyer@example.com", gender: "FEMALE" });
  const farhan = await g(abc, "Farhan Qureshi", { phone: "+91 98111 20008", email: "farhan.q@example.com", gender: "MALE" });
  const sneha = await g(abc, "Sneha Kulkarni", { phone: "+91 98111 20009", email: "sneha.k@example.com", gender: "FEMALE" });
  const vikram = await g(abc, "Vikram Rao", { phone: "+91 98111 20010", email: "vikram.rao@example.com", gender: "MALE" });
  await g(abc, "Neha Rao", { phone: "+91 98111 20011", gender: "FEMALE" });
  await g(abc, "Devika Menon", { email: "devika.menon@example.com", gender: "FEMALE" });

  const kh = "Kashmir Holidays";
  const zoya = await g(kh, "Zoya Mir", { phone: "+91 94190 70001", email: "zoya.mir@example.com", gender: "FEMALE" });
  const harsh = await g(kh, "Harsh Vardhan", { phone: "+91 94190 70002", email: "harsh.v@example.com", gender: "MALE" });
  const pt = "Paradise Tours";
  const lata = await g(pt, "Lata Deshpande", { phone: "+91 99870 80001", email: "lata.d@example.com", gender: "FEMALE" });

  // ---- Trips -------------------------------------------------------------------
  type Stay = { hotel: string; room: string; nights: number; qty?: number; guests?: number; meal?: MealPlan; confirmed?: string };
  type TripSpec = {
    agency: string;
    guest: { id: string };
    others?: { id: string }[];
    adults: number;
    children?: number;
    start: number;
    stays: Stay[];
    destinations: string[];
    transports?: { day: number; time: string; kind: "AIRPORT_TRANSFER" | "INTERCITY" | "LOCAL" | "CUSTOM"; pickup: string; dropoff: string; vehicle?: string; driver?: string; driverPhone?: string; number?: string; price: number }[];
    activities?: { day: number; time: string; kind: "SIGHTSEEING" | "ACTIVITY" | "EXPERIENCE" | "MEAL"; title: string; location: string; duration: number; price: number; description?: string }[];
    template?: string;
    finalStatus: "DRAFT" | "PLANNING" | "READY" | "SENT" | "CONFIRMED" | "CANCELLED";
    payments?: { amount: number; daysAgo: number; method: "UPI" | "BANK_TRANSFER" | "CARD" | "CASH"; ref: string }[];
    docs?: ("ITINERARY" | "HOTEL_VOUCHER" | "INVOICE" | "TRANSPORT_VOUCHER" | "TRIP_CONFIRMATION")[];
    title?: string;
  };

  async function buildTrip(spec: TripSpec) {
    const actor = agencies[spec.agency].actor;
    const trip = await svc.core.startTrip(actor, { primaryGuestId: spec.guest.id, guestIds: (spec.others ?? []).map((o) => o.id), adults: spec.adults, children: spec.children ?? 0, infants: 0 });
    if (spec.finalStatus === "DRAFT" && !spec.stays.length) return trip;
    const nights = spec.stays.reduce((s, x) => s + x.nights, 0);
    const start = day(spec.start);
    await svc.core.updateDates(actor, trip.id, { startDate: start, endDate: addDays(start, nights) });
    await svc.core.setDestinations(actor, trip.id, { destinations: spec.destinations.map((name, i) => ({ name, destinationId: null, nights: spec.stays[i]?.nights ?? null })) });
    if (spec.title) await svc.core.updateTripMeta(actor, trip.id, { title: spec.title });
    let cursor = start;
    for (const s of spec.stays) {
      const out = addDays(cursor, s.nights);
      const stay = await svc.lines.addStay(actor, trip.id, { hotelId: hotelIds[s.hotel].id, checkIn: cursor, checkOut: out });
      await svc.lines.addStayRoom(actor, stay.id, { roomId: hotelIds[s.hotel].rooms[s.room], quantity: s.qty ?? 1, guests: s.guests ?? 2, mealPlan: s.meal ?? "CP", checkIn: cursor, checkOut: out });
      if (s.confirmed) await svc.lines.updateStay(actor, stay.id, { checkIn: cursor, checkOut: out, confirmationStatus: "CONFIRMED", confirmationNumber: s.confirmed, notes: "" });
      cursor = out;
    }
    for (const t of spec.transports ?? []) {
      await svc.lines.saveTransport(actor, trip.id, null, { kind: t.kind, date: addDays(start, t.day), time: t.time, pickup: t.pickup, dropoff: t.dropoff, vehicle: t.vehicle ?? "", driverName: t.driver ?? "", driverPhone: t.driverPhone ?? "", vehicleNumber: t.number ?? "", notes: "", price: t.price, addToItinerary: true });
    }
    for (const a of spec.activities ?? []) {
      await svc.lines.saveActivity(actor, trip.id, null, { kind: a.kind, date: addDays(start, a.day), time: a.time, title: a.title, location: a.location, description: a.description ?? "", durationMins: a.duration, notes: "", price: a.price, addToItinerary: true });
    }
    if (spec.finalStatus === "DRAFT") return trip;
    const templateId = spec.template ? (await db.itineraryTemplate.findFirstOrThrow({ where: { name: spec.template } })).id : null;
    await svc.itin.generateItinerary(actor, trip.id, { templateId });
    if (spec.finalStatus === "READY") await svc.core.setTripStatus(actor, trip.id, "READY");
    if (["SENT", "CONFIRMED", "CANCELLED"].includes(spec.finalStatus)) {
      await svc.publish.sendTrip(actor, trip.id, { email: true, message: "" });
      if (spec.finalStatus === "CONFIRMED") await svc.publish.confirmTrip(actor, trip.id, false);
      if (spec.finalStatus === "CANCELLED") await svc.core.setTripStatus(actor, trip.id, "CANCELLED");
    }
    for (const p of spec.payments ?? []) {
      await svc.payments.recordPayment(actor, trip.id, { amount: p.amount, paidAt: day(-p.daysAgo), method: p.method, reference: p.ref, notes: "", notifyGuest: false });
    }
    for (const kind of spec.docs ?? []) await svc.docs.generateDocument(actor, trip.id, kind);
    return trip;
  }

  // ABC Travels — a realistic week.
  await buildTrip({
    agency: abc,
    guest: amit,
    others: [ritu],
    adults: 2,
    children: 2,
    start: -2,
    title: "Gupta family — Kashmir",
    destinations: ["Srinagar", "Gulmarg"],
    stays: [
      { hotel: "Hotel Grand", room: "Family Room", nights: 2, guests: 4, meal: "MAP", confirmed: "HG-55812" },
      { hotel: "Royal Kashmir", room: "Deluxe Mountain View", nights: 3, qty: 2, guests: 4, meal: "MAP", confirmed: "RK-20931" },
    ],
    transports: [
      { day: 0, time: "10:30", kind: "AIRPORT_TRANSFER", pickup: "Srinagar Airport", dropoff: "Hotel Grand", vehicle: "Toyota Innova Crysta", driver: "Bashir Ahmad", driverPhone: "+91 94191 10001", number: "JK01 AB 4521", price: 1800 },
      { day: 2, time: "10:00", kind: "INTERCITY", pickup: "Hotel Grand", dropoff: "Royal Kashmir, Gulmarg", vehicle: "Toyota Innova Crysta", driver: "Bashir Ahmad", driverPhone: "+91 94191 10001", number: "JK01 AB 4521", price: 3500 },
      { day: 5, time: "09:30", kind: "AIRPORT_TRANSFER", pickup: "Royal Kashmir, Gulmarg", dropoff: "Srinagar Airport", vehicle: "Toyota Innova Crysta", price: 3800 },
    ],
    activities: [
      { day: 0, time: "17:00", kind: "ACTIVITY", title: "Shikara ride on Dal Lake", location: "Dal Lake", duration: 60, price: 1200 },
      { day: 1, time: "10:00", kind: "SIGHTSEEING", title: "Mughal gardens tour", location: "Srinagar", duration: 240, price: 0 },
      { day: 2, time: "15:00", kind: "ACTIVITY", title: "Gulmarg Gondola — Phase 1", location: "Gulmarg", duration: 120, price: 3600 },
      { day: 3, time: "11:00", kind: "EXPERIENCE", title: "Snow play at Kongdoori", location: "Gulmarg", duration: 180, price: 0 },
    ],
    finalStatus: "CONFIRMED",
    payments: [
      { amount: 50000, daysAgo: 20, method: "BANK_TRANSFER", ref: "NEFT-882301" },
      { amount: 40000, daysAgo: 4, method: "UPI", ref: "UPI-4410029" },
    ],
    docs: ["ITINERARY", "HOTEL_VOUCHER", "INVOICE"],
  });

  await buildTrip({
    agency: abc,
    guest: priya,
    others: [arjun],
    adults: 2,
    start: 0,
    template: "Kashmir Honeymoon",
    title: "Priya & Arjun — Honeymoon",
    destinations: ["Srinagar", "Gulmarg", "Pahalgam"],
    stays: [
      { hotel: "Blanco Hotel", room: "Premium", nights: 2, meal: "MAP", confirmed: "BL-77120" },
      { hotel: "Royal Kashmir", room: "Deluxe Mountain View", nights: 1, meal: "MAP", confirmed: "RK-20977" },
      { hotel: "Mountain View", room: "Riverside Cottage", nights: 2, meal: "MAP" },
    ],
    transports: [
      { day: 0, time: "09:30", kind: "AIRPORT_TRANSFER", pickup: "Srinagar Airport", dropoff: "Blanco Hotel", vehicle: "Honda City", driver: "Mohammad Yousuf", driverPhone: "+91 94191 20002", number: "JK01 CD 7788", price: 1500 },
      { day: 2, time: "09:30", kind: "INTERCITY", pickup: "Blanco Hotel", dropoff: "Royal Kashmir, Gulmarg", vehicle: "Honda City", driver: "Mohammad Yousuf", driverPhone: "+91 94191 20002", number: "JK01 CD 7788", price: 3200 },
      { day: 3, time: "09:00", kind: "INTERCITY", pickup: "Royal Kashmir, Gulmarg", dropoff: "Mountain View, Pahalgam", vehicle: "Honda City", price: 5200 },
    ],
    activities: [{ day: 0, time: "17:30", kind: "EXPERIENCE", title: "Private sunset shikara with kahwa", location: "Dal Lake", duration: 90, price: 2500, description: "Private shikara with Kashmiri kahwa and snacks." }],
    finalStatus: "CONFIRMED",
    payments: [{ amount: 60000, daysAgo: 12, method: "CARD", ref: "CARD-0921" }],
    docs: ["ITINERARY", "TRIP_CONFIRMATION"],
  });

  await buildTrip({
    agency: abc,
    guest: kabir,
    adults: 2,
    start: 1,
    destinations: ["Srinagar", "Pahalgam"],
    stays: [
      { hotel: "Blanco Hotel", room: "Deluxe", nights: 2, meal: "CP" },
      { hotel: "Mountain View", room: "Deluxe", nights: 2, meal: "MAP", confirmed: "MV-11902" },
    ],
    transports: [
      { day: 0, time: "11:45", kind: "AIRPORT_TRANSFER", pickup: "Srinagar Airport", dropoff: "Blanco Hotel", vehicle: "Toyota Etios", price: 1500 },
      { day: 2, time: "10:00", kind: "INTERCITY", pickup: "Blanco Hotel", dropoff: "Mountain View, Pahalgam", price: 3400 },
    ],
    finalStatus: "SENT",
    payments: [{ amount: 15000, daysAgo: 6, method: "UPI", ref: "UPI-7781022" }],
  });

  await buildTrip({
    agency: abc,
    guest: meera,
    adults: 3,
    start: 10,
    template: "Kashmir 6N / 7D",
    destinations: ["Srinagar", "Gulmarg", "Pahalgam"],
    stays: [
      { hotel: "Hotel Grand", room: "Superior", nights: 2, qty: 2, guests: 3, meal: "MAP" },
      { hotel: "Royal Kashmir", room: "Deluxe Mountain View", nights: 2, qty: 2, guests: 3, meal: "MAP" },
      { hotel: "Mountain View", room: "Deluxe", nights: 2, qty: 2, guests: 3, meal: "MAP" },
    ],
    finalStatus: "PLANNING",
  });

  await buildTrip({
    agency: abc,
    guest: ananya,
    adults: 2,
    start: 25,
    destinations: ["Srinagar", "Sonamarg"],
    stays: [
      { hotel: "Blanco Hotel", room: "Suite", nights: 3, meal: "AP" },
      { hotel: "Pine Retreat", room: "Glacier Room", nights: 2, meal: "MAP" },
    ],
    finalStatus: "READY",
  });

  await buildTrip({
    agency: abc,
    guest: farhan,
    adults: 2,
    start: -40,
    destinations: ["Srinagar", "Gulmarg"],
    stays: [
      { hotel: "Blanco Hotel", room: "Deluxe", nights: 3, meal: "CP", confirmed: "BL-60011" },
      { hotel: "Royal Kashmir", room: "Deluxe Mountain View", nights: 2, meal: "MAP", confirmed: "RK-18800" },
    ],
    transports: [{ day: 0, time: "13:00", kind: "AIRPORT_TRANSFER", pickup: "Srinagar Airport", dropoff: "Blanco Hotel", vehicle: "Toyota Innova", driver: "Ghulam Nabi", driverPhone: "+91 94191 30003", number: "JK01 EF 1200", price: 1800 }],
    finalStatus: "CONFIRMED",
    payments: [{ amount: 72000, daysAgo: 50, method: "BANK_TRANSFER", ref: "NEFT-551200" }],
  });

  await buildTrip({ agency: abc, guest: sneha, adults: 2, start: 30, destinations: [], stays: [], finalStatus: "DRAFT" });

  await buildTrip({
    agency: abc,
    guest: vikram,
    adults: 2,
    start: 18,
    destinations: ["Srinagar"],
    stays: [{ hotel: "Hotel Grand", room: "Superior", nights: 3, meal: "CP" }],
    finalStatus: "CANCELLED",
  });

  // Other agencies (for the admin views — and the tenant-isolation tests).
  await buildTrip({
    agency: kh,
    guest: zoya,
    adults: 2,
    start: 3,
    destinations: ["Srinagar", "Pahalgam"],
    stays: [
      { hotel: "Blanco Hotel", room: "Deluxe", nights: 2, meal: "MAP", confirmed: "BL-80020" },
      { hotel: "Mountain View", room: "Deluxe", nights: 3, meal: "MAP" },
    ],
    transports: [{ day: 0, time: "12:15", kind: "AIRPORT_TRANSFER", pickup: "Srinagar Airport", dropoff: "Blanco Hotel", vehicle: "Toyota Innova", price: 1600 }],
    finalStatus: "CONFIRMED",
    payments: [{ amount: 30000, daysAgo: 8, method: "UPI", ref: "UPI-9001" }],
  });
  await buildTrip({ agency: kh, guest: harsh, adults: 4, start: 15, template: "Kashmir 5N / 6D", destinations: ["Srinagar", "Gulmarg", "Pahalgam"], stays: [{ hotel: "Hotel Grand", room: "Family Room", nights: 5, guests: 4, meal: "MAP" }], finalStatus: "PLANNING" });
  await buildTrip({ agency: pt, guest: lata, adults: 2, start: 7, destinations: ["Srinagar", "Pahalgam"], stays: [{ hotel: "Hotel Grand", room: "Superior", nights: 2 }, { hotel: "Mountain View", room: "Deluxe", nights: 2 }], finalStatus: "SENT" });

  const { rollStatuses } = svc.core;
  await rollStatuses(toDate(today));

  // A few platform notifications so the bell isn't empty on first sign-in.
  await db.notification.create({ data: { userId: admin.id, type: "agency.created", title: "New agency: Paradise Tours", body: "Sana Kapoor · Starter plan (trial)", href: `/admin/agents/${agencies[pt].id}` } });
  await db.notification.create({ data: { userId: admin.id, type: "subscription.trial_ending", title: "Paradise Tours trial ends in 4 days", href: "/admin/subscriptions" } });

  const counts = await Promise.all([db.agency.count(), db.hotel.count(), db.guest.count(), db.trip.count(), db.itineraryItem.count(), db.document.count()]);
  console.log(`[seed] agencies ${counts[0]}, hotels ${counts[1]}, guests ${counts[2]}, trips ${counts[3]}, itinerary items ${counts[4]}, documents ${counts[5]}`);
  console.log(`[seed] sign in: admin@travora.local / demo@travora.local — password ${DEV_PASSWORD} (development only)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

// Fictional demo trip used across the marketing page. Shaped like the real trip
// model (status enum, ISO dates, itinerary item types, whole-rupee money) and
// formatted with the same helpers the product uses, so the previews read exactly
// like the app. Hotel and agency names match the dev seed (prisma/seed.ts).
import { fmtRange, fmtShort } from "@/lib/dates";
import { formatINRCompact, paymentSummary } from "@/lib/money";
import { travellerSummary } from "@/lib/plan";
import { TRIP_STATUS_LABEL, type TripStatusValue } from "@/lib/labels";

export type DemoItem = { time: string; type: string; title: string; detail: string };

const status: TripStatusValue = "CONFIRMED";
const payments = [{ amount: 80_000 }, { amount: 40_000 }];
const total = 160_000;

export const TRIP = {
  code: "TRV-10291",
  title: "Kashmir, slowly",
  status,
  statusLabel: TRIP_STATUS_LABEL[status],
  guest: { name: "Rahul Sharma", phone: "+91 98•• ••• 214" },
  agency: "ABC Travels",
  startDate: "2026-10-10",
  endDate: "2026-10-16",
  destinations: ["Srinagar", "Gulmarg", "Pahalgam"],
  travelers: { adults: 4, children: 0, infants: 0 },
  hotels: [
    { name: "Blanco Hotel", city: "Srinagar", room: "Premium · lake view", nights: 2, meal: "MAP", status: "Confirmed" },
    { name: "Royal Kashmir", city: "Gulmarg", room: "Deluxe Mountain View", nights: 2, meal: "MAP", status: "Confirmed" },
    { name: "Mountain View", city: "Pahalgam", room: "Riverside Cottage", nights: 2, meal: "MAP", status: "Confirmed" },
  ],
  transport: [
    { leg: "Airport → Blanco Hotel", driver: "Bashir A. · JK01 AB 4410", ok: true },
    { leg: "Srinagar → Gulmarg", driver: "Bashir A. · JK01 AB 4410", ok: true },
    { leg: "Gulmarg → Pahalgam", driver: "Driver not assigned", ok: false },
  ],
  documents: ["Itinerary v2", "Hotel vouchers (3)", "Invoice INV-2026-0418", "Payment receipt"],
  day1: [
    { time: "09:30", type: "AIRPORT_ARRIVAL", title: "Airport pickup", detail: "Srinagar Airport → Blanco Hotel" },
    { time: "11:00", type: "HOTEL_CHECK_IN", title: "Hotel check-in", detail: "Blanco Hotel · Premium, lake view" },
    { time: "14:00", type: "ACTIVITY", title: "Dal Lake shikara ride", detail: "Private, with kahwa" },
    { time: "19:00", type: "MEAL", title: "Dinner", detail: "Kashmiri wazwan at the hotel" },
  ] satisfies DemoItem[],
} as const;

export const PAY = paymentSummary(total, payments);

export const TRIP_DATES = fmtRange(TRIP.startDate, TRIP.endDate);
export const TRIP_START = fmtShort(TRIP.startDate);
export const TRIP_TRAVELLERS = travellerSummary(TRIP.travelers.adults, TRIP.travelers.children, TRIP.travelers.infants);
export const TRIP_ROUTE = TRIP.destinations.join(" · ");

/** The "confirmed vs pending" checklist from the Trip Command Center. */
export const CHECKLIST = [
  { label: "Hotels confirmed", value: "3 / 3", ratio: 1 },
  { label: "Driver details", value: "2 / 3", ratio: 2 / 3 },
  { label: "Itinerary sent", value: "Version 2", ratio: 1 },
  { label: "Payment received", value: `${formatINRCompact(PAY.paid)} / ${formatINRCompact(PAY.total)}`, ratio: PAY.paid / PAY.total },
] as const;

export const money = formatINRCompact;

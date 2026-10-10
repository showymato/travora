import { diffDays, eachDay, fmtShort, toISO } from "@/lib/dates";
import type { TripFull } from "./queries";
import { segmentsFor } from "@/lib/plan";

/** Non-blocking review warnings: things an experienced agent would double-check. */
export function reviewWarnings(trip: TripFull): string[] {
  const out: string[] = [];
  const start = toISO(trip.startDate);
  const end = toISO(trip.endDate);
  if (!start || !end) return out;
  for (const h of trip.hotels) if (!h.rooms.length) out.push(`${h.hotel.name} has no rooms selected.`);
  // Nights not covered by any hotel.
  const nights = eachDay(start, end).slice(0, -1);
  const uncovered = nights.filter((d) => !trip.hotels.some((h) => toISO(h.checkIn)! <= d && toISO(h.checkOut)! > d));
  if (trip.hotels.length && uncovered.length) out.push(`No hotel for the night${uncovered.length === 1 ? "" : "s"} of ${uncovered.map(fmtShort).join(", ")}.`);
  // Overlapping stays.
  const sorted = [...trip.hotels].sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(toISO(sorted[i].checkIn)!, toISO(sorted[i - 1].checkOut)!) > 0) out.push(`${sorted[i - 1].hotel.name} and ${sorted[i].hotel.name} overlap.`);
  }
  const roomGuests = trip.hotels.map((h) => h.rooms.reduce((s, r) => s + r.guests, 0));
  const party = trip.adults + trip.children;
  trip.hotels.forEach((h, i) => {
    if (h.rooms.length && roomGuests[i] < party) out.push(`${h.hotel.name} rooms hold ${roomGuests[i]} guests but ${party} are travelling.`);
  });
  if (!trip.transports.some((t) => toISO(t.date) === start)) out.push("No arrival transfer on the first day.");
  if (!trip.primaryGuest?.email && !trip.primaryGuest?.phone) out.push("The primary guest has no phone or email.");
  for (const d of trip.days) for (const i of d.items) if (i.notes && /^(Add flight|Transport not)/.test(i.notes)) out.push(`Day ${d.dayNumber}: ${i.title} — ${i.notes.toLowerCase()}.`);
  return [...new Set(out)].slice(0, 12);
}

/**
 * Wizard steps that need the agent's attention, with the reason shown in the
 * stepper. Derived from the saved trip, so it is correct after any refresh.
 */
export function stepAttention(trip: TripFull): Record<number, string> {
  const out: Record<number, string> = {};
  const start = toISO(trip.startDate);
  const end = toISO(trip.endDate);
  if (!trip.primaryGuestId) out[1] = "Add the primary guest";
  if (!start || !end) {
    out[2] = "Set the travel dates";
    return out;
  }
  const nights = diffDays(start, end);
  const planned = trip.destinations.reduce((s, d) => s + (d.nights ?? 0), 0);
  if (!trip.destinations.length) out[3] = "Add destinations";
  else if (planned !== nights) out[3] = `${planned} of ${nights} nights planned`;
  if (trip.destinations.length) {
    const segs = segmentsFor(start, end, trip.destinations);
    const open = segs.filter((s) => diffDays(s.from, s.to) > 0 && !trip.hotels.some((h) => toISO(h.checkIn)! < s.to && toISO(h.checkOut)! > s.from));
    if (open.length) out[4] = `${open.map((s) => s.name).join(", ")}: no stay yet`;
  }
  const party = trip.adults + trip.children;
  const roomless = trip.hotels.filter((h) => !h.rooms.length);
  const short = trip.hotels.filter((h) => h.rooms.length && h.rooms.reduce((s, r) => s + r.guests, 0) < party);
  if (roomless.length) out[5] = `${roomless.map((h) => h.hotel.name).join(", ")}: no rooms`;
  else if (short.length) out[5] = `${short[0].hotel.name}: rooms hold fewer than ${party}`;
  const items = trip.days.flatMap((d) => d.items);
  if (!items.length) out[8] = "Itinerary not built yet";
  else {
    const gaps = items.filter((i) => i.notes && /^(Add flight|Transport not)/.test(i.notes)).length;
    if (gaps) out[8] = `${gaps} placeholder${gaps === 1 ? "" : "s"} to complete`;
  }
  return out;
}

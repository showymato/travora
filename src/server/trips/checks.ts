import { diffDays, eachDay, fmtShort, toISO } from "@/lib/dates";
import type { TripFull } from "./queries";

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

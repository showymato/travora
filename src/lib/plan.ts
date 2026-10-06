// Trip-planning helpers shared by server pages and client wizard steps.
import { addDays } from "./dates";
import type { ActivityInput, TransportInput } from "./schemas";

export function stepHref(tripId: string | null, step: number) {
  return tripId ? `/app/trips/${tripId}/plan?step=${step}` : "/app/trips/new";
}

export type PlanSegment = { name: string; destinationId: string | null; from: string; to: string };

/** Destination segments from the trip's destination plan (falls back to the whole trip). */
export function segmentsFor(start: string, end: string, dests: { name: string; destinationId: string | null; nights: number | null }[]): PlanSegment[] {
  if (!dests.length) return [{ name: "Whole trip", destinationId: null, from: start, to: end }];
  let cursor = start;
  return dests.map((d, i) => {
    const to = i === dests.length - 1 ? end : addDays(cursor, d.nights ?? 0);
    const seg = { name: d.name, destinationId: d.destinationId, from: cursor, to };
    cursor = to;
    return seg;
  });
}

export function travellerSummary(a: number, c: number, i: number) {
  return [`${a} Adult${a === 1 ? "" : "s"}`, c ? `${c} Child${c === 1 ? "" : "ren"}` : null, i ? `${i} Infant${i === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ");
}

export const blankTransport = (date: string, over: Partial<TransportInput> = {}): TransportInput => ({
  kind: "AIRPORT_TRANSFER",
  date,
  time: "",
  pickup: "",
  dropoff: "",
  vehicle: "",
  driverName: "",
  driverPhone: "",
  vehicleNumber: "",
  notes: "",
  price: 0,
  addToItinerary: true,
  ...over,
});

export const blankActivity = (date: string, over: Partial<ActivityInput> = {}): ActivityInput => ({
  kind: "SIGHTSEEING",
  date,
  time: "",
  title: "",
  location: "",
  description: "",
  durationMins: null,
  notes: "",
  price: 0,
  addToItinerary: true,
  ...over,
});

type KeyDay = { id: string; title: string | null; summary: string | null; items: { id: string; time: string | null; title: string; type: string; location: string | null; description: string | null; notes: string | null }[] };
/** Remount key so server refreshes replace the itinerary builder's local (optimistic) state. */
export function builderKey(days: KeyDay[]) {
  return days.map((d) => `${d.id}:${d.title}:${d.summary}:${d.items.map((i) => `${i.id}${i.time}${i.title}${i.type}${i.location}${i.description}${i.notes}`).join(",")}`).join("|");
}

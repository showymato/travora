// Hotel discovery for the trip wizard: destination scoping, filters, sorting and
// stay estimates. Pure functions over agent-safe hotel data (the agency's own
// rates only), shared by the UI and tests.

import { HOTEL_CATEGORY_STARS, type HotelCategoryValue, type MealPlanValue } from "./labels";

export type SearchableRoom = { id: string; rate: number; capacity: number; mealPlans: readonly string[] };
export type SearchableHotel = {
  id: string;
  name: string;
  category: string;
  location: string;
  description: string | null;
  destination: string | null;
  destinationId: string | null;
  amenities: string[];
  rooms: SearchableRoom[];
  fromRate: number | null;
};

export type HotelFilters = {
  q: string;
  categories: string[];
  maxPrice: number | null;
  amenities: string[];
  mealPlans: MealPlanValue[];
};
export const NO_FILTERS: HotelFilters = { q: "", categories: [], maxPrice: null, amenities: [], mealPlans: [] };

export const HOTEL_SORTS = { recommended: "Recommended", "price-asc": "Lowest price", "price-desc": "Highest price", name: "Hotel name" } as const;
export type HotelSort = keyof typeof HOTEL_SORTS;

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Hotels located in one destination of the trip. Matches the catalog
 * destination id, or the name for custom destinations. A segment without a
 * destination (trip has no route yet) sees every assigned hotel.
 */
export function hotelsForDestination<H extends SearchableHotel>(hotels: H[], seg: { destinationId: string | null; name: string; isWholeTrip?: boolean }): H[] {
  if (seg.isWholeTrip) return hotels;
  return hotels.filter((h) => (seg.destinationId && h.destinationId === seg.destinationId) || (norm(h.destination) !== "" && norm(h.destination) === norm(seg.name)));
}

export function filterHotels<H extends SearchableHotel>(hotels: H[], f: HotelFilters): H[] {
  const q = norm(f.q);
  return hotels.filter(
    (h) =>
      (!q || [h.name, h.location, h.destination, ...h.amenities].some((s) => norm(s).includes(q))) &&
      (!f.categories.length || f.categories.includes(h.category)) &&
      (f.maxPrice === null || (h.fromRate !== null && h.fromRate <= f.maxPrice)) &&
      f.amenities.every((a) => h.amenities.includes(a)) &&
      f.mealPlans.every((m) => h.rooms.some((r) => r.mealPlans.includes(m))),
  );
}

const tier = (category: string) => HOTEL_CATEGORY_STARS[category as HotelCategoryValue] ?? 0;

/**
 * "Recommended" puts bookable hotels first, then those that fit the party in the
 * fewest rooms, then the higher category, then the lower price. No invented
 * ratings or popularity signals.
 */
export function sortHotels<H extends SearchableHotel>(hotels: H[], sort: HotelSort, party = 2): H[] {
  const price = (h: H) => h.fromRate ?? Number.POSITIVE_INFINITY;
  const byName = (a: H, b: H) => a.name.localeCompare(b.name);
  const list = [...hotels];
  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => price(a) - price(b) || byName(a, b));
    case "price-desc":
      return list.sort((a, b) => (b.fromRate ?? -1) - (a.fromRate ?? -1) || byName(a, b));
    case "name":
      return list.sort(byName);
    default:
      return list.sort(
        (a, b) =>
          Number(b.rooms.length > 0) - Number(a.rooms.length > 0) ||
          (cheapestFit(a, party)?.rooms ?? 99) - (cheapestFit(b, party)?.rooms ?? 99) ||
          tier(b.category) - tier(a.category) ||
          price(a) - price(b) ||
          byName(a, b),
      );
  }
}

/** The cheapest way to house the party in a single room type: used for the card's stay estimate. */
export function cheapestFit(h: Pick<SearchableHotel, "rooms">, party: number) {
  let best: { roomId: string; rooms: number; nightly: number } | null = null;
  for (const r of h.rooms) {
    if (r.capacity < 1) continue;
    const rooms = Math.max(1, Math.ceil(party / r.capacity));
    const nightly = rooms * r.rate;
    if (!best || nightly < best.nightly || (nightly === best.nightly && rooms < best.rooms)) best = { roomId: r.id, rooms, nightly };
  }
  return best;
}

export function stayEstimate(h: Pick<SearchableHotel, "rooms">, party: number, nights: number) {
  const fit = cheapestFit(h, party);
  return fit ? { ...fit, total: fit.nightly * nights } : null;
}

export function activeFilterCount(f: HotelFilters) {
  return (f.q.trim() ? 1 : 0) + f.categories.length + (f.maxPrice !== null ? 1 : 0) + f.amenities.length + f.mealPlans.length;
}

/** First sentence-ish of a cancellation policy for the card. */
export function policySummary(p: string | null | undefined, max = 70) {
  if (!p) return null;
  const first = p.split(/(?<=[.;])\s/)[0].trim().replace(/[;,]$/, "");
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

// Trip pricing. Pure functions so totals are identical on every screen, in
// documents and in tests.

import { nightsBetween, toISO } from "./dates";

export type PricedRoom = { roomName: string; nightlyRate: number; quantity: number; checkIn: Date | string; checkOut: Date | string; hotelName?: string; mealPlan?: string };
export type PricedLine = { label: string; detail?: string; amount: number; group: "Hotels" | "Transport" | "Activities" };

export function roomLineAmount(r: PricedRoom) {
  return r.nightlyRate * r.quantity * nightsBetween(toISO(r.checkIn), toISO(r.checkOut));
}

export function priceLines(input: {
  rooms: PricedRoom[];
  transports: { kind?: string; pickup: string; dropoff: string; price: number }[];
  activities: { title: string; price: number }[];
}): PricedLine[] {
  const lines: PricedLine[] = [];
  for (const r of input.rooms) {
    const nights = nightsBetween(toISO(r.checkIn), toISO(r.checkOut));
    lines.push({
      group: "Hotels",
      label: `${r.hotelName ? `${r.hotelName} · ` : ""}${r.roomName}`,
      detail: `${r.quantity} room${r.quantity === 1 ? "" : "s"} × ${nights} night${nights === 1 ? "" : "s"}${r.mealPlan ? ` · ${r.mealPlan}` : ""}`,
      amount: roomLineAmount(r),
    });
  }
  for (const t of input.transports) if (t.price > 0) lines.push({ group: "Transport", label: `${t.pickup} → ${t.dropoff}`, amount: t.price });
  for (const a of input.activities) if (a.price > 0) lines.push({ group: "Activities", label: a.title, amount: a.price });
  return lines;
}

export type PriceGroup = PricedLine["group"];
export const PRICE_GROUPS: PriceGroup[] = ["Hotels", "Transport", "Activities"];

/** Subtotal per group (accommodation, transport, activities) for summaries. */
export function groupTotals(lines: PricedLine[]): Record<PriceGroup, number> {
  const out: Record<PriceGroup, number> = { Hotels: 0, Transport: 0, Activities: 0 };
  for (const l of lines) out[l.group] += l.amount;
  return out;
}

export type QuoteRoom = { roomId: string; quantity: number; nightlyRate: number; capacity: number; guests: number };

/**
 * Price and validate a set of room selections for one stay, before it is saved.
 * The server recomputes the same quote from authorised rates; the client uses it
 * for the live preview, so both always agree.
 */
export function stayQuote(rooms: QuoteRoom[], nights: number, party: number) {
  const lines = rooms
    .filter((r) => r.quantity > 0)
    .map((r) => ({ ...r, amount: r.nightlyRate * r.quantity * nights, maxGuests: r.capacity * r.quantity }));
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const roomCount = lines.reduce((s, l) => s + l.quantity, 0);
  const capacity = lines.reduce((s, l) => s + l.maxGuests, 0);
  const guests = lines.reduce((s, l) => s + l.guests, 0);
  const problems: string[] = [];
  for (const l of lines) if (l.guests > l.maxGuests) problems.push(`Too many guests for ${l.quantity} room${l.quantity === 1 ? "" : "s"} (max ${l.maxGuests}).`);
  return { lines, total, roomCount, capacity, guests, problems, fitsParty: capacity >= party, perNight: nights ? Math.round(total / nights) : 0 };
}

/** Spread the party across selected rooms, filling each up to its capacity. */
export function distributeGuests(rooms: { capacity: number; quantity: number }[], party: number) {
  let left = party;
  return rooms.map((r) => {
    if (r.quantity <= 0) return 0;
    const take = Math.max(r.quantity > 0 ? 1 : 0, Math.min(left, r.capacity * r.quantity));
    left = Math.max(0, left - take);
    return take;
  });
}

export function tripTotals(lines: PricedLine[], priceOverride: number | null) {
  const computed = lines.reduce((s, l) => s + l.amount, 0);
  return { computed, total: priceOverride ?? computed, overridden: priceOverride !== null };
}

/** GST on tour packages (simplified: 5% on the package value). */
export const GST_RATE = 0.05;
export function invoiceAmounts(total: number) {
  // Prices are quoted tax-inclusive; split the tax back out for the invoice.
  const subtotal = Math.round(total / (1 + GST_RATE));
  return { subtotal, tax: total - subtotal, total };
}

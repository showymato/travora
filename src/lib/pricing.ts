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

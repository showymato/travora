import { describe, expect, it } from "vitest";
import { addDays, diffDays, eachDay, fmtDate, fmtDow, fmtLong, fmtRange, fmtTime, nightsBetween, todayISO } from "@/lib/dates";
import { formatINR, paymentSummary } from "@/lib/money";
import { invoiceAmounts, priceLines, roomLineAmount, tripTotals } from "@/lib/pricing";
import { segmentsFor, builderKey } from "@/lib/plan";
import { tripDatesSchema, guestSchema, agencyCreateSchema } from "@/lib/schemas";
import { allocateNights } from "@/server/trips/core";

describe("dates", () => {
  it("counts nights and days", () => {
    expect(nightsBetween("2026-10-10", "2026-10-16")).toBe(6);
    expect(eachDay("2026-10-10", "2026-10-16")).toHaveLength(7);
    expect(diffDays("2026-10-30", "2026-11-02")).toBe(3);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("formats deterministically (no ICU differences)", () => {
    expect(fmtDate("2026-10-10")).toBe("10 Oct 2026");
    expect(fmtDow("2026-10-10")).toBe("Sat, 10 Oct");
    expect(fmtLong("2026-10-05")).toBe("Monday, 5 October 2026");
    expect(fmtRange("2026-10-10", "2026-10-16")).toBe("10 Oct → 16 Oct");
    expect(fmtTime("09:30")).toBe("9:30 AM");
    expect(fmtTime("20:05")).toBe("8:05 PM");
    expect(fmtTime("00:15")).toBe("12:15 AM");
  });
  it("computes today in the agency timezone", () => {
    // 20:00 UTC on 4 Oct is already 5 Oct in India.
    expect(todayISO("Asia/Kolkata", new Date("2026-10-04T20:00:00Z"))).toBe("2026-10-05");
  });
});

describe("validation", () => {
  it("requires departure after arrival", () => {
    expect(tripDatesSchema.safeParse({ startDate: "2026-10-10", endDate: "2026-10-10" }).success).toBe(false);
    expect(tripDatesSchema.safeParse({ startDate: "2026-10-10", endDate: "2026-10-16" }).success).toBe(true);
  });
  it("validates guest contact fields", () => {
    const base = { fullName: "Rahul Sharma", phone: "", email: "", whatsapp: "", nationality: "", dateOfBirth: "", gender: "" as const, address: "", idType: "" as const, idNumber: "", notes: "" };
    expect(guestSchema.safeParse(base).success).toBe(true);
    expect(guestSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(guestSchema.safeParse({ ...base, fullName: "  " }).success).toBe(false);
  });
  it("validates GSTIN", () => {
    const base = { name: "X", ownerName: "Y", email: "owner@agency.example", phone: "+91 98100 11223", city: "", state: "", country: "", address: "", plan: "STARTER", status: "TRIAL", loginEmail: "owner@agency.example", tempPassword: "0123456789" };
    expect(agencyCreateSchema.safeParse({ ...base, gstNumber: "07AABCA1234F1Z5" }).success).toBe(true);
    expect(agencyCreateSchema.safeParse({ ...base, gstNumber: "BAD" }).success).toBe(false);
  });
});

describe("pricing & payments", () => {
  it("prices rooms by nights × quantity × rate", () => {
    expect(roomLineAmount({ roomName: "Deluxe", nightlyRate: 7200, quantity: 2, checkIn: "2026-10-10", checkOut: "2026-10-12" })).toBe(28800);
  });
  it("totals lines and honours a package price", () => {
    const lines = priceLines({
      rooms: [{ roomName: "Deluxe", nightlyRate: 7200, quantity: 1, checkIn: "2026-10-10", checkOut: "2026-10-12" }],
      transports: [{ pickup: "Airport", dropoff: "Hotel", price: 1500 }, { pickup: "A", dropoff: "B", price: 0 }],
      activities: [{ title: "Shikara", price: 1200 }],
    });
    expect(lines).toHaveLength(3);
    expect(tripTotals(lines, null)).toEqual({ computed: 17100, total: 17100, overridden: false });
    expect(tripTotals(lines, 20000).total).toBe(20000);
  });
  it("calculates paid, pending and state, ignoring voided payments", () => {
    expect(paymentSummary(10000, [])).toMatchObject({ paid: 0, pending: 10000, state: "UNPAID" });
    expect(paymentSummary(10000, [{ amount: 4000 }, { amount: 9999, voidedAt: new Date() }])).toMatchObject({ paid: 4000, pending: 6000, state: "PARTIAL" });
    expect(paymentSummary(10000, [{ amount: 10000 }])).toMatchObject({ pending: 0, state: "PAID" });
    expect(paymentSummary(10000, [{ amount: 12000 }])).toMatchObject({ state: "PAID", overpaid: 2000 });
  });
  it("splits GST out of tax-inclusive invoices", () => {
    const a = invoiceAmounts(105000);
    expect(a).toEqual({ subtotal: 100000, tax: 5000, total: 105000 });
  });
  it("formats rupees", () => {
    expect(formatINR(150000)).toBe("₹1,50,000");
  });
});

describe("planning helpers", () => {
  it("allocates nights across destinations", () => {
    expect(allocateNights(6, [null, null, null])).toEqual([2, 2, 2]);
    expect(allocateNights(7, [null, null, null])).toEqual([3, 2, 2]);
    expect(allocateNights(6, [3, null, null])).toEqual([3, 2, 1]);
  });
  it("derives hotel segments from destination nights", () => {
    const s = segmentsFor("2026-10-10", "2026-10-16", [
      { name: "Srinagar", destinationId: null, nights: 2 },
      { name: "Gulmarg", destinationId: null, nights: 2 },
      { name: "Pahalgam", destinationId: null, nights: 2 },
    ]);
    expect(s.map((x) => [x.from, x.to])).toEqual([
      ["2026-10-10", "2026-10-12"],
      ["2026-10-12", "2026-10-14"],
      ["2026-10-14", "2026-10-16"],
    ]);
  });
  it("changes the builder key when an item changes", () => {
    const day = { id: "d", title: "Day", summary: null, items: [{ id: "i", time: "09:00", title: "A", type: "MEAL", location: null, description: null, notes: null }] };
    expect(builderKey([day])).not.toBe(builderKey([{ ...day, items: [{ ...day.items[0], time: "10:00" }] }]));
  });
});

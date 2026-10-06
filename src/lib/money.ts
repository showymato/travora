// Money is whole Indian Rupees throughout TRAVORA.

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const COMPACT = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const formatINR = (n: number | null | undefined) => INR.format(n ?? 0);

/** "₹4.2L" style for dense metric tiles. */
export function formatINRCompact(n: number) {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(n >= 1e6 ? 0 : 1)}L`;
  return `₹${COMPACT.format(n)}`;
}

export type PaymentState = "UNPAID" | "PARTIAL" | "PAID";

export function paymentSummary(total: number, payments: { amount: number; voidedAt?: Date | string | null }[]) {
  const paid = payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  const pending = Math.max(0, total - paid);
  const state: PaymentState = paid <= 0 ? "UNPAID" : paid >= total && total > 0 ? "PAID" : total === 0 ? "PAID" : "PARTIAL";
  return { total, paid, pending, state, overpaid: Math.max(0, paid - total) };
}

import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { listBalances, recentPayments } from "@/server/payments";
import { MetricCard, PageHeader, Panel } from "@/components/app/page";
import { PaymentBadge, TripStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { FilterBar, Pagination, SearchInput, SegmentedFilter } from "@/components/app/list-controls";
import { fmtDate, fmtRange } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { PAYMENT_METHOD_LABEL, type PaymentMethodValue } from "@/lib/labels";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: PageProps<"/app/payments">) {
  const actor = await requireAgentPage();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const state = (["UNPAID", "PARTIAL", "PAID"].includes(str("state")) ? str("state") : "") as "UNPAID" | "PARTIAL" | "PAID" | "";
  const [data, all, recent] = await Promise.all([listBalances(actor, { q: str("q"), state, page: Number(str("page")) || 1 }), listBalances(actor, {}), recentPayments(actor, 8)]);

  return (
    <>
      <PageHeader title="Payments" description="Balances across active trips. Record payments from a trip's Payments tab." />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Trip value" value={formatINR(all.totals.total)} hint={`${all.total} active trips`} />
        <MetricCard label="Received" value={formatINR(all.totals.paid)} />
        <MetricCard label="Pending" value={formatINR(all.totals.pending)} tone={all.totals.pending ? "attention" : "default"} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-xl border bg-card">
          <FilterBar>
            <SegmentedFilter
              param="state"
              options={[
                { value: "", label: "All" },
                { value: "UNPAID", label: "Unpaid" },
                { value: "PARTIAL", label: "Partial" },
                { value: "PAID", label: "Paid" },
              ]}
            />
            <SearchInput placeholder="Trip ID or guest…" className="sm:ml-auto" />
          </FilterBar>
          {data.rows.length ? (
            <>
              <div className="relative overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b text-left text-[12px] text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium">Trip</th>
                      <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Dates</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                      <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Paid</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Pending</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id} className="relative border-b last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <Link href={`/app/trips/${r.id}?tab=payments`} className="after:absolute after:inset-0">
                            <span className="block font-medium">{r.guest ?? "—"}</span>
                            <span className="font-mono text-[11.5px] text-muted-foreground">{r.code}</span>
                          </Link>
                        </td>
                        <td className="hidden px-3 py-3 whitespace-nowrap text-muted-foreground md:table-cell">{fmtRange(r.startDate, r.endDate)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular">{formatINR(r.total)}</td>
                        <td className="hidden px-3 py-3 text-right whitespace-nowrap tabular sm:table-cell">{formatINR(r.paid)}</td>
                        <td className={`px-3 py-3 text-right font-medium whitespace-nowrap tabular ${r.pending ? "text-warn" : ""}`}>{formatINR(r.pending)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <PaymentBadge state={r.state} />
                            <TripStatusBadge status={r.status} className="hidden lg:inline-flex" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} />
            </>
          ) : (
            <EmptyState icon={<CreditCard />} title="Nothing here" description="Trips appear once they're out of draft." />
          )}
        </div>
        <Panel title="Recent payments">
          {recent.length ? (
            <ul className="-mx-1 space-y-1">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link href={`/app/trips/${p.trip.id}?tab=payments`} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5 hover:bg-muted/60">
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium">{p.trip.primaryGuest?.fullName ?? p.trip.code}</span>
                      <span className="block text-[12px] text-muted-foreground">
                        {fmtDate(p.paidAt)} · {PAYMENT_METHOD_LABEL[p.method as PaymentMethodValue]}
                      </span>
                    </span>
                    <span className={`shrink-0 font-medium tabular ${p.voidedAt ? "text-muted-foreground line-through" : ""}`}>{formatINR(p.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">No payments recorded yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

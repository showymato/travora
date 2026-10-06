import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/context";
import { subscriptionsOverview } from "@/server/reports";
import { PageHeader } from "@/components/app/page";
import { AgencyStatusBadge, Pill } from "@/components/app/badges";
import { fmtDate, todayISO, toISO, diffDays } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { RenewButton } from "./renew-button";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage() {
  const actor = await requireAdminPage();
  const { plans, subs, renewingSoon } = await subscriptionsOverview(actor);
  const today = todayISO();
  return (
    <>
      <PageHeader title="Subscriptions" description={`${subs.length} subscriptions · ${renewingSoon} renewing or expiring within 14 days. Subscription billing is recorded manually in the MVP.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl border bg-card p-4">
            <p className="text-[14px] font-semibold">{p.name}</p>
            <p className="text-[13px] text-muted-foreground tabular">
              {formatINR(p.priceMonthly)}/mo · {p.maxUsers} users{p.maxTripsMonthly ? ` · ${p.maxTripsMonthly} trips/mo` : " · unlimited trips"}
            </p>
            <p className="mt-3 text-[22px] font-semibold tabular">{p._count.subscriptions}</p>
            <p className="text-[12px] text-muted-foreground">agencies</p>
          </div>
        ))}
      </div>
      <div className="relative mt-5 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b text-left text-[12px] text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Agency</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Plan</th>
              <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Status</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Period ends</th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Seats</th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const left = diffDays(today, toISO(s.currentPeriodEnd)!);
              return (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/agents/${s.agency.id}`} className="font-medium hover:underline">
                      {s.agency.name}
                    </Link>
                    <div className="mt-0.5">
                      <AgencyStatusBadge status={s.agency.status} />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {s.plan.name}
                    <span className="block text-[12px] text-muted-foreground tabular">{formatINR(s.plan.priceMonthly)}/mo</span>
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    <Pill tone={s.status === "ACTIVE" ? "ok" : s.status === "TRIALING" ? "info" : "bad"}>{s.status.replace("_", " ").toLowerCase()}</Pill>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {fmtDate(s.currentPeriodEnd)}
                    <span className={`block text-[12px] ${left < 0 ? "text-bad" : left <= 7 ? "text-warn" : "text-muted-foreground"}`}>{left < 0 ? `Expired ${-left}d ago` : `${left} days left`}</span>
                  </td>
                  <td className="hidden px-3 py-3 text-right tabular md:table-cell">
                    {s.agency._count.users} / {s.plan.maxUsers}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RenewButton agencyId={s.agency.id} name={s.agency.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

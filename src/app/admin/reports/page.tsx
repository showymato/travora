import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/context";
import { adminReports } from "@/server/reports";
import { MetricCard, PageHeader, Panel } from "@/components/app/page";
import { BarList, ColumnChart } from "@/components/app/charts";
import { formatINR, formatINRCompact } from "@/lib/money";
import { fmtMonth } from "@/lib/dates";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminReportsPage() {
  const actor = await requireAdminPage();
  const r = await adminReports(actor);
  const month = (k: string) => fmtMonth(`${k}-01`).split(" ")[0].slice(0, 3);
  return (
    <>
      <PageHeader title="Reports" description="Platform health across all agencies. Revenue is monthly recurring revenue from active subscriptions; trip volume is agencies' selling value." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Total agencies" value={r.agencies} />
        <MetricCard label="Active agencies" value={r.active} />
        <MetricCard label="Trips" value={r.trips} hint="Out of draft, not cancelled" />
        <MetricCard label="Guests" value={r.guests} />
        <MetricCard label="Trip volume" value={formatINRCompact(r.tripVolume)} hint={formatINR(r.tripVolume)} />
        <MetricCard label="Revenue (MRR)" value={formatINRCompact(r.mrr)} hint={formatINR(r.mrr)} />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Trips by start month" description="All agencies, last 6 months">
          <ColumnChart label="Trips by start month" data={r.monthly.map((m) => ({ key: m.month, label: month(m.month), value: m.trips }))} />
        </Panel>
        <Panel title="Trip volume by start month" description="Selling value, ₹">
          <ColumnChart label="Trip volume by start month" format={formatINRCompact} data={r.monthly.map((m) => ({ key: m.month, label: month(m.month), value: m.value }))} />
        </Panel>
        <Panel title="Top agencies" description="By trip value">
          <BarList data={r.topAgencies.map((a) => ({ label: `${a.name} · ${a.trips} trips`, value: a.value, href: `/admin/agents/${a.id}` }))} format={formatINRCompact} />
        </Panel>
        <Panel title="Top destinations">
          <BarList data={r.destinations.map((d) => ({ label: d.name, value: d.trips }))} format={(n) => `${n} trip${n === 1 ? "" : "s"}`} />
        </Panel>
        <Panel title="Most used hotels">
          <BarList data={r.hotels.map((h) => ({ label: h.name, value: h.stays, href: `/admin/hotels/${h.id}` }))} format={(n) => `${n} stay${n === 1 ? "" : "s"}`} />
        </Panel>
        <Panel title="Plan mix">
          <BarList data={r.planMix.map((p) => ({ label: p.plan, value: p.count }))} format={(n) => `${n} agenc${n === 1 ? "y" : "ies"}`} />
        </Panel>
      </div>
    </>
  );
}

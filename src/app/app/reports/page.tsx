import type { Metadata } from "next";
import { requireAgentPage } from "@/server/auth/context";
import { agentReports } from "@/server/reports";
import { MetricCard, PageHeader, Panel } from "@/components/app/page";
import { BarList, ColumnChart } from "@/components/app/charts";
import { TripStatusBadge } from "@/components/app/badges";
import { formatINR, formatINRCompact } from "@/lib/money";
import { fmtMonth } from "@/lib/dates";

export const metadata: Metadata = { title: "Reports" };

export default async function AgentReportsPage() {
  const actor = await requireAgentPage();
  const r = await agentReports(actor);
  return (
    <>
      <PageHeader title="Reports" description={`How ${actor.agencyName} is doing. Trip value counts every trip that left draft and wasn't cancelled.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Trips" value={r.trips} hint={`${r.liveTrips} booked or sent`} />
        <MetricCard label="Guests" value={r.guests} hint={`${r.repeatGuests} travelled more than once`} />
        <MetricCard label="Trip value" value={formatINRCompact(r.tripValue)} hint={formatINR(r.tripValue)} />
        <MetricCard label="Average trip" value={formatINRCompact(r.averageTrip)} hint={formatINR(r.averageTrip)} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <MetricCard label="Upcoming" value={r.upcoming} />
        <MetricCard label="Completed" value={r.completed} />
        <MetricCard label="Cancelled" value={r.cancelled} />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Trips by start month" description="Last 6 months, booked or sent">
          <ColumnChart label="Trips by start month" data={r.monthly.map((m) => ({ key: m.month, label: fmtMonth(`${m.month}-01`).split(" ")[0].slice(0, 3), value: m.trips }))} />
        </Panel>
        <Panel title="Popular destinations">
          <BarList data={r.destinations.map((d) => ({ label: d.name, value: d.trips }))} format={(n) => `${n} trip${n === 1 ? "" : "s"}`} />
        </Panel>
        <Panel title="Trip value by start month" description="Selling value, ₹">
          <ColumnChart label="Trip value by start month" format={formatINRCompact} data={r.monthly.map((m) => ({ key: m.month, label: fmtMonth(`${m.month}-01`).split(" ")[0].slice(0, 3), value: m.value }))} />
        </Panel>
        <div className="space-y-5">
          <Panel title="Most used hotels">
            <BarList data={r.hotels.map((h) => ({ label: h.name, value: h.stays }))} format={(n) => `${n} stay${n === 1 ? "" : "s"}`} />
          </Panel>
          <Panel title="Trips by status">
            <ul className="space-y-2">
              {r.byStatus.map((s) => (
                <li key={s.status} className="flex items-center justify-between text-[13.5px]">
                  <TripStatusBadge status={s.status} />
                  <span className="font-medium tabular">{s.count}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

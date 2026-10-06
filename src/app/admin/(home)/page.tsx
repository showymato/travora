import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, CalendarCheck2, Map, Plane, Plus, Users } from "lucide-react";
import { requireAdminPage } from "@/server/auth/context";
import { adminDashboard } from "@/server/ops";
import { rollStatuses, tripTitle } from "@/server/trips/core";
import { Button } from "@/components/ui/button";
import { MetricCard, PageHeader, Panel } from "@/components/app/page";
import { TripStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { ActivityFeed } from "@/components/trips/command/overview";
import { PendingList, TodayTimeline } from "@/components/trips/ops";
import { fmtLong, fmtRange, toDate, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboard() {
  const actor = await requireAdminPage();
  await rollStatuses(toDate(todayISO()));
  const d = await adminDashboard(actor);
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date()));
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const counts = {
    arrivals: d.ops.filter((o) => o.kind === "ARRIVAL").length,
    checkIns: d.ops.filter((o) => o.kind === "CHECK_IN").length,
    transport: d.ops.filter((o) => o.kind === "TRANSPORT").length,
    activities: d.ops.filter((o) => o.kind === "ACTIVITY").length,
  };

  return (
    <>
      <PageHeader
        eyebrow={fmtLong(d.today)}
        title={`${greet}, ${actor.name.split(" ")[0]}`}
        description="Here's what's happening across TRAVORA today."
        actions={
          <Button asChild>
            <Link href="/admin/agents/new">
              <Plus className="size-4" aria-hidden /> New agency
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Total agents" value={d.metrics.agencies} icon={<Building2 />} href="/admin/agents" />
        <MetricCard label="Active agents" value={d.metrics.activeAgencies} icon={<Building2 />} href="/admin/agents?status=ACTIVE" />
        <MetricCard label="Upcoming trips" value={d.metrics.upcoming} icon={<CalendarCheck2 />} href="/admin/trips" />
        <MetricCard label="Ongoing trips" value={d.metrics.ongoing} icon={<Plane />} href="/admin/trips?status=ONGOING" />
        <MetricCard label="Total guests" value={d.metrics.guests} icon={<Users />} />
        <MetricCard label="Trips this month" value={d.metrics.monthTrips} icon={<Map />} hint="Created since the 1st" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel title="Today's operations" description={`${counts.arrivals} arrivals · ${counts.checkIns} check-ins · ${counts.transport} transfers · ${counts.activities} activities`}>
            <TodayTimeline entries={d.ops} hrefFor={(id) => `/admin/trips/${id}`} showAgency />
          </Panel>
          <Panel title="Upcoming trips" bodyClassName="p-0" actions={<Button asChild variant="ghost" size="sm"><Link href="/admin/trips">All trips <ArrowRight className="size-3.5" aria-hidden /></Link></Button>}>
            {d.upcomingTrips.length ? (
              <div className="relative overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b text-left text-[12px] text-muted-foreground">
                      <th scope="col" className="px-5 py-2.5 font-medium">Trip</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Agent</th>
                      <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Destination</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Dates</th>
                      <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.upcomingTrips.map((t) => (
                      <tr key={t.id} className="relative border-b last:border-0 hover:bg-muted/40">
                        <td className="px-5 py-3">
                          <Link href={`/admin/trips/${t.id}`} className="after:absolute after:inset-0">
                            <span className="block font-medium">{t.primaryGuest?.fullName ?? "—"}</span>
                            <span className="font-mono text-[11.5px] text-muted-foreground">{t.code}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">{t.agency.name}</td>
                        <td className="hidden max-w-[200px] truncate px-3 py-3 text-muted-foreground md:table-cell">{tripTitle(t)}</td>
                        <td className="px-3 py-3 whitespace-nowrap tabular">{fmtRange(t.startDate, t.endDate)}</td>
                        <td className="px-5 py-3">
                          <TripStatusBadge status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState compact title="No upcoming trips" />
            )}
          </Panel>
        </div>
        <div className="min-w-0 space-y-5">
          <Panel title="Pending actions" description="Accounts that need a look">
            <PendingList actions={d.pending} />
          </Panel>
          <Panel title="Agent activity">
            <ActivityFeed entries={d.activity.map((a) => ({ ...a, summary: `${a.summary ?? a.action}${a.agency ? ` · ${a.agency.name}` : ""}` }))} />
          </Panel>
          {d.pending.length === 0 ? null : (
            <p className="flex items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground">
              <AlertTriangle className="size-3.5" aria-hidden /> Trial and inactivity alerts update daily.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

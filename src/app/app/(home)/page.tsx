import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarCheck2, Map, Plane, Plus, Users } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { agentDashboard } from "@/server/ops";
import { rollStatuses } from "@/server/trips/core";
import { tripTitle } from "@/server/trips/core";
import { Button } from "@/components/ui/button";
import { MetricCard, PageHeader, Panel } from "@/components/app/page";
import { TripStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { Initials } from "@/components/app/visuals";
import { PendingList, TodayTimeline } from "@/components/trips/ops";
import { fmtLong, fmtRange, fmtRelative, toDate, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(tz = "Asia/Kolkata") {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const WIZARD_STEP = ["", "Guest", "Dates", "Destinations", "Hotels", "Rooms", "Transport", "Activities", "Itinerary", "Review", "Send"];

export default async function AgentDashboard() {
  const actor = await requireAgentPage();
  await rollStatuses(toDate(todayISO()), actor.agencyId);
  const d = await agentDashboard(actor);
  const first = actor.name.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow={`${actor.agencyName} · ${fmtLong(d.today)}`}
        title={
          <>
            {greeting()}, {first} <span aria-hidden>👋</span>
          </>
        }
        description="Here's what needs you today."
        actions={
          <Button asChild size="lg">
            <Link href="/app/trips/new">
              <Plus className="size-4" aria-hidden /> New trip
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Upcoming trips" value={d.metrics.upcoming} icon={<CalendarCheck2 />} href="/app/trips?when=upcoming" hint="Starting after today" />
        <MetricCard label="Active trips" value={d.metrics.active} icon={<Plane />} href="/app/trips?when=ongoing" hint="Guests travelling now" />
        <MetricCard label="Guests" value={d.metrics.guests} icon={<Users />} href="/app/guests" hint="In your workspace" />
        <MetricCard label="Pending actions" value={d.metrics.pending} icon={<AlertTriangle />} tone={d.metrics.pending ? "attention" : "default"} href="#pending" hint={d.metrics.pending ? "Need your attention" : "All clear"} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel
            title="Today"
            description={`${d.ops.length} ${d.ops.length === 1 ? "thing" : "things"} happening on the ground`}
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/calendar?view=day">
                  Calendar <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            }
          >
            <TodayTimeline entries={d.ops} hrefFor={(id) => `/app/trips/${id}`} />
          </Panel>

          <Panel
            title="Upcoming trips"
            bodyClassName="p-0"
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/trips">
                  All trips <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            }
          >
            {d.upcomingTrips.length ? (
              <ul className="divide-y">
                {d.upcomingTrips.map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/trips/${t.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5">
                      <Initials name={t.primaryGuest?.fullName ?? t.code} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">{t.primaryGuest?.fullName ?? "No guest yet"}</p>
                        <p className="truncate text-[12.5px] text-muted-foreground">{tripTitle(t)}</p>
                      </div>
                      <div className="hidden text-right text-[13px] tabular sm:block">
                        <p>{fmtRange(t.startDate, t.endDate)}</p>
                        <p className="font-mono text-[11.5px] text-muted-foreground">{t.code}</p>
                      </div>
                      <TripStatusBadge status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Map />}
                title="No trips yet"
                description="Create your first trip and start planning your customer's journey."
                action={
                  <Button asChild>
                    <Link href="/app/trips/new">
                      <Plus className="size-4" aria-hidden /> Create trip
                    </Link>
                  </Button>
                }
              />
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel id="pending" title="Needs attention" description="What to do next, most urgent first">
            <PendingList actions={d.pending} limit={8} />
            {d.pending.length > 8 ? <p className="mt-2 px-1 text-[12.5px] text-muted-foreground">+ {d.pending.length - 8} more in Trips</p> : null}
          </Panel>
          {d.drafts.length ? (
            <Panel title="Continue where you left off">
              <ul className="-mx-2">
                {d.drafts.map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/trips/${t.id}/plan`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium">{t.primaryGuest?.fullName ?? t.code}</p>
                        <p className="text-[12.5px] text-muted-foreground">
                          Step {t.wizardStep} · {WIZARD_STEP[t.wizardStep]} · {fmtRelative(t.updatedAt)}
                        </p>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}

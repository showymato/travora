import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, Mail, MapPin, Phone } from "lucide-react";
import { requireAdminPage } from "@/server/auth/context";
import { or404 } from "@/server/pages";
import { agencyActivity, agencyGuests, agencyHotels, agencyMetrics, getAgencyDetail } from "@/server/agencies";
import { listAllTrips } from "@/server/reports";
import { tripTitle } from "@/server/trips/core";
import { Button } from "@/components/ui/button";
import { DetailList, MetricCard, Panel } from "@/components/app/page";
import { AgencyStatusBadge, PlanBadge, TripStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { Initials, Stars } from "@/components/app/visuals";
import { ActivityFeed } from "@/components/trips/command/overview";
import { AgencyActions } from "@/components/admin/agency-actions";
import { fmtDate, fmtDateTime, fmtRange, fmtRelative } from "@/lib/dates";
import { formatINR, formatINRCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agency" };

const TABS = [
  ["overview", "Overview"],
  ["trips", "Trips"],
  ["guests", "Guests"],
  ["hotels", "Hotels"],
  ["activity", "Activity"],
  ["settings", "Settings"],
] as const;

export default async function AgencyDetail({ params, searchParams }: PageProps<"/admin/agents/[id]">) {
  const actor = await requireAdminPage();
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as (typeof TABS)[number][0]) : "overview";
  const [a, m] = await Promise.all([or404(getAgencyDetail(actor, id)), agencyMetrics(actor, id)]);
  const sub = a.subscription;

  return (
    <>
      <Link href="/admin/agents" className="mb-3 inline-flex text-[13px] text-muted-foreground hover:text-foreground">
        ← Agents
      </Link>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          <Initials name={a.name} className="size-14 rounded-xl text-[18px]" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">{a.name}</h1>
              <AgencyStatusBadge status={a.status} />
              {sub ? <PlanBadge name={sub.plan.name} /> : null}
            </div>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
              <span>{a.ownerName}</span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" aria-hidden /> {a.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden /> {a.phone}
              </span>
              <span>Created {fmtDate(a.createdAt)}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/agents/${id}/hotels`}>
              <BedDouble className="size-4" aria-hidden /> Hotel access
            </Link>
          </Button>
          <AgencyActions agencyId={id} name={a.name} status={a.status} />
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Trips" value={m.trips} />
        <MetricCard label="Guests" value={m.guests} />
        <MetricCard label="Trip value" value={formatINRCompact(m.tripValue)} hint={formatINR(m.tripValue)} />
        <MetricCard label="Active trips" value={m.active} />
      </div>

      <nav aria-label="Agency sections" className="scrollbar-none mt-6 mb-6 overflow-x-auto border-b">
        <ul className="flex min-w-max gap-1">
          {TABS.map(([k, label]) => (
            <li key={k}>
              <Link
                href={k === "overview" ? `/admin/agents/${id}` : `/admin/agents/${id}?tab=${k}`}
                scroll={false}
                aria-current={tab === k ? "page" : undefined}
                className={cn("relative flex h-10 items-center px-3 text-[13.5px] font-medium", tab === k ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" ? <Overview /> : null}
      {tab === "trips" ? <Trips /> : null}
      {tab === "guests" ? <Guests /> : null}
      {tab === "hotels" ? <Hotels /> : null}
      {tab === "activity" ? <ActivityTab /> : null}
      {tab === "settings" ? <Settings /> : null}
    </>
  );

  async function Overview() {
    const activity = await agencyActivity(actor, id, 10);
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Business">
          <DetailList
            items={[
              ["Owner", a.ownerName],
              ["Email", a.email],
              ["Phone", a.phone],
              ["Location", [a.city, a.state, a.country].filter(Boolean).join(", ")],
              ["Address", a.address],
              ["GSTIN", a.gstNumber],
              ["Plan", sub ? `${sub.plan.name} · ${formatINR(sub.plan.priceMonthly)}/mo` : null],
              ["Period ends", sub ? fmtDate(sub.currentPeriodEnd) : null],
            ]}
          />
        </Panel>
        <Panel title="Recent activity" actions={<Button asChild variant="ghost" size="sm"><Link href={`/admin/agents/${id}?tab=activity`}>All</Link></Button>}>
          <ActivityFeed entries={activity} />
        </Panel>
      </div>
    );
  }

  async function Trips() {
    const data = await listAllTrips(actor, { agencyId: id, page: 1 });
    return data.rows.length ? (
      <ul className="divide-y rounded-xl border bg-card">
        {data.rows.map((t) => (
          <li key={t.id}>
            <Link href={`/admin/trips/${t.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40">
              <span className="font-mono text-[12.5px] text-muted-foreground">{t.code}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{t.primaryGuest?.fullName ?? "—"}</span> <span className="text-muted-foreground">· {tripTitle(t)}</span>
              </span>
              <span className="text-[13px] text-muted-foreground tabular">{fmtRange(t.startDate, t.endDate)}</span>
              <span className="w-24 text-right text-[13px] tabular">{formatINR(t.totalAmount)}</span>
              <TripStatusBadge status={t.status} />
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState title="No trips yet" />
    );
  }

  async function Guests() {
    const guests = await agencyGuests(actor, id);
    return guests.length ? (
      <div className="relative overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b text-left text-[12px] text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
              <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Phone</th>
              <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Email</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Trips</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Added</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.id} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium">{g.fullName}</td>
                <td className="hidden px-3 py-2.5 sm:table-cell">{g.phone ?? "—"}</td>
                <td className="hidden px-3 py-2.5 md:table-cell">{g.email ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular">{g._count.trips}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDate(g.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <EmptyState title="No guests yet" />
    );
  }

  async function Hotels() {
    const links = await agencyHotels(actor, id);
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button asChild>
            <Link href={`/admin/agents/${id}/hotels`}>Manage hotel access</Link>
          </Button>
        </div>
        {links.length ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {links.map(({ hotel: h }) => (
              <li key={h.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/admin/hotels/${h.id}`} className="font-medium hover:underline">
                    {h.name}
                  </Link>
                  <Stars category={h.category} />
                </div>
                <p className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
                  <MapPin className="size-3" aria-hidden /> {h.location}
                </p>
                <ul className="mt-2 space-y-1 text-[13px]">
                  {h.rooms.map((r) => (
                    <li key={r.id} className="flex justify-between">
                      <span className="text-muted-foreground">{r.name}</span>
                      <span className="tabular">
                        {r.rates[0] ? (
                          <>
                            <span className="font-medium">{formatINR(r.rates[0].rate)}</span> <span className="text-[12px] text-muted-foreground line-through">{formatINR(r.baseRate)}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{formatINR(r.baseRate)} base</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<BedDouble />} title="No hotels assigned" description="This agency can't book any hotels until you assign some." />
        )}
      </div>
    );
  }

  async function ActivityTab() {
    const activity = await agencyActivity(actor, id, 100);
    return (
      <Panel title="Activity" description="Every audited change in this workspace.">
        <ActivityFeed entries={activity} />
      </Panel>
    );
  }

  async function Settings() {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Users">
          <ul className="divide-y">
            {a.users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <Initials name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{u.name}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">{u.email}</p>
                </div>
                <p className="text-right text-[12px] text-muted-foreground">
                  {u.mustChangePassword ? "Temporary password" : u.lastLoginAt ? `Signed in ${fmtRelative(u.lastLoginAt)}` : "Never signed in"}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Subscription">
          {sub ? (
            <DetailList
              className="sm:grid-cols-2"
              items={[
                ["Plan", sub.plan.name],
                ["Status", sub.status.replace("_", " ").toLowerCase()],
                ["Period start", fmtDateTime(sub.currentPeriodStart)],
                ["Period end", fmtDateTime(sub.currentPeriodEnd)],
                ["Trial ends", sub.trialEndsAt ? fmtDate(sub.trialEndsAt) : "—"],
                ["Seats", `${a.users.length} of ${sub.plan.maxUsers}`],
              ]}
            />
          ) : (
            <p className="text-[13.5px] text-muted-foreground">No subscription.</p>
          )}
          <Button asChild variant="outline" className="mt-4">
            <Link href="/admin/subscriptions">Manage subscriptions</Link>
          </Button>
        </Panel>
      </div>
    );
  }
}

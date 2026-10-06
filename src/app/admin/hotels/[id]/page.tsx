import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Globe, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { requireAdminPage } from "@/server/auth/context";
import { getHotelAdmin, hotelActivity } from "@/server/hotels";
import { or404 } from "@/server/pages";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { DetailList, Panel } from "@/components/app/page";
import { Pill } from "@/components/app/badges";
import { Stars } from "@/components/app/visuals";
import { ActivityFeed } from "@/components/trips/command/overview";
import { HotelAgencies, HotelImages, RatesEditor, RoomsManager } from "@/components/admin/hotel-panels";
import { fmtTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hotel" };

const TABS = [
  ["overview", "Overview"],
  ["rooms", "Rooms"],
  ["rates", "Rates"],
  ["amenities", "Amenities"],
  ["agents", "Agents"],
  ["activity", "Activity"],
] as const;

export default async function AdminHotelPage({ params, searchParams }: PageProps<"/admin/hotels/[id]">) {
  const actor = await requireAdminPage();
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as (typeof TABS)[number][0]) : "overview";
  const h = await or404(getHotelAdmin(actor, id));
  const assignedAgencies = h.agencies.map((l) => l.agency);

  return (
    <>
      <Link href="/admin/hotels" className="mb-3 inline-flex text-[13px] text-muted-foreground hover:text-foreground">
        ← Hotels
      </Link>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] uppercase">{h.name}</h1>
            {h.status === "INACTIVE" ? <Pill>Inactive</Pill> : null}
          </div>
          <Stars category={h.category} className="mt-1 [&_svg]:size-3.5" />
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-muted-foreground">
            <MapPin className="size-4" aria-hidden /> {h.destination?.name ?? h.location}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/hotels/${id}/edit`}>
            <Pencil className="size-4" aria-hidden /> Edit hotel
          </Link>
        </Button>
      </header>

      <nav aria-label="Hotel sections" className="scrollbar-none mt-6 mb-6 overflow-x-auto border-b">
        <ul className="flex min-w-max gap-1">
          {TABS.map(([k, label]) => (
            <li key={k}>
              <Link
                href={k === "overview" ? `/admin/hotels/${id}` : `/admin/hotels/${id}?tab=${k}`}
                scroll={false}
                aria-current={tab === k ? "page" : undefined}
                className={cn("relative flex h-10 items-center px-3 text-[13.5px] font-medium", tab === k ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
                {k === "rooms" ? <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{h.rooms.length}</span> : null}
                {k === "agents" ? <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{h.agencies.length}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Panel title="Photos">
              <HotelImages hotelId={id} images={h.images} />
            </Panel>
            {h.description ? (
              <Panel title="About">
                <p className="text-[14.5px] leading-relaxed">{h.description}</p>
              </Panel>
            ) : null}
          </div>
          <div className="space-y-5">
            <Panel title="Details">
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  ["Address", h.address],
                  ["Coordinates", h.latitude !== null && h.longitude !== null ? `${h.latitude}, ${h.longitude}` : null],
                  ["Check-in / out", `${fmtTime(h.checkInTime)} / ${fmtTime(h.checkOutTime)}`],
                  ["Cancellation", h.cancellationPolicy],
                  ["Booked stays", String(h._count.tripHotels)],
                  ["Internal notes", h.notes],
                ]}
              />
            </Panel>
            <Panel title="Contact">
              <ul className="space-y-2 text-[13.5px]">
                {h.phone ? (
                  <li className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" aria-hidden /> {h.phone}
                  </li>
                ) : null}
                {h.email ? (
                  <li className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" aria-hidden /> {h.email}
                  </li>
                ) : null}
                {h.website ? (
                  <li className="flex items-center gap-2">
                    <Globe className="size-4 text-muted-foreground" aria-hidden />
                    <a href={h.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {h.website}
                    </a>
                  </li>
                ) : null}
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-4" aria-hidden /> Check-in {fmtTime(h.checkInTime)}
                </li>
              </ul>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "rooms" ? <RoomsManager hotelId={id} rooms={h.rooms} /> : null}
      {tab === "rates" ? <RatesEditor rooms={h.rooms.filter((r) => r.status === "ACTIVE")} agencies={assignedAgencies} /> : null}
      {tab === "amenities" ? (
        <Panel title="Amenities" actions={<Button asChild variant="ghost" size="sm"><Link href={`/admin/hotels/${id}/edit`}>Edit</Link></Button>}>
          {h.amenities.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {h.amenities.map((a) => (
                <li key={a} className="rounded-full border bg-surface px-3 py-1 text-[13px]">
                  {a}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">No amenities listed.</p>
          )}
          <div className="mt-5 space-y-2">
            {h.rooms.map((r) => (
              <p key={r.id} className="text-[13px]">
                <span className="font-medium">{r.name}:</span> <span className="text-muted-foreground">{r.amenities.join(", ") || "—"}</span>
              </p>
            ))}
          </div>
        </Panel>
      ) : null}
      {tab === "agents" ? <AgentsTab /> : null}
      {tab === "activity" ? <ActivityTab /> : null}
    </>
  );

  async function AgentsTab() {
    const agencies = await db.agency.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, status: true } });
    return <HotelAgencies hotelId={id} agencies={agencies} assigned={h.agencies.map((l) => l.agencyId)} />;
  }

  async function ActivityTab() {
    const log = await hotelActivity(actor, id);
    return (
      <Panel title="Activity">
        <ActivityFeed entries={log.map((l) => ({ ...l, summary: `${l.summary ?? l.action}${l.agency ? ` · ${l.agency.name}` : ""}` }))} />
      </Panel>
    );
  }
}

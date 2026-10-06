import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/context";
import { getTripAdmin } from "@/server/reports";
import { or404 } from "@/server/pages";
import { tripTitle } from "@/server/trips/core";
import { Panel } from "@/components/app/page";
import { TripStatusBadge } from "@/components/app/badges";
import { NowPanel, PaymentSummary, StaysMini } from "@/components/trips/command/overview";
import { ItineraryBuilder } from "@/components/trips/itinerary-builder";
import { fmtRange, nightsBetween, toISO } from "@/lib/dates";
import { travellerSummary } from "@/lib/plan";

export const metadata: Metadata = { title: "Trip" };

/** Read-only platform view of an agency's trip (support and oversight). */
export default async function AdminTripPage({ params }: PageProps<"/admin/trips/[id]">) {
  const actor = await requireAdminPage();
  const { id } = await params;
  const { trip, total, payment } = await or404(getTripAdmin(actor, id));
  const n = nightsBetween(toISO(trip.startDate), toISO(trip.endDate));
  return (
    <>
      <Link href="/admin/trips" className="mb-3 inline-flex text-[13px] text-muted-foreground hover:text-foreground">
        ← Trips
      </Link>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[13px] text-muted-foreground">{trip.code}</span>
        <TripStatusBadge status={trip.status} />
        <Link href={`/admin/agents/${trip.agencyId}`} className="text-[13px] text-muted-foreground hover:text-foreground">
          {trip.agency.name}
        </Link>
      </div>
      <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.02em]">{trip.primaryGuest?.fullName ?? "No guest"}</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">
        {fmtRange(trip.startDate, trip.endDate)}
        {n ? ` · ${n}N / ${n + 1}D` : ""} · {tripTitle(trip)} · {travellerSummary(trip.adults, trip.children, trip.infants)}
      </p>
      <p className="mt-3 rounded-lg border bg-surface px-3 py-2 text-[12.5px] text-muted-foreground">Read-only view. Changes are made by {trip.agency.name} in their workspace.</p>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <NowPanel trip={trip} tz={trip.agency.timezone} />
          <Panel title="Itinerary">{trip.days.length ? <ItineraryBuilder tripId={trip.id} days={trip.days} readOnly /> : <p className="text-[13.5px] text-muted-foreground">Not built yet.</p>}</Panel>
        </div>
        <div className="min-w-0 space-y-5">
          <Panel title="Hotels">
            <StaysMini trip={trip} />
          </Panel>
          <Panel title="Payments">
            <PaymentSummary money={{ ...payment, total }} compact />
          </Panel>
        </div>
      </div>
    </>
  );
}

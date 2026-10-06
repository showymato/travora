"use client";

import { useRouter } from "next/navigation";
import { Car, Mountain, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { ActivityDialog, TransportDialog, blankActivity, blankTransport } from "@/components/trips/line-forms";
import { ActivityCard, TransportCard } from "@/components/trips/line-cards";
import { ItineraryActions, type TemplateOption } from "@/components/trips/itinerary-actions";
import { ItineraryBuilder, builderKey } from "@/components/trips/itinerary-builder";
import { addDays, fmtDow, nightsBetween, toISO } from "@/lib/dates";
import type { TransportInput } from "@/lib/schemas";
import type { TripFull } from "@/server/trips/queries";
import { WizardFooter, stepHref } from "./frame";

/**
 * Transfers implied by the plan that aren't booked yet: airport pickup on
 * arrival, a transfer at each change of hotel, and the airport drop.
 */
export function transportSuggestions(trip: TripFull): { label: string; input: TransportInput }[] {
  const start = toISO(trip.startDate);
  const end = toISO(trip.endDate);
  if (!start || !end) return [];
  const has = (date: string, pred: (t: TripFull["transports"][number]) => boolean = () => true) => trip.transports.some((t) => toISO(t.date) === date && pred(t));
  const firstPlace = trip.destinations[0]?.name ?? trip.hotels[0]?.hotel.location.split(",")[0] ?? "";
  const lastPlace = trip.destinations.at(-1)?.name ?? firstPlace;
  const out: { label: string; input: TransportInput }[] = [];
  const firstStay = trip.hotels[0];
  if (!has(start, (t) => t.kind === "AIRPORT_TRANSFER")) {
    out.push({ label: `Airport pickup on ${fmtDow(start)}`, input: blankTransport(start, { kind: "AIRPORT_TRANSFER", pickup: firstPlace ? `${firstPlace} Airport` : "Airport", dropoff: firstStay?.hotel.name ?? "Hotel" }) });
  }
  for (let i = 1; i < trip.hotels.length; i++) {
    const prev = trip.hotels[i - 1];
    const next = trip.hotels[i];
    const date = toISO(next.checkIn)!;
    if (prev.hotelId !== next.hotelId && !has(date)) {
      out.push({
        label: `${prev.hotel.name} → ${next.hotel.name} on ${fmtDow(date)}`,
        input: blankTransport(date, { kind: "INTERCITY", time: prev.hotel.checkOutTime, pickup: prev.hotel.name, dropoff: `${next.hotel.name}, ${next.hotel.location.split(",")[0]}` }),
      });
    }
  }
  if (nightsBetween(start, end) > 0 && !has(end, (t) => t.kind === "AIRPORT_TRANSFER")) {
    const lastStay = trip.hotels.at(-1);
    out.push({ label: `Airport drop on ${fmtDow(end)}`, input: blankTransport(end, { kind: "AIRPORT_TRANSFER", pickup: lastStay?.hotel.name ?? "Hotel", dropoff: lastPlace ? `${lastPlace} Airport` : "Airport" }) });
  }
  return out;
}

export function TransportStep({ tripId, trip }: { tripId: string; trip: TripFull }) {
  const router = useRouter();
  const range = { min: toISO(trip.startDate)!, max: toISO(trip.endDate)! };
  const suggestions = transportSuggestions(trip);
  return (
    <>
      {suggestions.length ? (
        <div className="mb-5 rounded-xl border border-dashed bg-accent/30 p-4">
          <p className="flex items-center gap-2 text-[13.5px] font-medium">
            <Sparkles className="size-4 text-primary" aria-hidden /> Suggested from your plan
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestions.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                <span className="min-w-0 truncate text-[13px]">{s.label}</span>
                <TransportDialog
                  tripId={tripId}
                  range={range}
                  initial={s.input}
                  title={s.label}
                  trigger={
                    <Button size="xs" variant="outline">
                      <Plus aria-hidden /> Add
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">Transfers ({trip.transports.length})</h2>
        <TransportDialog
          tripId={tripId}
          range={range}
          initial={blankTransport(range.min, { kind: "LOCAL" })}
          trigger={
            <Button variant="outline" size="sm">
              <Plus className="size-3.5" aria-hidden /> Add transport
            </Button>
          }
        />
      </div>
      {trip.transports.length ? (
        <ul className="space-y-2">
          {trip.transports.map((t) => (
            <TransportCard key={t.id} t={t} tripId={tripId} range={range} />
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<Car />} title="No transport yet" description="Airport transfers, intercity drives and local cars. Added transport appears in the itinerary automatically." />
      )}
      <WizardFooter back={stepHref(tripId, 5)} onContinue={() => router.push(stepHref(tripId, 7))} />
    </>
  );
}

export function ActivitiesStep({ tripId, trip }: { tripId: string; trip: TripFull }) {
  const router = useRouter();
  const range = { min: toISO(trip.startDate)!, max: toISO(trip.endDate)! };
  const firstFullDay = addDays(range.min, 1) <= range.max ? addDays(range.min, 1) : range.min;
  const quick = [
    { label: "Sightseeing", input: blankActivity(firstFullDay, { kind: "SIGHTSEEING", time: "10:00" }) },
    { label: "Experience", input: blankActivity(firstFullDay, { kind: "EXPERIENCE", time: "16:00" }) },
    { label: "Meal", input: blankActivity(range.min, { kind: "MEAL", time: "20:00", title: "Dinner" }) },
  ];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold">Activities ({trip.activities.length})</h2>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <ActivityDialog
              key={q.label}
              tripId={tripId}
              range={range}
              initial={q.input}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus className="size-3.5" aria-hidden /> {q.label}
                </Button>
              }
            />
          ))}
        </div>
      </div>
      {trip.activities.length ? (
        <ul className="space-y-2">
          {trip.activities.map((a) => (
            <ActivityCard key={a.id} a={a} tripId={tripId} range={range} />
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<Mountain />} title="No activities yet" description="Add sightseeing, experiences and meals — or skip this and start from a template in the next step." />
      )}
      <WizardFooter back={stepHref(tripId, 6)} onContinue={() => router.push(stepHref(tripId, 8))} />
    </>
  );
}

export function ItineraryStep({ tripId, trip, templates }: { tripId: string; trip: TripFull; templates: TemplateOption[] }) {
  const router = useRouter();
  const nights = nightsBetween(toISO(trip.startDate), toISO(trip.endDate));
  const hasItems = trip.days.some((d) => d.items.length);
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13.5px] text-muted-foreground">
          {hasItems ? "Drag items to reorder or move them between days. Every change is saved." : "Build a day-by-day skeleton from your hotels, transfers and activities — or start from a template."}
        </p>
        <ItineraryActions tripId={tripId} templates={templates} hasItems={hasItems} nights={nights} />
      </div>
      {trip.days.length ? (
        <ItineraryBuilder key={builderKey(trip.days)} tripId={tripId} days={trip.days} />
      ) : (
        <EmptyState title="No itinerary yet" description="Generate one to get a timeline for every day of the trip. Nothing is invented: flights and missing transfers are marked for you to fill in." />
      )}
      <WizardFooter back={stepHref(tripId, 7)} onContinue={() => router.push(stepHref(tripId, 9))} continueLabel="Review trip" />
    </>
  );
}

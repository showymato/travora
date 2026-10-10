"use client";

import { useRouter } from "next/navigation";
import { CalendarRange, Car, Mountain, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { ActivityDialog, TransportDialog, blankActivity, blankTransport } from "@/components/trips/line-forms";
import { ActivityCard, TransportCard } from "@/components/trips/line-cards";
import { ItineraryActions, type TemplateOption } from "@/components/trips/itinerary-actions";
import { ItineraryBuilder, builderKey } from "@/components/trips/itinerary-builder";
import { addDays, fmtDow, nightsBetween, toISO } from "@/lib/dates";
import type { TransportInput } from "@/lib/schemas";
import type { TripFull } from "@/server/trips/queries";
import { useAction } from "@/lib/use-action";
import { createDaysAction } from "@/server/actions/trips";
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
  const items = trip.days.flatMap((d) => d.items);
  const hasItems = items.length > 0;
  const gaps = items.filter((i) => i.notes && /^(Add flight|Transport not)/.test(i.notes)).length;
  const createDays = useAction(() => createDaysAction(tripId), { success: "Days created — add items to each one." });
  const nightStay: Record<string, string> = {};
  for (const h of trip.hotels) {
    for (let d = toISO(h.checkIn)!; d < toISO(h.checkOut)!; d = addDays(d, 1)) nightStay[d] = h.hotel.name;
  }
  const sources = [
    `${nights + 1} day${nights === 0 ? "" : "s"}`,
    `${trip.destinations.length} destination${trip.destinations.length === 1 ? "" : "s"}`,
    `${trip.hotels.length} hotel stay${trip.hotels.length === 1 ? "" : "s"}`,
    `${trip.transports.length} transfer${trip.transports.length === 1 ? "" : "s"}`,
    `${trip.activities.length} activit${trip.activities.length === 1 ? "y" : "ies"}`,
  ];

  if (!hasItems) {
    return (
      <>
        <section className="rounded-xl border bg-card px-5 py-8 text-center sm:px-10 sm:py-10">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarRange className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">Build your itinerary</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-muted-foreground">Create your day-by-day schedule from selected hotels, transfers and activities, or start from a template. Everything stays editable.</p>
          <p className="mt-3 text-[12.5px] text-muted-foreground">Uses {sources.join(" · ")}</p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
            <ItineraryActions tripId={tripId} templates={templates} hasItems={false} nights={nights} />
            {trip.days.length ? null : (
              <Button variant="ghost" disabled={createDays.pending} onClick={() => createDays.run()}>
                <Plus className="size-4" aria-hidden /> Add items manually
              </Button>
            )}
          </div>
          <p className="mx-auto mt-5 max-w-md text-[12px] text-muted-foreground">Nothing is invented: arrivals without flight details and hotel changes without transport are added as clearly marked placeholders for you to complete.</p>
        </section>
        {trip.days.length ? (
          <div className="mt-6">
            <ItineraryBuilder key={builderKey(trip.days)} tripId={tripId} days={trip.days} nightStay={nightStay} />
          </div>
        ) : null}
        <WizardFooter back={stepHref(tripId, 7)} onContinue={() => router.push(stepHref(tripId, 9))} continueLabel="Review trip" />
      </>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="font-medium tabular">
              {trip.days.length} days · {items.length} item{items.length === 1 ? "" : "s"}
            </span>
            {gaps ? (
              <span className="inline-flex items-center gap-1.5 text-warn">
                <span className="size-1.5 rounded-full bg-warn" aria-hidden /> {gaps} placeholder{gaps === 1 ? "" : "s"} to complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-ok">
                <span className="size-1.5 rounded-full bg-ok" aria-hidden /> No missing details
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Drag items to reorder or move them between days. Every change is saved.</p>
        </div>
        <ItineraryActions tripId={tripId} templates={templates} hasItems nights={nights} />
      </div>
      <ItineraryBuilder key={builderKey(trip.days)} tripId={tripId} days={trip.days} nightStay={nightStay} />
      <WizardFooter back={stepHref(tripId, 7)} onContinue={() => router.push(stepHref(tripId, 9))} continueLabel="Review trip" />
    </>
  );
}

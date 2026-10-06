import type { Metadata } from "next";
import Link from "next/link";
import { requireAgentPage } from "@/server/auth/context";
import { getTrip } from "@/server/trips/queries";
import { listAgentHotels, listDestinations } from "@/server/hotels";
import { listTemplatesForAgent } from "@/server/templates";
import { readinessIssues, guestTripUrl } from "@/server/trips/publish";
import { reviewWarnings } from "@/server/trips/checks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { WizardFrame } from "@/components/trips/wizard/frame";
import { segmentsFor, stepHref } from "@/lib/plan";
import { GuestStep } from "@/components/trips/wizard/step-guest";
import { DatesStep } from "@/components/trips/wizard/step-dates";
import { DestinationsStep } from "@/components/trips/wizard/step-destinations";
import { HotelsStep } from "@/components/trips/wizard/step-hotels";
import { RoomsStep } from "@/components/trips/wizard/step-rooms";
import { ActivitiesStep, ItineraryStep, TransportStep } from "@/components/trips/wizard/step-lines";
import { ReviewStep, SendStep } from "@/components/trips/wizard/step-review";
import { TripSummaryCard } from "@/components/trips/trip-summary";
import { nightsBetween, toISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Plan trip" };

const COPY: Record<number, [string, string]> = {
  1: ["Who's travelling?", "Select the primary guest and everyone travelling with them."],
  2: ["When are they travelling?", "Arrival and departure dates. Nights and days are calculated for you."],
  3: ["Where are they going?", "Add destinations in the order they'll visit. Nights split automatically — adjust if needed."],
  4: ["Where will they stay?", "Only hotels assigned to your agency are shown, at your agency's rates."],
  5: ["Choose rooms", "Room types, meal plans and dates for each hotel. Dates come from the stay — override per room if needed."],
  6: ["How will they get around?", "Airport transfers, intercity drives and local cars. Suggestions come from your hotels."],
  7: ["What will they do?", "Sightseeing, experiences and meals — each one lands in the itinerary."],
  8: ["Build the itinerary", "The heart of the trip: a day-by-day timeline you can edit, reorder and send."],
  9: ["Review the trip", "Check everything once, set the price, then save."],
  10: ["Send to guest", "Publish the trip page and let the guest know."],
};

export default async function PlanPage({ params, searchParams }: PageProps<"/app/trips/[id]/plan">) {
  const actor = await requireAgentPage();
  const { id } = await params;
  const sp = await searchParams;
  const { trip, lines, computed, total } = await getTrip(actor, id);
  const requested = Number(sp.step);
  const step = Number.isInteger(requested) && requested >= 1 && requested <= 10 ? requested : Math.min(Math.max(trip.wizardStep, 1), 10);
  const savedAt = trip.updatedAt.toISOString();
  const start = toISO(trip.startDate);
  const end = toISO(trip.endDate);
  const [title, description] = COPY[step];
  const frame = (children: React.ReactNode) => (
    <WizardFrame tripId={trip.id} code={trip.code} step={step} reached={trip.wizardStep} title={title} description={description} savedAt={savedAt} summary={step > 1 ? <TripSummaryCard trip={trip} total={total} /> : null}>
      {children}
    </WizardFrame>
  );

  // Every step after dates needs dates.
  if (step >= 3 && (!start || !end)) {
    return frame(
      <EmptyState
        title="Set the travel dates first"
        description="Hotels, transfers and the itinerary all depend on the dates."
        action={
          <Button asChild>
            <Link href={stepHref(trip.id, 2)}>Go to dates</Link>
          </Button>
        }
      />,
    );
  }

  switch (step) {
    case 1:
      return frame(
        <GuestStep
          tripId={trip.id}
          initial={{
            primaryId: trip.primaryGuestId,
            guests: trip.guests.map((g) => ({ id: g.guest.id, fullName: g.guest.fullName, phone: g.guest.phone, email: g.guest.email })),
            adults: trip.adults,
            children: trip.children,
            infants: trip.infants,
          }}
        />,
      );
    case 2:
      return frame(<DatesStep tripId={trip.id} initial={{ startDate: start, endDate: end }} savedAt={savedAt} />);
    case 3: {
      const catalog = await listDestinations();
      return frame(
        <DestinationsStep
          tripId={trip.id}
          start={start!}
          nights={nightsBetween(start, end)}
          initial={trip.destinations.map((d) => ({ name: d.name, destinationId: d.destinationId, nights: d.nights }))}
          catalog={catalog}
          savedAt={savedAt}
        />,
      );
    }
    case 4: {
      const hotels = await listAgentHotels(actor);
      return frame(
        <HotelsStep
          tripId={trip.id}
          segments={segmentsFor(start!, end!, trip.destinations)}
          hotels={hotels}
          stays={trip.hotels.map((h) => ({ id: h.id, hotelId: h.hotelId, checkIn: toISO(h.checkIn)!, checkOut: toISO(h.checkOut)!, name: h.hotel.name }))}
        />,
      );
    }
    case 5: {
      const hotels = await listAgentHotels(actor, { includeInactive: true });
      return frame(<RoomsStep tripId={trip.id} trip={trip} hotels={hotels} />);
    }
    case 6:
      return frame(<TransportStep tripId={trip.id} trip={trip} />);
    case 7:
      return frame(<ActivitiesStep tripId={trip.id} trip={trip} />);
    case 8: {
      const templates = await listTemplatesForAgent(actor);
      return frame(<ItineraryStep tripId={trip.id} trip={trip} templates={templates} />);
    }
    case 9:
      return frame(<ReviewStep tripId={trip.id} trip={trip} lines={lines} computed={computed} total={total} issues={readinessIssues(trip)} warnings={reviewWarnings(trip)} />);
    default:
      return frame(<SendStep tripId={trip.id} trip={trip} url={trip.shareToken && trip.shareEnabled ? guestTripUrl(trip.shareToken) : null} />);
  }
}

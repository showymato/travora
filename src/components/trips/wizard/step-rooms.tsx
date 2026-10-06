"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { StayCard } from "@/components/trips/stay-editor";
import { formatINR } from "@/lib/money";
import { toISO } from "@/lib/dates";
import { addStayRoomAction } from "@/server/actions/trips";
import type { AgentHotel } from "@/server/hotels";
import type { TripFull } from "@/server/trips/queries";
import { WizardFooter, stepHref } from "./frame";

/** Suggest enough rooms of the cheapest fitting type for the party. */
function suggestion(hotel: AgentHotel, adults: number, children: number) {
  const party = adults + children;
  const rooms = [...hotel.rooms].sort((a, b) => a.rate - b.rate);
  const room = rooms.find((r) => r.capacity >= Math.min(party, 3)) ?? rooms[0];
  if (!room) return null;
  const quantity = Math.max(1, Math.ceil(adults / Math.min(2, room.capacity)));
  const mealPlan = room.mealPlans.includes("CP") ? "CP" : room.mealPlans[0];
  return { room, quantity, guests: party, mealPlan };
}

export function RoomsStep({ tripId, trip, hotels }: { tripId: string; trip: TripFull; hotels: AgentHotel[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const range = { min: toISO(trip.startDate)!, max: toISO(trip.endDate)! };
  const missing = trip.hotels.filter((h) => !h.rooms.length);

  const applySuggestion = async (stay: TripFull["hotels"][number]) => {
    const hotel = hotels.find((h) => h.id === stay.hotelId);
    const s = hotel && suggestion(hotel, trip.adults, trip.children);
    if (!s) return;
    setBusy(stay.id);
    const r = await addStayRoomAction(stay.id, { roomId: s.room.id, quantity: s.quantity, guests: s.guests, mealPlan: s.mealPlan, checkIn: toISO(stay.checkIn)!, checkOut: toISO(stay.checkOut)! });
    setBusy(null);
    if (r.ok) {
      toast.success(`Added ${s.quantity} × ${s.room.name}`);
      router.refresh();
    } else toast.error(r.message);
  };

  if (!trip.hotels.length) {
    return (
      <>
        <EmptyState title="No hotels on this trip" description="Add hotels in step 04, or continue if the guest arranges their own stay." action={<Button variant="outline" onClick={() => router.push(stepHref(tripId, 4))}>Choose hotels</Button>} />
        <WizardFooter back={stepHref(tripId, 4)} onContinue={() => router.push(stepHref(tripId, 6))} />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {trip.hotels.map((stay) => {
          const hotel = hotels.find((h) => h.id === stay.hotelId);
          const s = !stay.rooms.length && hotel ? suggestion(hotel, trip.adults, trip.children) : null;
          return (
            <div key={stay.id} className="space-y-2">
              {s ? (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed bg-accent/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[13.5px]">
                    <span className="font-medium">Suggested for {stay.hotel.name}:</span> {s.quantity} × {s.room.name} · {s.mealPlan} · {formatINR(s.room.rate)}/night
                  </p>
                  <Button size="sm" onClick={() => applySuggestion(stay)} disabled={busy === stay.id}>
                    <Wand2 className="size-3.5" aria-hidden /> {busy === stay.id ? "Adding…" : "Use suggestion"}
                  </Button>
                </div>
              ) : null}
              <StayCard stay={stay} hotel={hotel} range={range} />
            </div>
          );
        })}
      </div>
      <WizardFooter
        back={stepHref(tripId, 4)}
        onContinue={() => {
          if (missing.length) toast.warning(`${missing.map((m) => m.hotel.name).join(", ")} has no rooms yet — you can add them later.`);
          router.push(stepHref(tripId, 6));
        }}
      />
    </>
  );
}

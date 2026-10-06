import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Globe, MapPin, Phone } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { listAgentHotels } from "@/server/hotels";
import { Panel } from "@/components/app/page";
import { HotelCover, Stars } from "@/components/app/visuals";
import { formatINR } from "@/lib/money";
import { fmtTime } from "@/lib/dates";
import { MEAL_PLAN_SHORT, type MealPlanValue } from "@/lib/labels";

export const metadata: Metadata = { title: "Hotel" };

export default async function AgentHotelPage({ params }: PageProps<"/app/hotels/[id]">) {
  const actor = await requireAgentPage();
  const { id } = await params;
  // Only hotels assigned to this agency resolve; anything else is a 404.
  const [hotel] = await listAgentHotels(actor, { hotelId: id, includeInactive: true });
  if (!hotel) notFound();
  return (
    <>
      <Link href="/app/hotels" className="mb-3 inline-flex text-[13px] text-muted-foreground hover:text-foreground">
        ← Hotels
      </Link>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="h-48 sm:h-64">
          <HotelCover name={hotel.name} image={hotel.images[0]} rounded={false} />
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em]">{hotel.name}</h1>
            <Stars category={hotel.category} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {hotel.address ?? hotel.location}
            </span>
            {hotel.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" aria-hidden /> {hotel.phone}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden /> Check-in {fmtTime(hotel.checkInTime)} · Check-out {fmtTime(hotel.checkOutTime)}
            </span>
          </p>
          {hotel.description ? <p className="mt-4 max-w-3xl text-[15px] leading-relaxed">{hotel.description}</p> : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Rooms & your rates" bodyClassName="p-0">
          <ul className="divide-y">
            {hotel.rooms.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-[13px] text-muted-foreground">{[r.description, r.bedConfig, `Up to ${r.capacity} guests`].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">Meal plans: {r.mealPlans.map((m) => MEAL_PLAN_SHORT[m as MealPlanValue]).join(", ")}</p>
                </div>
                <p className="text-right">
                  <span className="text-[17px] font-semibold tabular">{formatINR(r.rate)}</span>
                  <span className="block text-[12px] text-muted-foreground">per room / night</span>
                </p>
              </li>
            ))}
            {!hotel.rooms.length ? <li className="px-5 py-6 text-[13.5px] text-muted-foreground">No rooms are currently available.</li> : null}
          </ul>
        </Panel>
        <div className="space-y-5">
          <Panel title="Amenities">
            <ul className="flex flex-wrap gap-1.5">
              {hotel.amenities.map((a) => (
                <li key={a} className="rounded-full border bg-surface px-2.5 py-1 text-[12.5px]">
                  {a}
                </li>
              ))}
            </ul>
          </Panel>
          {hotel.cancellationPolicy ? (
            <Panel title="Cancellation policy">
              <p className="text-[13.5px]">{hotel.cancellationPolicy}</p>
            </Panel>
          ) : null}
          <p className="flex items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground">
            <Globe className="size-3.5" aria-hidden /> Rates are confidential to {actor.agencyName}.
          </p>
        </div>
      </div>
    </>
  );
}

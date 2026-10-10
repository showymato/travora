import type { ReactNode } from "react";
import { Check, MapPin, ShieldCheck, Utensils } from "lucide-react";
import { HotelCover, Stars } from "@/components/app/visuals";
import { formatINR } from "@/lib/money";
import { MEAL_PLAN_SHORT, type MealPlanValue } from "@/lib/labels";
import { policySummary, stayEstimate } from "@/lib/hotel-search";
import { cn } from "@/lib/utils";
import type { AgentHotel } from "@/server/hotels";

/**
 * Dense, horizontal hotel result for comparing properties in the trip wizard.
 * Shows only agent-safe data: the agency's own rates.
 */
export function HotelResultCard({
  hotel,
  nights,
  party,
  selected,
  onOpen,
  actions,
}: {
  hotel: AgentHotel;
  nights: number;
  party: number;
  selected?: ReactNode;
  onOpen: () => void;
  actions: ReactNode;
}) {
  const estimate = stayEstimate(hotel, party, nights);
  const mealPlans = [...new Set(hotel.rooms.flatMap((r) => r.mealPlans))] as MealPlanValue[];
  const policy = policySummary(hotel.cancellationPolicy);
  const bookable = hotel.rooms.length > 0;
  return (
    <article
      className={cn(
        "group relative grid grid-cols-1 overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-150 sm:grid-cols-[176px_minmax(0,1fr)]",
        selected ? "border-primary/70 ring-1 ring-primary/30" : "hover:border-foreground/20",
      )}
    >
      <div className="relative block aspect-[21/9] w-full overflow-hidden sm:aspect-auto sm:h-full sm:min-h-[168px]">
        <HotelCover name={hotel.name} image={hotel.images[0]} rounded={false} className="transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" />
        {hotel.images.length > 1 ? <span className="absolute right-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white tabular">{hotel.images.length} photos</span> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3 p-4 md:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[15px] leading-tight font-semibold">
              <button type="button" onClick={onOpen} className="text-left after:absolute after:inset-0 hover:underline focus-visible:outline-none">
                {hotel.name}
              </button>
            </h3>
            <Stars category={hotel.category} />
          </div>
          <p className="mt-1 flex items-center gap-1 text-[12.5px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{[hotel.location, hotel.destination && !hotel.location.includes(hotel.destination) ? hotel.destination : null].filter(Boolean).join(" · ")}</span>
          </p>
          {hotel.description ? <p className="mt-2 line-clamp-2 text-[13px] text-muted-foreground">{hotel.description}</p> : null}
          {hotel.amenities.length ? (
            <ul className="mt-2.5 flex flex-wrap gap-1" aria-label="Amenities">
              {hotel.amenities.slice(0, 4).map((a) => (
                <li key={a} className="rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] text-muted-foreground">
                  {a}
                </li>
              ))}
              {hotel.amenities.length > 4 ? <li className="px-1 py-0.5 text-[11.5px] text-muted-foreground">+{hotel.amenities.length - 4}</li> : null}
            </ul>
          ) : null}
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            {mealPlans.length ? (
              <span className="inline-flex items-center gap-1">
                <Utensils className="size-3" aria-hidden /> {mealPlans.map((m) => MEAL_PLAN_SHORT[m]).join(" · ")}
              </span>
            ) : null}
            {policy ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <ShieldCheck className="size-3 shrink-0" aria-hidden /> <span className="truncate">{policy}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 flex-row items-end justify-between gap-3 border-t pt-3 md:w-[164px] md:flex-col md:items-end md:border-t-0 md:border-l md:pt-0 md:pl-4">
          <div className="md:text-right">
            {selected ? (
              <p className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11.5px] font-medium text-primary">
                <Check className="size-3" aria-hidden /> Selected
              </p>
            ) : null}
            {bookable && hotel.fromRate !== null ? (
              <>
                <p className="text-[11.5px] text-muted-foreground">from</p>
                <p className="text-[17px] leading-tight font-semibold tabular">
                  {formatINR(hotel.fromRate)}
                  <span className="text-[12px] font-normal text-muted-foreground"> /night</span>
                </p>
                {estimate && nights > 0 ? (
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground tabular" title="Cheapest room type that fits the party, at your agency rate">
                    ≈ {formatINR(estimate.total)} · {nights}N · {estimate.rooms} room{estimate.rooms === 1 ? "" : "s"}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">No rooms available</p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 md:w-full md:flex-col-reverse md:items-stretch [&>*]:md:w-full">{actions}</div>
        </div>
      </div>
      {selected ? <div className="relative z-10 border-t bg-primary/[0.06] px-4 py-2.5 sm:col-span-2">{selected}</div> : null}
    </article>
  );
}

export function HotelResultSkeleton() {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border bg-card sm:grid-cols-[176px_minmax(0,1fr)]" aria-hidden>
      <div className="aspect-[16/9] animate-pulse bg-muted sm:aspect-auto sm:h-[168px]" />
      <div className="space-y-2.5 p-4">
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { HotelCover, Stars } from "@/components/app/visuals";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { AgentHotel } from "@/server/hotels";

/** Hotel card showing only agent-safe data (agency's own rate). */
export function HotelCard({ hotel, action, selected, className, href }: { hotel: AgentHotel; action?: ReactNode; selected?: boolean; className?: string; href?: string }) {
  const title = href ? (
    <a href={href} className="after:absolute after:inset-0 hover:underline">
      {hotel.name}
    </a>
  ) : (
    hotel.name
  );
  return (
    <article className={cn("relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-[0_4px_16px_rgba(16,24,40,0.06)]", selected && "border-primary ring-2 ring-primary/15", className)}>
      <div className="relative aspect-[16/9] w-full">
        <HotelCover name={hotel.name} image={hotel.images[0]} rounded={false} />
        {selected ? <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground">On this trip</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold">{title}</h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted-foreground">
              <MapPin className="size-3 shrink-0" aria-hidden /> {hotel.location}
            </p>
          </div>
          <Stars category={hotel.category} className="shrink-0 pt-0.5" />
        </div>
        <ul className="mt-3 space-y-1 text-[13px]">
          {hotel.rooms.slice(0, 3).map((r) => (
            <li key={r.id} className="flex justify-between gap-2">
              <span className="truncate text-muted-foreground">{r.name}</span>
              <span className="shrink-0 tabular">{formatINR(r.rate)}</span>
            </li>
          ))}
          {hotel.rooms.length > 3 ? <li className="text-[12px] text-muted-foreground">+{hotel.rooms.length - 3} more room types</li> : null}
          {hotel.rooms.length === 0 ? <li className="text-[12.5px] text-muted-foreground">No rooms available</li> : null}
        </ul>
        {hotel.amenities.length ? <p className="mt-3 line-clamp-1 text-[12px] text-muted-foreground">{hotel.amenities.slice(0, 5).join(" · ")}</p> : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <p className="text-[12px] text-muted-foreground">
            {hotel.fromRate !== null ? (
              <>
                From <span className="text-[15px] font-semibold text-foreground tabular">{formatINR(hotel.fromRate)}</span> / night
              </>
            ) : (
              "Rates on request"
            )}
          </p>
          {action ? <div className="relative z-10">{action}</div> : null}
        </div>
      </div>
    </article>
  );
}

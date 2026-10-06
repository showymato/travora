import { BedDouble, CalendarDays, Car, MapPin, Mountain, Users } from "lucide-react";
import { fmtRange, nightsBetween, toISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { TripFull } from "@/server/trips/queries";
import { TripStatusBadge } from "@/components/app/badges";

/** Compact running summary shown beside the wizard. */
export function TripSummaryCard({ trip, total }: { trip: TripFull; total: number }) {
  const n = nightsBetween(toISO(trip.startDate), toISO(trip.endDate));
  const rows: [React.ReactNode, string, string][] = [
    [<Users key="u" />, "Guest", trip.primaryGuest ? `${trip.primaryGuest.fullName}${trip.adults + trip.children > 1 ? ` +${trip.adults + trip.children - 1}` : ""}` : "—"],
    [<CalendarDays key="c" />, "Dates", trip.startDate ? `${fmtRange(trip.startDate, trip.endDate)} · ${n}N` : "—"],
    [<MapPin key="m" />, "Route", trip.destinations.map((d) => d.name).join(" → ") || "—"],
    [<BedDouble key="b" />, "Hotels", trip.hotels.length ? trip.hotels.map((h) => h.hotel.name).join(", ") : "—"],
    [<Car key="t" />, "Transfers", `${trip.transports.length} transfer${trip.transports.length === 1 ? "" : "s"}`],
    [<Mountain key="a" />, "Activities", `${trip.activities.length} activit${trip.activities.length === 1 ? "y" : "ies"}`],
  ];
  return (
    <div className="sticky top-20 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[12px] text-muted-foreground">{trip.code}</span>
        <TripStatusBadge status={trip.status} />
      </div>
      <dl className="mt-3 space-y-2.5">
        {rows.map(([icon, k, v]) => (
          <div key={k} className="flex gap-2.5 text-[13px]">
            <dt className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-3.5">
              {icon}
              <span className="sr-only">{k}</span>
            </dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-baseline justify-between border-t pt-3">
        <span className="text-[12.5px] text-muted-foreground">Total</span>
        <span className="text-[17px] font-semibold tabular">{formatINR(total)}</span>
      </div>
    </div>
  );
}

import { BedDouble, CalendarDays, Car, MapPin, Mountain, Users } from "lucide-react";
import { fmtRange, fmtShort, nightsBetween, toISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { travellerSummary } from "@/lib/plan";
import { groupTotals, type PricedLine } from "@/lib/pricing";
import type { TripFull } from "@/server/trips/queries";
import { TripStatusBadge } from "@/components/app/badges";

type Props = { trip: TripFull; lines: PricedLine[]; total: number; overridden: boolean };

function facts({ trip, lines, total, overridden }: Props) {
  const n = nightsBetween(toISO(trip.startDate), toISO(trip.endDate));
  const rooms = trip.hotels.reduce((s, h) => s + h.rooms.reduce((a, r) => a + r.quantity, 0), 0);
  const groups = groupTotals(lines);
  const unconfirmed = trip.hotels.filter((h) => h.confirmationStatus !== "CONFIRMED").length;
  const unpriced = trip.transports.filter((t) => !t.price).length + trip.activities.filter((a) => !a.price).length;
  return { n, rooms, groups, unconfirmed, unpriced, total, overridden };
}

/** Running summary beside the wizard. Everything is derived from the saved trip. */
export function TripSummaryCard(props: Props) {
  return (
    <div className="sticky top-20 rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-mono text-[12px] text-muted-foreground">{props.trip.code}</span>
        <TripStatusBadge status={props.trip.status} />
      </div>
      <div className="px-4 py-3">
        <TripSummaryBody {...props} />
      </div>
    </div>
  );
}

/** One-line label for the collapsed summary on smaller screens. */
export function TripSummaryLabel({ trip, total }: { trip: TripFull; total: number }) {
  const n = nightsBetween(toISO(trip.startDate), toISO(trip.endDate));
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="min-w-0 truncate">
        <span className="font-mono text-[12px] text-muted-foreground">{trip.code}</span>
        <span className="text-muted-foreground"> · </span>
        {trip.startDate ? `${fmtShort(trip.startDate)} · ${n}N` : "No dates"}
        {trip.destinations.length ? <span className="text-muted-foreground"> · {trip.destinations.map((d) => d.name).join(" → ")}</span> : null}
      </span>
      <span className="shrink-0 font-semibold tabular">{formatINR(total)}</span>
    </span>
  );
}

export function TripSummaryBody(props: Props) {
  const { trip } = props;
  const f = facts(props);
  const guests = trip.guests.map((g) => g.guest.fullName);
  const rows: [React.ReactNode, string, React.ReactNode][] = [
    [
      <Users key="u" />,
      "Guests",
      guests.length ? (
        <>
          {guests.slice(0, 2).join(", ")}
          {guests.length > 2 ? ` +${guests.length - 2}` : ""}
          <span className="block text-[12px] text-muted-foreground">{travellerSummary(trip.adults, trip.children, trip.infants)}</span>
        </>
      ) : (
        "—"
      ),
    ],
    [<CalendarDays key="c" />, "Dates", trip.startDate ? `${fmtRange(trip.startDate, trip.endDate)} · ${f.n} night${f.n === 1 ? "" : "s"}` : "—"],
    [<MapPin key="m" />, "Route", trip.destinations.length ? trip.destinations.map((d) => `${d.name}${d.nights ? ` ${d.nights}N` : ""}`).join(" → ") : "—"],
    [
      <BedDouble key="b" />,
      "Stays",
      trip.hotels.length ? (
        <ul className="space-y-0.5">
          {trip.hotels.map((h) => (
            <li key={h.id}>
              {h.hotel.name}
              <span className="text-muted-foreground"> · {nightsBetween(toISO(h.checkIn), toISO(h.checkOut))}N</span>
            </li>
          ))}
          <li className="text-[12px] text-muted-foreground">
            {f.rooms} room{f.rooms === 1 ? "" : "s"}
            {f.unconfirmed ? ` · ${f.unconfirmed} unconfirmed` : ""}
          </li>
        </ul>
      ) : (
        <span className="text-muted-foreground">No hotels yet</span>
      ),
    ],
    [<Car key="t" />, "Transport", `${trip.transports.length} transfer${trip.transports.length === 1 ? "" : "s"}`],
    [<Mountain key="a" />, "Activities", `${trip.activities.length} activit${trip.activities.length === 1 ? "y" : "ies"}`],
  ];
  return (
    <>
      <dl className="space-y-2.5">
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
      <dl className="mt-4 space-y-1 border-t pt-3 text-[12.5px]">
        {(
          [
            ["Accommodation", f.groups.Hotels],
            ["Transport", f.groups.Transport],
            ["Activities", f.groups.Activities],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular">{formatINR(v)}</dd>
          </div>
        ))}
        {f.overridden ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Package price set</dt>
            <dd className="text-muted-foreground">overrides lines</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 flex items-baseline justify-between border-t pt-3">
        <span className="text-[12.5px] text-muted-foreground">{trip.status === "DRAFT" ? "Estimated total" : "Total"}</span>
        <span className="text-[18px] font-semibold tabular">{formatINR(f.total)}</span>
      </div>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        GST-inclusive · your agency rates
        {f.unpriced ? ` · ${f.unpriced} item${f.unpriced === 1 ? "" : "s"} without a price` : ""}
      </p>
    </>
  );
}

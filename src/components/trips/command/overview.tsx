import Link from "next/link";
import { ArrowRight, BedDouble, CheckCircle2, CircleDashed, Clock, MapPin, Navigation } from "lucide-react";
import { Panel } from "@/components/app/page";
import { ConfirmationBadge, PaymentBadge } from "@/components/app/badges";
import { ItemIcon } from "@/components/trips/item-icon";
import { diffDays, fmtDateTime, fmtDow, fmtRelative, fmtShort, fmtTime, todayISO, toISO } from "@/lib/dates";
import { formatINR, type PaymentState } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TripFull } from "@/server/trips/queries";

type Money = { total: number; paid: number; pending: number; state: PaymentState };

/** Where is the guest, what's happening today, and what's next. */
export function NowPanel({ trip, tz }: { trip: TripFull; tz?: string }) {
  const today = todayISO(tz);
  const start = toISO(trip.startDate);
  const end = toISO(trip.endDate);
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: tz ?? "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  if (!start || !end) {
    return (
      <Panel title="Right now">
        <p className="text-[14px] text-muted-foreground">Set the travel dates to see where the guest is each day.</p>
      </Panel>
    );
  }
  const phase = today < start ? "before" : today > end ? "after" : "during";
  const stay = trip.hotels.find((h) => toISO(h.checkIn)! <= today && toISO(h.checkOut)! > today);
  const todayDay = trip.days.find((d) => toISO(d.date) === today);
  const allItems = trip.days.flatMap((d) => d.items.map((i) => ({ ...i, date: toISO(d.date)!, dayNumber: d.dayNumber })));
  const next = allItems.find((i) => i.date > today || (i.date === today && i.time && i.time > now));
  const dayIndex = diffDays(start, today) + 1;

  const headline =
    phase === "before"
      ? `Arrives ${diffDays(today, start) === 1 ? "tomorrow" : `in ${diffDays(today, start)} days`}`
      : phase === "after"
        ? "Trip finished"
        : `Day ${dayIndex} of ${diffDays(start, end) + 1}`;
  const where = phase === "during" ? (stay ? `Staying at ${stay.hotel.name}, ${stay.hotel.location.split(",")[0]}` : today === end ? "Departure day" : "No hotel tonight") : phase === "before" ? `First stop: ${trip.destinations[0]?.name ?? trip.hotels[0]?.hotel.location ?? "—"}` : `Returned ${fmtShort(end)}`;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="bg-card p-5">
          <p className="flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            <Navigation className="size-3.5 text-teal" aria-hidden /> Right now
          </p>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.01em]">{headline}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {where}
          </p>
          {next ? (
            <div className="mt-5 rounded-lg border bg-surface/60 p-3">
              <p className="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">Next up</p>
              <div className="mt-1.5 flex items-start gap-3">
                <ItemIcon type={next.type} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{next.title}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {next.date === today ? "Today" : fmtDow(next.date)}
                    {next.time ? ` · ${fmtTime(next.time)}` : ""}
                    {next.location ? ` · ${next.location}` : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="bg-card p-5">
          <p className="flex items-center justify-between text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            <span>Today{todayDay ? ` · Day ${todayDay.dayNumber}` : ""}</span>
            <Link href="?tab=itinerary" className="inline-flex items-center gap-1 normal-case tracking-normal text-foreground/70 hover:text-foreground">
              Itinerary <ArrowRight className="size-3" aria-hidden />
            </Link>
          </p>
          {todayDay?.items.length ? (
            <ol className="mt-3 space-y-2.5">
              {todayDay.items.map((i) => {
                const done = i.time ? i.time <= now : false;
                return (
                  <li key={i.id} className="flex items-start gap-3">
                    <span className="w-[60px] shrink-0 pt-1 text-right text-[12.5px] text-muted-foreground tabular">{i.time ? fmtTime(i.time) : "—"}</span>
                    <ItemIcon type={i.type} size="sm" />
                    <div className="min-w-0 pt-0.5">
                      <p className={cn("truncate text-[13.5px] font-medium", done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                        {i.title}
                        {done ? <span className="sr-only"> (done)</span> : null}
                      </p>
                      {i.location ? <p className="truncate text-[12px] text-muted-foreground">{i.location}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 text-[13.5px] text-muted-foreground">{phase === "during" ? "Nothing scheduled today — a free day." : phase === "before" ? `Nothing yet — the trip starts ${fmtDow(start)}.` : "This trip has finished."}</p>
          )}
        </div>
      </div>
    </section>
  );
}

type Check = { label: string; done: boolean; detail?: string; href?: string };

export function tripChecklist(trip: TripFull, money: Money): Check[] {
  const stays = trip.hotels;
  const unconfirmed = stays.filter((h) => h.confirmationStatus !== "CONFIRMED");
  const driverless = trip.transports.filter((t) => !t.driverName || !t.driverPhone || !t.vehicleNumber);
  const placeholders = trip.days.flatMap((d) => d.items).filter((i) => i.notes && /^(Add flight|Transport not)/.test(i.notes));
  const g = trip.primaryGuest;
  return [
    { label: "Itinerary built", done: trip.days.some((d) => d.items.length), detail: placeholders.length ? `${placeholders.length} item(s) need details` : undefined, href: "?tab=itinerary" },
    { label: "Sent to guest", done: Boolean(trip.publishedVersion), detail: trip.hasUnpublishedChanges ? "Unpublished changes" : trip.sentAt ? `Version ${trip.publishedVersion}` : undefined },
    { label: "Hotels confirmed", done: stays.length > 0 && unconfirmed.length === 0, detail: stays.length ? `${stays.length - unconfirmed.length} of ${stays.length}` : "No hotels", href: "?tab=hotels" },
    { label: "Driver details", done: driverless.length === 0, detail: trip.transports.length ? `${trip.transports.length - driverless.length} of ${trip.transports.length} complete` : "No transfers", href: "?tab=transport" },
    { label: "Payment received", done: money.state === "PAID", detail: money.total ? `${formatINR(money.paid)} of ${formatINR(money.total)}` : "No price set", href: "?tab=payments" },
    { label: "Documents generated", done: trip.documents.length > 0, detail: trip.documents.length ? `${trip.documents.length} document(s)` : undefined, href: "?tab=documents" },
    { label: "Guest contact & ID", done: Boolean(g?.phone && g?.email && g?.idType), detail: g ? [!g.phone && "phone", !g.email && "email", !g.idType && "ID"].filter(Boolean).join(", ") || undefined : "No guest", href: g ? `/app/guests/${g.id}` : undefined },
  ];
}

export function Checklist({ items }: { items: Check[] }) {
  const done = items.filter((i) => i.done).length;
  return (
    <Panel title="Confirmed vs pending" description={`${done} of ${items.length} done`}>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={items.length} aria-label="Trip readiness">
        <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="-mx-2">
        {items.map((c) => {
          const body = (
            <>
              {c.done ? <CheckCircle2 className="size-4 shrink-0 text-ok" aria-label="Done" /> : <CircleDashed className="size-4 shrink-0 text-warn" aria-label="Pending" />}
              <span className="flex-1 text-[13.5px]">{c.label}</span>
              {c.detail ? <span className="text-right text-[12px] text-muted-foreground">{c.detail}</span> : null}
            </>
          );
          return (
            <li key={c.label}>
              {c.href ? (
                <Link href={c.href} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/70">
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 px-2 py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function PaymentSummary({ money, compact = false }: { money: Money & { overpaid?: number }; compact?: boolean }) {
  const pct = money.total ? Math.min(100, Math.round((money.paid / money.total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted-foreground">Trip total</span>
        <PaymentBadge state={money.state} />
      </div>
      <p className={cn("mt-1 font-semibold tracking-[-0.01em] tabular", compact ? "text-[22px]" : "text-[28px]")}>{formatINR(money.total)}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Paid">
        <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="font-medium tabular">{formatINR(money.paid)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Pending</dt>
          <dd className={cn("font-medium tabular", money.pending > 0 && "text-warn")}>{formatINR(money.pending)}</dd>
        </div>
      </dl>
      {money.overpaid ? <p className="mt-2 text-[12.5px] text-info">Overpaid by {formatINR(money.overpaid)} — consider a refund.</p> : null}
    </div>
  );
}

export function StaysMini({ trip }: { trip: TripFull }) {
  if (!trip.hotels.length) return <p className="text-[13.5px] text-muted-foreground">No hotels on this trip.</p>;
  return (
    <ol className="relative space-y-3">
      {trip.hotels.map((h) => (
        <li key={h.id} className="flex items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
            <BedDouble className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium">{h.hotel.name}</p>
            <p className="text-[12.5px] text-muted-foreground tabular">
              {fmtShort(h.checkIn)} → {fmtShort(h.checkOut)} · {h.rooms.map((r) => `${r.quantity}× ${r.roomName}`).join(", ") || "no rooms"}
            </p>
          </div>
          <ConfirmationBadge status={h.confirmationStatus} />
        </li>
      ))}
    </ol>
  );
}

export function ActivityFeed({ entries }: { entries: { id: string; summary: string | null; action: string; userName: string | null; createdAt: Date }[] }) {
  if (!entries.length) return <p className="text-[13.5px] text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-px before:bg-border">
      {entries.map((e) => (
        <li key={e.id} className="relative flex gap-3 pl-6">
          <span className="absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-card bg-muted-foreground/40" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13.5px]">
              {e.userName ? <span className="font-medium">{e.userName.split(" ")[0]} </span> : null}
              <span className="text-foreground/85">{lowerFirst(e.summary ?? e.action)}</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground" title={fmtDateTime(e.createdAt)}>
              <Clock className="size-3" aria-hidden /> {fmtRelative(e.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function lowerFirst(s: string) {
  // "Added guest X" reads as "Rahul added guest X"; keep codes/names intact.
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemIcon } from "@/components/trips/item-icon";
import { EmptyState } from "@/components/app/states";
import { addDays, eachDay, fmtDow, fmtLong, fmtMonth, fmtShort, fmtTime, fmtWeekday, toDate, toISO, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CalEvent } from "@/server/ops";

export type CalView = "month" | "week" | "day";

/** Visible range for a view anchored on a date (weeks start Monday). */
export function calendarRange(view: CalView, anchor: string) {
  if (view === "day") return { from: anchor, to: anchor };
  const weekStart = (d: string) => addDays(d, -((toDate(d).getUTCDay() + 6) % 7));
  if (view === "week") {
    const from = weekStart(anchor);
    return { from, to: addDays(from, 6) };
  }
  const first = `${anchor.slice(0, 7)}-01`;
  const d = toDate(first);
  const last = toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))!;
  const from = weekStart(first);
  const to = addDays(weekStart(last), 6);
  return { from, to, first, last };
}

function shift(view: CalView, anchor: string, dir: 1 | -1) {
  if (view === "day") return addDays(anchor, dir);
  if (view === "week") return addDays(anchor, 7 * dir);
  const d = toDate(`${anchor.slice(0, 7)}-01`);
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1)))!;
}

const KIND_LABEL: Record<CalEvent["kind"], string> = {
  TRIP_START: "Arrival",
  TRIP_END: "Departure",
  CHECK_IN: "Check-in",
  CHECK_OUT: "Check-out",
  TRANSPORT: "Transfer",
  ACTIVITY: "Activity",
};
const KIND_ICON: Record<CalEvent["kind"], string> = { TRIP_START: "ARRIVAL", TRIP_END: "DEPARTURE", CHECK_IN: "CHECK_IN", CHECK_OUT: "CHECK_OUT", TRANSPORT: "TRANSPORT", ACTIVITY: "ACTIVITY" };

function Chip({ e, compact = false }: { e: CalEvent; compact?: boolean }) {
  const travelCue = e.kind === "TRIP_START" || e.kind === "TRIP_END";
  return (
    <Link
      href={e.href}
      title={`${KIND_LABEL[e.kind]} · ${e.title}${e.subtitle ? ` · ${e.subtitle}` : ""} (${e.tripCode})`}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] leading-5 transition-colors hover:bg-muted",
        travelCue ? "bg-teal-soft/70 text-foreground" : "text-foreground/85",
        e.status === "CANCELLED" && "line-through opacity-60",
      )}
    >
      <ItemIcon type={KIND_ICON[e.kind]} className="size-4 border-0 bg-transparent [&_svg]:size-3" />
      {!compact && e.time ? <span className="shrink-0 text-muted-foreground tabular">{fmtTime(e.time).replace(" ", "").toLowerCase()}</span> : null}
      <span className="truncate">{e.title}</span>
    </Link>
  );
}

function EventRow({ e }: { e: CalEvent }) {
  return (
    <li>
      <Link href={e.href} className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
        <span className="w-[64px] shrink-0 pt-1 text-right text-[12.5px] text-muted-foreground tabular">{e.time ? fmtTime(e.time) : "All day"}</span>
        <ItemIcon type={KIND_ICON[e.kind]} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{e.title}</span>
          <span className="block truncate text-[12.5px] text-muted-foreground">
            {KIND_LABEL[e.kind]} · {e.subtitle} · {e.tripCode}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function CalendarView({ view, anchor, events, basePath }: { view: CalView; anchor: string; events: CalEvent[]; basePath: string }) {
  const today = todayISO();
  const range = calendarRange(view, anchor);
  const href = (v: CalView, d: string) => `${basePath}?view=${v}&date=${d}`;
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const title = view === "month" ? fmtMonth(anchor) : view === "week" ? `${fmtShort(range.from)} – ${fmtShort(range.to)}` : fmtLong(anchor);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-4">
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon-sm">
            <Link href={href(view, shift(view, anchor, -1))} aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon-sm">
            <Link href={href(view, shift(view, anchor, 1))} aria-label="Next">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href(view, today)}>Today</Link>
          </Button>
        </div>
        <h2 className="px-2 text-[16px] font-semibold" aria-live="polite">
          {title}
        </h2>
        <div role="tablist" aria-label="Calendar view" className="ml-auto flex rounded-lg border p-0.5">
          {(["month", "week", "day"] as const).map((v) => (
            <Link key={v} role="tab" aria-selected={v === view} href={href(v, anchor)} className={cn("rounded-md px-3 py-1 text-[13px] font-medium capitalize", v === view ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {v}
            </Link>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <>
          {/* Grid on md+; agenda list on phones. */}
          <div className="hidden md:block">
            <div className="grid grid-cols-7 border-b text-[12px] font-medium text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="px-2 py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {eachDay(range.from, range.to).map((d) => {
                const list = byDay.get(d) ?? [];
                const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
                return (
                  <div key={d} className={cn("min-h-[116px] min-w-0 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-surface/50")}>
                    <Link href={href("day", d)} className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-[12px] tabular hover:bg-muted", d === today ? "bg-primary font-semibold text-primary-foreground hover:bg-primary" : inMonth ? "text-foreground" : "text-muted-foreground")} aria-label={fmtLong(d)}>
                      {Number(d.slice(8))}
                    </Link>
                    <div className="space-y-0.5">
                      {list.slice(0, 3).map((e) => (
                        <Chip key={e.id} e={e} />
                      ))}
                      {list.length > 3 ? (
                        <Link href={href("day", d)} className="block px-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground">
                          +{list.length - 3} more
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="md:hidden">
            <Agenda days={eachDay(range.first!, range.last!)} byDay={byDay} today={today} />
          </div>
        </>
      ) : view === "week" ? (
        <>
          <div className="hidden grid-cols-7 md:grid">
            {eachDay(range.from, range.to).map((d) => (
              <div key={d} className="min-h-[420px] min-w-0 border-r p-2 last:border-r-0">
                <Link href={href("day", d)} className={cn("mb-2 block rounded-lg px-1.5 py-1 text-[12.5px] hover:bg-muted", d === today && "bg-accent")}>
                  <span className="text-muted-foreground">{fmtWeekday(d)}</span> <span className="font-semibold tabular">{Number(d.slice(8))}</span>
                </Link>
                <div className="space-y-1">
                  {(byDay.get(d) ?? []).map((e) => (
                    <Chip key={e.id} e={e} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="md:hidden">
            <Agenda days={eachDay(range.from, range.to)} byDay={byDay} today={today} />
          </div>
        </>
      ) : (
        <div className="p-2 sm:p-3">
          {(byDay.get(anchor) ?? []).length ? (
            <ol>
              {(byDay.get(anchor) ?? []).map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </ol>
          ) : (
            <EmptyState compact title="Nothing scheduled" description="No arrivals, check-ins, transfers or activities on this day." />
          )}
        </div>
      )}
    </div>
  );
}

function Agenda({ days, byDay, today }: { days: string[]; byDay: Map<string, CalEvent[]>; today: string }) {
  const withEvents = days.filter((d) => byDay.get(d)?.length);
  if (!withEvents.length) return <EmptyState compact title="Nothing scheduled" description="No trip events in this period." />;
  return (
    <ol className="divide-y">
      {withEvents.map((d) => (
        <li key={d} className="px-2 py-2">
          <p className={cn("px-2 pt-1 text-[12.5px] font-semibold", d === today ? "text-primary" : "text-muted-foreground")}>{d === today ? `Today · ${fmtDow(d)}` : fmtDow(d)}</p>
          <ol>
            {byDay.get(d)!.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

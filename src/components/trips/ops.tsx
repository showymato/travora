import Link from "next/link";
import { AlertCircle, ArrowUpRight, CircleAlert, Info, Sun } from "lucide-react";
import { fmtTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PendingAction, TodayEntry } from "@/server/ops";
import { EmptyState } from "@/components/app/states";
import { ItemIcon } from "./item-icon";

/** The "Today" timeline: what happens on the ground, in time order. */
export function TodayTimeline({ entries, hrefFor, showAgency = false }: { entries: TodayEntry[]; hrefFor: (tripId: string) => string; showAgency?: boolean }) {
  if (!entries.length) {
    return <EmptyState compact icon={<Sun />} title="Nothing scheduled today" description="Arrivals, check-ins, transfers and activities for today will appear here." />;
  }
  return (
    <ol className="relative">
      {entries.map((e, i) => (
        <li key={e.id} className="group relative flex gap-3 sm:gap-4">
          <div className="w-[62px] shrink-0 pt-1.5 text-right text-[12.5px] font-medium text-muted-foreground tabular sm:w-[68px]">{e.time ? fmtTime(e.time) : <span className="text-muted-foreground">Any time</span>}</div>
          <div className="relative flex flex-col items-center">
            <ItemIcon type={e.kind === "ITEM" ? e.type : e.kind} size="sm" className="relative z-10 bg-card" />
            {i < entries.length - 1 ? <span className="absolute top-7 bottom-0 w-px bg-border" aria-hidden /> : null}
          </div>
          <Link href={hrefFor(e.tripId)} className={cn("-mt-0.5 mb-3 min-w-0 flex-1 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted/70")}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-[14px] font-medium">{e.title}</p>
              <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{e.tripCode}</span>
            </div>
            <p className="truncate text-[12.5px] text-muted-foreground">{[e.guest, e.detail, showAgency ? e.agency : null].filter(Boolean).join(" · ")}</p>
          </Link>
        </li>
      ))}
    </ol>
  );
}

const SEVERITY = {
  high: { icon: AlertCircle, cls: "text-bad" },
  medium: { icon: CircleAlert, cls: "text-warn" },
  low: { icon: Info, cls: "text-muted-foreground" },
} as const;

export function PendingList({ actions, limit }: { actions: Pick<PendingAction, "id" | "severity" | "title" | "detail" | "href">[]; limit?: number }) {
  const shown = limit ? actions.slice(0, limit) : actions;
  if (!actions.length) {
    return <EmptyState compact title="You're all caught up" description="Hotel confirmations, payments due, missing details and unsent itineraries will show up here." />;
  }
  return (
    <ul className="-mx-2">
      {shown.map((a) => {
        const s = SEVERITY[a.severity];
        const Icon = s.icon;
        return (
          <li key={a.id}>
            <Link href={a.href} className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/70">
              <Icon className={cn("mt-0.5 size-4 shrink-0", s.cls)} aria-label={`${a.severity} priority`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">{a.title}</p>
                <p className="truncate text-[12.5px] text-muted-foreground">{a.detail}</p>
              </div>
              <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

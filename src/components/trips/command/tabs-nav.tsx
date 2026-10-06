import Link from "next/link";
import { cn } from "@/lib/utils";

export const TRIP_TABS = [
  ["overview", "Overview"],
  ["itinerary", "Itinerary"],
  ["hotels", "Hotels"],
  ["transport", "Transport"],
  ["guests", "Guests"],
  ["documents", "Documents"],
  ["payments", "Payments"],
  ["activity", "Activity"],
] as const;
export type TripTab = (typeof TRIP_TABS)[number][0];

/** URL-driven tabs so every tab is linkable and survives refresh. */
export function TabsNav({ base, current, counts }: { base: string; current: TripTab; counts?: Partial<Record<TripTab, number>> }) {
  return (
    <nav aria-label="Trip sections" className="scrollbar-none -mx-4 mb-6 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {TRIP_TABS.map(([key, label]) => {
          const active = key === current;
          return (
            <li key={key}>
              <Link
                href={key === "overview" ? base : `${base}?tab=${key}`}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "relative flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-medium transition-colors",
                  active ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {counts?.[key] ? <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular">{counts[key]}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

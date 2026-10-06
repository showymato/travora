import {
  BedDouble,
  CalendarClock,
  Car,
  Coffee,
  Landmark,
  LogOut,
  Mountain,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  StickyNote,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ITEM_ICON: Record<string, LucideIcon> = {
  FLIGHT: Plane,
  TRAIN: TrainFront,
  AIRPORT_ARRIVAL: PlaneLanding,
  AIRPORT_DEPARTURE: PlaneTakeoff,
  HOTEL_CHECK_IN: BedDouble,
  HOTEL_CHECK_OUT: LogOut,
  TRANSPORT: Car,
  SIGHTSEEING: Landmark,
  ACTIVITY: Mountain,
  EXPERIENCE: Mountain,
  MEAL: UtensilsCrossed,
  FREE_TIME: Coffee,
  CUSTOM: CalendarClock,
  NOTE: StickyNote,
  // Transport/activity kinds and calendar kinds reuse the same vocabulary.
  AIRPORT_TRANSFER: Car,
  INTERCITY: Car,
  LOCAL: Car,
  ARRIVAL: PlaneLanding,
  DEPARTURE: PlaneTakeoff,
  CHECK_IN: BedDouble,
  CHECK_OUT: LogOut,
};

/** Subtle, monochrome icon tile — type is conveyed by shape, not colour. */
export function ItemIcon({ type, className, size = "md" }: { type: string; className?: string; size?: "sm" | "md" }) {
  const Icon = ITEM_ICON[type] ?? CalendarClock;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground",
        size === "sm" ? "size-7 [&_svg]:size-3.5" : "size-8 [&_svg]:size-4",
        className,
      )}
    >
      <Icon />
    </span>
  );
}

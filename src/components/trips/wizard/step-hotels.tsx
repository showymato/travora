"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Check, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HotelCard } from "@/components/hotels/hotel-card";
import { EmptyState } from "@/components/app/states";
import { fmtShort, nightsBetween } from "@/lib/dates";
import type { PlanSegment } from "@/lib/plan";
import { HOTEL_CATEGORIES, HOTEL_CATEGORY_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { addStayAction } from "@/server/actions/trips";
import type { AgentHotel } from "@/server/hotels";
import { WizardFooter, stepHref } from "./frame";


export function HotelsStep({
  tripId,
  segments,
  hotels,
  stays,
}: {
  tripId: string;
  segments: PlanSegment[];
  hotels: AgentHotel[];
  stays: { id: string; hotelId: string; checkIn: string; checkOut: string; name: string }[];
}) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const seg = segments[active] ?? segments[0];
  const [dest, setDest] = useState<string>(seg?.destinationId ?? "all");
  const [category, setCategory] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  const allAmenities = useMemo(() => [...new Set(hotels.flatMap((h) => h.amenities))].sort(), [hotels]);
  const filtered = hotels.filter(
    (h) =>
      (dest === "all" || h.destinationId === dest) &&
      (category === "all" || h.category === category) &&
      (!maxPrice || (h.fromRate ?? Infinity) <= Number(maxPrice)) &&
      amenities.every((a) => h.amenities.includes(a)),
  );
  const destinations = useMemo(() => {
    const m = new Map<string, string>();
    hotels.forEach((h) => h.destinationId && h.destination && m.set(h.destinationId, h.destination));
    return [...m.entries()];
  }, [hotels]);

  const pick = (i: number) => {
    setActive(i);
    const s = segments[i];
    setDest(s.destinationId && destinations.some(([id]) => id === s.destinationId) ? s.destinationId : "all");
  };

  const add = async (hotel: AgentHotel) => {
    if (!seg || nightsBetween(seg.from, seg.to) < 1) {
      toast.error("This destination has no nights. Adjust nights in step 03.");
      return;
    }
    setAdding(hotel.id);
    const r = await addStayAction(tripId, { hotelId: hotel.id, checkIn: seg.from, checkOut: seg.to });
    setAdding(null);
    if (!r.ok) return toast.error(r.message);
    toast.success(`${hotel.name} added for ${fmtShort(seg.from)} → ${fmtShort(seg.to)}`);
    if (active < segments.length - 1) pick(active + 1);
    router.refresh();
  };

  const staysFor = (s: PlanSegment) => stays.filter((x) => x.checkIn < s.to && x.checkOut > s.from);

  if (!hotels.length) {
    return (
      <>
        <EmptyState icon={<BedDouble />} title="No hotels assigned to your agency yet" description="Your TRAVORA administrator controls which hotels you can book. You can still continue and add transport, activities and the itinerary." />
        <WizardFooter back={stepHref(tripId, 3)} onContinue={() => router.push(stepHref(tripId, 6))} continueLabel="Skip to transport" />
      </>
    );
  }

  return (
    <>
      <div role="tablist" aria-label="Destination" className="scrollbar-none -mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
        {segments.map((s, i) => {
          const covered = staysFor(s);
          return (
            <button
              key={`${s.name}-${i}`}
              role="tab"
              aria-selected={i === active}
              onClick={() => pick(i)}
              className={cn("flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors", i === active ? "border-primary bg-accent/60" : "bg-card hover:border-foreground/20")}
            >
              <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-semibold", covered.length ? "bg-ok-soft text-ok" : "bg-muted text-muted-foreground")}>
                {covered.length ? <Check className="size-3.5" aria-label="Hotel chosen" /> : i + 1}
              </span>
              <span>
                <span className="block text-[13.5px] font-medium">{s.name}</span>
                <span className="block text-[12px] text-muted-foreground tabular">
                  {fmtShort(s.from)} → {fmtShort(s.to)} · {nightsBetween(s.from, s.to)}N
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {seg && staysFor(seg).length ? (
        <div className="mb-4 rounded-xl border bg-ok-soft/40 px-4 py-3 text-[13.5px]">
          <span className="font-medium">Staying in {seg.name}:</span> {staysFor(seg).map((s) => `${s.name} (${fmtShort(s.checkIn)}–${fmtShort(s.checkOut)})`).join(", ")}.{" "}
          <span className="text-muted-foreground">Add another hotel to split the stay, or continue.</span>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={dest} onValueChange={setDest}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Destination filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All destinations</SelectItem>
            {destinations.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Category filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any category</SelectItem>
            {HOTEL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {HOTEL_CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Max ₹ / night" className="w-full sm:w-36" aria-label="Maximum price per night" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="size-4" aria-hidden /> Amenities{amenities.length ? ` (${amenities.length})` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="grid max-h-64 gap-2 overflow-y-auto">
              {allAmenities.map((a) => (
                <label key={a} className="flex items-center gap-2 text-[13.5px]">
                  <Checkbox checked={amenities.includes(a)} onCheckedChange={(c) => setAmenities((xs) => (c ? [...xs, a] : xs.filter((x) => x !== a)))} />
                  {a}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="text-[12.5px] text-muted-foreground sm:ml-auto">
          {filtered.length} of {hotels.length} hotels
        </span>
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((h) => {
            const onTrip = stays.some((s) => s.hotelId === h.id);
            return (
              <HotelCard
                key={h.id}
                hotel={h}
                selected={onTrip}
                action={
                  <Button size="sm" variant={onTrip ? "outline" : "default"} onClick={() => add(h)} disabled={adding !== null || h.rooms.length === 0} aria-label={`Add ${h.name} for ${seg?.name}`}>
                    {adding === h.id ? "Adding…" : (
                      <>
                        <Plus className="size-3.5" aria-hidden /> {seg && segments.length > 1 ? `Stay in ${seg.name}` : "Add to trip"}
                      </>
                    )}
                  </Button>
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState compact title="No hotels match these filters" description="Clear a filter or choose “All destinations”." />
      )}

      <WizardFooter back={stepHref(tripId, 3)} onContinue={() => router.push(stepHref(tripId, 5))} continueLabel={stays.length ? "Continue to rooms" : "Continue without hotels"} />
    </>
  );
}

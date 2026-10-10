"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownUp, BedDouble, CalendarRange, Check, ChevronDown, Info, MapPin, Moon, Pencil, Search, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/app/states";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { HotelResultCard } from "@/components/hotels/hotel-result-card";
import { HotelSheet, type ExistingStay } from "@/components/hotels/hotel-sheet";
import { fmtShort, nightsBetween } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { PlanSegment } from "@/lib/plan";
import { HOTEL_CATEGORIES, HOTEL_CATEGORY_LABEL, MEAL_PLAN_LABEL, MEAL_PLANS, type MealPlanValue } from "@/lib/labels";
import { HOTEL_SORTS, NO_FILTERS, activeFilterCount, filterHotels, hotelsForDestination, sortHotels, type HotelFilters, type HotelSort } from "@/lib/hotel-search";
import { cn } from "@/lib/utils";
import { planStayAction, removeStayAction } from "@/server/actions/trips";
import type { AgentHotel } from "@/server/hotels";
import { WizardFooter, stepHref } from "./frame";

export type PlannedStay = {
  id: string;
  hotelId: string;
  name: string;
  checkIn: string;
  checkOut: string;
  total: number;
  rooms: { roomId: string; roomName: string; quantity: number; mealPlan: string; nightlyRate: number }[];
};

const overlaps = (s: { checkIn: string; checkOut: string }, seg: PlanSegment) => s.checkIn < seg.to && s.checkOut > seg.from;

export function HotelsStep({ tripId, segments, hotels, stays, party }: { tripId: string; segments: PlanSegment[]; hotels: AgentHotel[]; stays: PlannedStay[]; party: number }) {
  const router = useRouter();
  const staysFor = (seg: PlanSegment) => stays.filter((s) => overlaps(s, seg));
  const [active, setActive] = useState(() => Math.max(0, segments.findIndex((s) => nightsBetween(s.from, s.to) > 0 && !staysFor(s).length)));
  const [filters, setFilters] = useState<HotelFilters>(NO_FILTERS);
  const [sort, setSort] = useState<HotelSort>("recommended");
  const [showAll, setShowAll] = useState(false);
  const [sheet, setSheet] = useState<{ hotelId: string; focusRooms: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const seg = segments[active] ?? segments[0];
  const nights = nightsBetween(seg.from, seg.to);
  const segStays = staysFor(seg);
  const scoped = useMemo(() => (showAll ? hotels : hotelsForDestination(hotels, { ...seg, isWholeTrip: seg.whole })), [hotels, seg, showAll]);
  const results = useMemo(() => sortHotels(filterHotels(scoped, filters), sort, party), [scoped, filters, sort, party]);
  const allAmenities = useMemo(() => [...new Set(scoped.flatMap((h) => h.amenities))].sort(), [scoped]);
  const unplanned = segments.filter((s) => nightsBetween(s.from, s.to) > 0 && !staysFor(s).length);

  const sheetHotel = sheet ? (hotels.find((h) => h.id === sheet.hotelId) ?? null) : null;
  // The stay this selection edits: the same hotel in this destination, or the one stay it would replace.
  const existingStay = sheetHotel ? (segStays.find((s) => s.hotelId === sheetHotel.id) ?? (segStays.length === 1 ? segStays[0] : null)) : null;
  const existing: ExistingStay | null = existingStay ? { id: existingStay.id, hotelId: existingStay.hotelId, hotelName: existingStay.name, rooms: existingStay.rooms } : null;
  const sheetRange = existingStay && existingStay.hotelId === sheetHotel?.id ? { from: existingStay.checkIn, to: existingStay.checkOut } : { from: seg.from, to: seg.to };

  const choose = (i: number) => {
    setActive(i);
    setShowAll(false);
    setFilters(NO_FILTERS);
  };

  const save = async (rooms: { roomId: string; quantity: number; guests: number; mealPlan: MealPlanValue }[]) => {
    if (!sheetHotel) return;
    setSaving(true);
    let r;
    try {
      r = await planStayAction(tripId, { stayId: existing?.id ?? null, hotelId: sheetHotel.id, checkIn: sheetRange.from, checkOut: sheetRange.to, rooms });
    } catch {
      r = { ok: false as const, message: "We couldn't reach the server. Check your connection and try again." };
    }
    setSaving(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    toast.success(r.data.replaced ? `Replaced with ${sheetHotel.name}` : r.data.created ? `${sheetHotel.name} added for ${seg.name}` : `${sheetHotel.name} updated`);
    setSheet(null);
    const next = segments.findIndex((s, i) => i !== active && nightsBetween(s.from, s.to) > 0 && !staysFor(s).length);
    if (r.data.created && next >= 0) choose(next);
    router.refresh();
  };

  if (!hotels.length) {
    return (
      <>
        <EmptyState icon={<BedDouble />} title="No hotels assigned to your agency yet" description="Your TRAVORA administrator controls which hotels you can book and at what rate. You can still continue and add transport, activities and the itinerary." />
        <WizardFooter back={stepHref(tripId, 3)} onContinue={() => router.push(stepHref(tripId, 6))} continueLabel="Continue without hotels" />
      </>
    );
  }

  const set = <K extends keyof HotelFilters>(k: K, v: HotelFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const toggle = <K extends "categories" | "amenities" | "mealPlans">(k: K, v: HotelFilters[K][number]) =>
    setFilters((f) => ({ ...f, [k]: (f[k] as string[]).includes(v) ? (f[k] as string[]).filter((x) => x !== v) : [...f[k], v] }));
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(filters.q.trim() ? [{ key: "q", label: `“${filters.q.trim()}”`, clear: () => set("q", "") }] : []),
    ...filters.categories.map((c) => ({ key: `c${c}`, label: HOTEL_CATEGORY_LABEL[c as keyof typeof HOTEL_CATEGORY_LABEL], clear: () => toggle("categories", c) })),
    ...(filters.maxPrice !== null ? [{ key: "p", label: `Up to ${formatINR(filters.maxPrice)}/night`, clear: () => set("maxPrice", null) }] : []),
    ...filters.mealPlans.map((m) => ({ key: `m${m}`, label: MEAL_PLAN_LABEL[m], clear: () => toggle("mealPlans", m) })),
    ...filters.amenities.map((a) => ({ key: `a${a}`, label: a, clear: () => toggle("amenities", a) })),
  ];
  const rates = scoped.map((h) => h.fromRate).filter((r): r is number => r !== null);
  const pricePresets = [3000, 5000, 8000, 12000, 20000].filter((p) => rates.some((r) => r <= p) && rates.some((r) => r > p));

  return (
    <>
      {/* Stays by destination */}
      <section aria-labelledby="stays-title" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 id="stays-title" className="text-[13.5px] font-semibold">
            Stays by destination
          </h2>
          <span className="text-[12px] text-muted-foreground tabular">
            {segments.length - unplanned.length} of {segments.length} planned
          </span>
        </div>
        <ol className="divide-y">
          {segments.map((s, i) => {
            const n = nightsBetween(s.from, s.to);
            const list = staysFor(s);
            const isActive = i === active;
            return (
              <li key={`${s.name}-${i}`} className={cn("relative flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:gap-4", isActive ? "bg-primary/[0.07]" : "hover:bg-muted/40")}>
                {isActive ? <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden /> : null}
                <button type="button" onClick={() => choose(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none" aria-current={isActive ? "true" : undefined} aria-label={`Find hotels in ${s.name}`}>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold", list.length ? "bg-ok-soft text-ok" : n ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground/60")}>
                    {list.length ? <Check className="size-3.5" aria-label="Planned" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium">{s.name}</span>
                    <span className="block text-[12px] text-muted-foreground tabular">
                      {fmtShort(s.from)} → {fmtShort(s.to)} · {n} night{n === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
                <div className="min-w-0 pl-10 sm:flex-1 sm:pl-0">
                  {list.length ? (
                    list.map((st) => (
                      <div key={st.id} className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 text-[13px]">
                          <span className="font-medium">{st.name}</span>
                          <span className="text-muted-foreground"> · {st.rooms.length ? `${st.rooms.reduce((a, r) => a + r.quantity, 0)} room${st.rooms.reduce((a, r) => a + r.quantity, 0) === 1 ? "" : "s"}` : "no rooms"}</span>
                          {st.total ? <span className="text-muted-foreground tabular"> · {formatINR(st.total)}</span> : null}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit rooms at ${st.name}`}
                          onClick={() => {
                            if (!isActive) choose(i);
                            setSheet({ hotelId: st.hotelId, focusRooms: true });
                          }}
                          disabled={!hotels.some((h) => h.id === st.hotelId)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${st.name}`}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          }
                          title={`Remove ${st.name}?`}
                          description="Its rooms and the check-in/check-out items in the itinerary will be removed. The trip total updates immediately."
                          confirmLabel="Remove stay"
                          destructive
                          onConfirm={async () => {
                            const r = await removeStayAction(st.id);
                            if (r.ok) {
                              toast.success(`${st.name} removed`);
                              router.refresh();
                            } else toast.error(r.message);
                          }}
                        />
                      </div>
                    ))
                  ) : n ? (
                    <p className="flex items-center gap-1.5 text-[13px] text-warn">
                      <span className="size-1.5 rounded-full bg-warn" aria-hidden /> Stay not planned yet
                    </p>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">No nights here — day visit</p>
                  )}
                </div>
                {!isActive && !list.length && n ? (
                  <Button variant="outline" size="sm" className="ml-10 self-start sm:ml-0 sm:self-center" onClick={() => choose(i)}>
                    Find hotels
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Discovery */}
      <section aria-labelledby="find-title" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="find-title" className="text-[18px] font-semibold tracking-[-0.01em]">
              Find the perfect stay{segments.length > 1 || !seg.whole ? ` in ${seg.name}` : ""}
            </h2>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">Compare your assigned properties, agency rates, room options and amenities.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12.5px]">
          <ContextChip icon={<MapPin />}>{showAll ? "All destinations" : seg.name}</ContextChip>
          <ContextChip icon={<CalendarRange />} href={stepHref(tripId, 3)} label="Change dates in destinations">
            {fmtShort(seg.from)} → {fmtShort(seg.to)}
          </ContextChip>
          <ContextChip icon={<Moon />}>
            {nights} night{nights === 1 ? "" : "s"}
          </ContextChip>
          <ContextChip icon={<Users />} href={stepHref(tripId, 1)} label="Change travellers">
            {party} guest{party === 1 ? "" : "s"}
          </ContextChip>
        </div>

        <div className="sticky top-14 z-20 -mx-1 mt-4 space-y-2.5 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search hotel, area or amenity" className="h-10 pl-9" aria-label="Search hotels" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterButton label="Category" count={filters.categories.length}>
              {HOTEL_CATEGORIES.map((c) => (
                <CheckRow key={c} checked={filters.categories.includes(c)} onChange={() => toggle("categories", c)} label={HOTEL_CATEGORY_LABEL[c]} count={scoped.filter((h) => h.category === c).length} />
              ))}
            </FilterButton>
            <FilterButton label="Price" count={filters.maxPrice !== null ? 1 : 0}>
              <label className="block text-[12.5px] font-medium" htmlFor="max-price">
                Max price per night
              </label>
              <Input
                id="max-price"
                value={filters.maxPrice ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  set("maxPrice", v ? Math.min(Number(v), 10_000_000) : null);
                }}
                inputMode="numeric"
                placeholder="e.g. 8000"
                className="mt-1.5 h-8"
              />
              {pricePresets.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {pricePresets.map((p) => (
                    <button key={p} type="button" onClick={() => set("maxPrice", p)} className={cn("rounded-md border px-2 py-0.5 text-[12px] tabular hover:bg-muted", filters.maxPrice === p && "border-primary bg-primary/10")}>
                      ≤ {formatINR(p)}
                    </button>
                  ))}
                </div>
              ) : null}
            </FilterButton>
            <FilterButton label="Meal plan" count={filters.mealPlans.length}>
              {MEAL_PLANS.map((m) => (
                <CheckRow key={m} checked={filters.mealPlans.includes(m)} onChange={() => toggle("mealPlans", m)} label={MEAL_PLAN_LABEL[m]} count={scoped.filter((h) => h.rooms.some((r) => r.mealPlans.includes(m))).length} />
              ))}
            </FilterButton>
            <FilterButton label="Amenities" count={filters.amenities.length} wide>
              {allAmenities.length ? (
                allAmenities.map((a) => <CheckRow key={a} checked={filters.amenities.includes(a)} onChange={() => toggle("amenities", a)} label={a} count={scoped.filter((h) => h.amenities.includes(a)).length} />)
              ) : (
                <p className="text-[12.5px] text-muted-foreground">No amenities listed for these hotels.</p>
              )}
            </FilterButton>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-[12.5px] text-muted-foreground tabular sm:inline" aria-live="polite">
                {results.length} of {scoped.length} hotel{scoped.length === 1 ? "" : "s"}
              </span>
              <Select value={sort} onValueChange={(v) => setSort(v as HotelSort)}>
                <SelectTrigger size="sm" className="h-8 gap-1 text-[12.5px]" aria-label="Sort hotels">
                  <ArrowDownUp className="size-3.5 text-muted-foreground" aria-hidden />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {Object.entries(HOTEL_SORTS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {chips.length || showAll ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {showAll && !seg.whole ? <Chip label="Showing all destinations" onClear={() => setShowAll(false)} /> : null}
              {chips.map((c) => (
                <Chip key={c.key} label={c.label} onClear={c.clear} />
              ))}
              {activeFilterCount(filters) > 1 ? (
                <button type="button" onClick={() => setFilters(NO_FILTERS)} className="px-1 text-[12.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  Clear all
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="text-[12.5px] text-muted-foreground tabular sm:hidden" aria-hidden>
            {results.length} of {scoped.length} hotel{scoped.length === 1 ? "" : "s"}
          </p>
        </div>

        {nights < 1 ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border bg-card px-3.5 py-3 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {seg.name} has no nights in the schedule, so there is no stay to book. Adjust the nights in{" "}
            <Link href={stepHref(tripId, 3)} className="text-foreground underline underline-offset-2">
              destinations
            </Link>
            .
          </p>
        ) : null}

        <div className="mt-3 space-y-3">
          {!scoped.length ? (
            <EmptyState
              compact
              icon={<BedDouble />}
              title={`No assigned hotels in ${seg.name}`}
              description="Your TRAVORA administrator hasn't given your agency access to a hotel here yet. You can continue without a stay for this destination, or look at your hotels in other places."
              action={
                <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                  Show all assigned hotels
                </Button>
              }
            />
          ) : results.length ? (
            results.map((h) => {
              const picked = segStays.find((s) => s.hotelId === h.id);
              return (
                <HotelResultCard
                  key={h.id}
                  hotel={h}
                  nights={nights}
                  party={party}
                  onOpen={() => setSheet({ hotelId: h.id, focusRooms: false })}
                  selected={
                    picked ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                        <span className="min-w-0">
                          {picked.rooms.length ? picked.rooms.map((r) => `${r.quantity} × ${r.roomName}`).join(", ") : "No rooms yet"}
                          <span className="text-muted-foreground tabular">
                            {" "}
                            · {fmtShort(picked.checkIn)} → {fmtShort(picked.checkOut)}
                          </span>
                        </span>
                        <span className="font-medium tabular">{formatINR(picked.total)}</span>
                      </div>
                    ) : undefined
                  }
                  actions={
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setSheet({ hotelId: h.id, focusRooms: false })} aria-label={`Details for ${h.name}`}>
                        Details
                      </Button>
                      <Button size="sm" variant={picked ? "outline" : "default"} disabled={!h.rooms.length || nights < 1} onClick={() => setSheet({ hotelId: h.id, focusRooms: true })} aria-label={`${picked ? "Edit rooms at" : "Select"} ${h.name}`}>
                        {picked ? "Edit rooms" : segStays.length === 1 ? "Replace" : "Select"}
                      </Button>
                    </>
                  }
                />
              );
            })
          ) : (
            <EmptyState
              compact
              title="No hotels match these filters"
              description={`${scoped.length} hotel${scoped.length === 1 ? "" : "s"} in ${showAll ? "your assignments" : seg.name} — loosen a filter to see them.`}
              action={
                <Button variant="outline" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                  Clear filters
                </Button>
              }
            />
          )}
        </div>
      </section>

      <HotelSheet
        hotel={sheetHotel}
        open={Boolean(sheetHotel)}
        onOpenChange={(o) => !o && !saving && setSheet(null)}
        stay={{ label: seg.name, from: sheetRange.from, to: sheetRange.to, nights: nightsBetween(sheetRange.from, sheetRange.to) }}
        party={party}
        existing={existing}
        focusRooms={sheet?.focusRooms ?? false}
        saving={saving}
        onSave={save}
      />

      <WizardFooter
        back={stepHref(tripId, 3)}
        onContinue={() => {
          if (unplanned.length) toast.info(`${unplanned.map((s) => s.name).join(", ")}: stay not planned yet — you can come back to it.`);
          router.push(stepHref(tripId, 5));
        }}
        continueLabel={stays.length ? (unplanned.length ? `Continue · ${unplanned.length} unplanned` : "Continue to rooms") : "Continue without hotels"}
      />
    </>
  );
}

function ContextChip({ icon, children, href, label }: { icon: ReactNode; children: ReactNode; href?: string; label?: string }) {
  const inner = (
    <>
      <span className="text-muted-foreground [&_svg]:size-3.5" aria-hidden>
        {icon}
      </span>
      <span className="tabular">{children}</span>
    </>
  );
  return href ? (
    <Link href={href} title={label} className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-card px-2.5 transition-colors hover:border-foreground/20">
      {inner}
      <span className="sr-only"> — {label}</span>
    </Link>
  ) : (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-card px-2.5">{inner}</span>
  );
}

function FilterButton({ label, count, wide, children }: { label: string; count: number; wide?: boolean; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-1 text-[12.5px]", count && "border-primary/60 bg-primary/10 dark:bg-primary/10")}>
          {label}
          {count ? <span className="rounded bg-primary px-1 text-[10.5px] text-primary-foreground tabular">{count}</span> : null}
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("p-3", wide ? "w-72" : "w-60")}>
        <div className="grid max-h-72 gap-1 overflow-y-auto">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

function CheckRow({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count: number }) {
  return (
    <label className={cn("flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-muted", !count && !checked && "opacity-50")}>
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span className="flex-1">{label}</span>
      <span className="text-[11.5px] text-muted-foreground tabular">{count}</span>
    </label>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border bg-card pr-1 pl-2.5 text-[12.5px]">
      {label}
      <button type="button" onClick={onClear} className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove filter ${label}`}>
        <X className="size-3" />
      </button>
    </span>
  );
}

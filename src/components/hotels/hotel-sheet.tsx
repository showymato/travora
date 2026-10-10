"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BedDouble, Clock, Globe, Loader2, Mail, MapPin, Minus, Phone, Plus, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HotelCover, Stars } from "@/components/app/visuals";
import { formatINR } from "@/lib/money";
import { fmtShort, fmtTime } from "@/lib/dates";
import { MEAL_PLAN_LABEL, type MealPlanValue } from "@/lib/labels";
import { distributeGuests, stayQuote } from "@/lib/pricing";
import { cheapestFit } from "@/lib/hotel-search";
import { cn } from "@/lib/utils";
import type { AgentHotel, AgentRoom } from "@/server/hotels";

export type RoomPick = { quantity: number; mealPlan: MealPlanValue };
export type ExistingStay = { id: string; hotelId: string; hotelName: string; rooms: { roomId: string; quantity: number; mealPlan: string; nightlyRate: number }[] };

/** Starting selection: the stay's current rooms, or the cheapest fit for the party. */
function initialPicks(hotel: AgentHotel, party: number, existing: ExistingStay | null): Record<string, RoomPick> {
  if (existing && existing.hotelId === hotel.id && existing.rooms.length) {
    return Object.fromEntries(existing.rooms.map((r) => [r.roomId, { quantity: r.quantity, mealPlan: r.mealPlan as MealPlanValue }]));
  }
  const fit = cheapestFit(hotel, party);
  const room = hotel.rooms.find((r) => r.id === fit?.roomId);
  if (!fit || !room) return {};
  return { [room.id]: { quantity: fit.rooms, mealPlan: (room.mealPlans.includes("CP") ? "CP" : room.mealPlans[0]) as MealPlanValue } };
}

/**
 * Hotel details and room selection in one keyboard-accessible drawer, so the
 * agent never leaves the wizard. Totals preview with the same pricing rules the
 * server applies when saving.
 */
export function HotelSheet({
  hotel,
  open,
  onOpenChange,
  stay,
  party,
  existing,
  focusRooms,
  saving,
  onSave,
}: {
  hotel: AgentHotel | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stay: { label: string; from: string; to: string; nights: number };
  party: number;
  existing: ExistingStay | null;
  focusRooms: boolean;
  saving: boolean;
  onSave: (rooms: { roomId: string; quantity: number; guests: number; mealPlan: MealPlanValue }[]) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {hotel ? <SheetBody key={hotel.id} hotel={hotel} stay={stay} party={party} existing={existing} focusRooms={focusRooms} saving={saving} onSave={onSave} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({
  hotel,
  stay,
  party,
  existing,
  focusRooms,
  saving,
  onSave,
}: {
  hotel: AgentHotel;
  stay: { label: string; from: string; to: string; nights: number };
  party: number;
  existing: ExistingStay | null;
  focusRooms: boolean;
  saving: boolean;
  onSave: (rooms: { roomId: string; quantity: number; guests: number; mealPlan: MealPlanValue }[]) => void;
}) {
  const [picks, setPicks] = useState<Record<string, RoomPick>>(() => initialPicks(hotel, party, existing));
  const [image, setImage] = useState(0);
  const roomsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusRooms) roomsRef.current?.scrollIntoView({ block: "start" });
  }, [focusRooms]);
  const sameHotel = existing?.hotelId === hotel.id;
  const replacing = existing && !sameHotel ? existing : null;
  const keptRate = (roomId: string) => (sameHotel ? existing?.rooms.find((r) => r.roomId === roomId)?.nightlyRate : undefined);

  const chosen = hotel.rooms.filter((r) => (picks[r.id]?.quantity ?? 0) > 0);
  const guests = distributeGuests(chosen.map((r) => ({ capacity: r.capacity, quantity: picks[r.id].quantity })), party);
  const quote = stayQuote(
    chosen.map((r, i) => ({ roomId: r.id, quantity: picks[r.id].quantity, nightlyRate: keptRate(r.id) ?? r.rate, capacity: r.capacity, guests: guests[i] })),
    stay.nights,
    party,
  );

  const setQty = (room: AgentRoom, q: number) =>
    setPicks((p) => {
      const quantity = Math.max(0, Math.min(20, q));
      const mealPlan = p[room.id]?.mealPlan ?? ((room.mealPlans.includes("CP") ? "CP" : room.mealPlans[0]) as MealPlanValue);
      return { ...p, [room.id]: { quantity, mealPlan } };
    });

  const amenities = useMemo(() => [...new Set(hotel.amenities)], [hotel.amenities]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Gallery */}
        <div className="relative aspect-[16/9] w-full bg-muted">
          <HotelCover name={hotel.name} image={hotel.images[image]} rounded={false} />
        </div>
        {hotel.images.length > 1 ? (
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto px-5 pt-3" role="group" aria-label="Photos">
            {hotel.images.map((img, i) => (
              <button key={img} type="button" onClick={() => setImage(i)} aria-label={`Photo ${i + 1}`} aria-pressed={i === image} className={cn("h-12 w-[72px] shrink-0 overflow-hidden rounded-md ring-offset-2 ring-offset-popover", i === image ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100")}>
                <HotelCover name={hotel.name} image={img} rounded={false} />
              </button>
            ))}
          </div>
        ) : null}

        <SheetHeader className="px-5 pt-4 pb-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pr-8">
            <SheetTitle className="text-[19px] font-semibold tracking-[-0.01em]">{hotel.name}</SheetTitle>
            <Stars category={hotel.category} />
          </div>
          <SheetDescription className="flex items-start gap-1.5 text-[13px]">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{[hotel.address ?? hotel.location, hotel.destination].filter(Boolean).join(" · ")}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 pt-4 pb-6">
          {hotel.description ? <p className="text-[13.5px] leading-relaxed text-muted-foreground">{hotel.description}</p> : null}

          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-lg border bg-card px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Clock className="size-3" aria-hidden /> Check-in
              </dt>
              <dd className="mt-0.5 font-medium tabular">{fmtTime(hotel.checkInTime)}</dd>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Clock className="size-3" aria-hidden /> Check-out
              </dt>
              <dd className="mt-0.5 font-medium tabular">{fmtTime(hotel.checkOutTime)}</dd>
            </div>
          </dl>

          {amenities.length ? (
            <section aria-labelledby="hs-amenities">
              <h3 id="hs-amenities" className="text-[12.5px] font-medium text-muted-foreground">
                Amenities
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {amenities.map((a) => (
                  <li key={a} className="rounded-md border bg-card px-2 py-1 text-[12.5px]">
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hotel.cancellationPolicy ? (
            <section aria-labelledby="hs-policy" className="rounded-lg border bg-card px-3.5 py-3">
              <h3 id="hs-policy" className="flex items-center gap-1.5 text-[12.5px] font-medium">
                <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden /> Cancellation policy
              </h3>
              <p className="mt-1 text-[13px] text-muted-foreground">{hotel.cancellationPolicy}</p>
            </section>
          ) : null}

          {hotel.phone || hotel.email || hotel.website ? (
            <section aria-labelledby="hs-contact">
              <h3 id="hs-contact" className="text-[12.5px] font-medium text-muted-foreground">
                Hotel contact
              </h3>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {hotel.phone ? (
                  <li className="flex items-center gap-2">
                    <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                    <a href={`tel:${hotel.phone}`} className="hover:underline">
                      {hotel.phone}
                    </a>
                  </li>
                ) : null}
                {hotel.email ? (
                  <li className="flex items-center gap-2">
                    <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                    <a href={`mailto:${hotel.email}`} className="break-all hover:underline">
                      {hotel.email}
                    </a>
                  </li>
                ) : null}
                {hotel.website ? (
                  <li className="flex items-center gap-2">
                    <Globe className="size-3.5 text-muted-foreground" aria-hidden />
                    <a href={hotel.website} target="_blank" rel="noreferrer" className="break-all hover:underline">
                      {hotel.website.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {/* Rooms */}
          <section aria-labelledby="hs-rooms" className="scroll-mt-4" ref={roomsRef}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="hs-rooms" className="text-[15px] font-semibold">
                Choose rooms
              </h3>
              <p className="text-[12px] text-muted-foreground tabular">
                {fmtShort(stay.from)} → {fmtShort(stay.to)} · {stay.nights}N · {party} guest{party === 1 ? "" : "s"}
              </p>
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Nightly prices are your agency&apos;s rates. Add more than one room type if the party needs it.</p>
            {hotel.rooms.length ? (
              <ul className="mt-3 space-y-2.5">
                {hotel.rooms.map((r) => (
                  <RoomRow key={r.id} room={r} pick={picks[r.id]} nights={stay.nights} rate={keptRate(r.id) ?? r.rate} kept={keptRate(r.id) !== undefined && keptRate(r.id) !== r.rate} onQty={(q) => setQty(r, q)} onMeal={(m) => setPicks((p) => ({ ...p, [r.id]: { quantity: p[r.id]?.quantity ?? 0, mealPlan: m } }))} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed px-3 py-4 text-[13px] text-muted-foreground">This hotel has no rooms available to your agency right now.</p>
            )}
          </section>
        </div>
      </div>

      {/* Sticky quote */}
      <div className="border-t bg-popover px-5 py-4">
        {quote.lines.length ? (
          <ul className="mb-3 space-y-1 text-[12.5px] text-muted-foreground">
            {quote.lines.map((l) => {
              const r = hotel.rooms.find((x) => x.id === l.roomId)!;
              return (
                <li key={l.roomId} className="flex justify-between gap-3 tabular">
                  <span className="min-w-0 truncate">
                    {r.name} — {l.quantity} room{l.quantity === 1 ? "" : "s"} × {stay.nights} night{stay.nights === 1 ? "" : "s"} × {formatINR(l.nightlyRate)}
                  </span>
                  <span className="shrink-0 text-foreground">{formatINR(l.amount)}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {quote.lines.length && !quote.fitsParty ? (
          <p className="mb-3 flex items-start gap-1.5 rounded-md bg-warn-soft px-2.5 py-1.5 text-[12.5px] text-warn">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> These rooms sleep {quote.capacity}, but {party} are travelling. Add a room or continue if extra beds are arranged.
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11.5px] text-muted-foreground">
              {quote.roomCount ? `${quote.roomCount} room${quote.roomCount === 1 ? "" : "s"} · ${stay.label}` : "No rooms selected"}
            </p>
            <p className="text-[19px] leading-tight font-semibold tabular">{formatINR(quote.total)}</p>
          </div>
          <Button
            disabled={!quote.lines.length || saving || stay.nights < 1}
            onClick={() => onSave(chosen.map((r, i) => ({ roomId: r.id, quantity: picks[r.id].quantity, mealPlan: picks[r.id].mealPlan, guests: guests[i] })))}
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BedDouble className="size-4" aria-hidden />}
            {replacing ? `Replace ${replacing.hotelName}` : sameHotel ? "Update stay" : "Select hotel"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoomRow({ room, pick, nights, rate, kept, onQty, onMeal }: { room: AgentRoom; pick: RoomPick | undefined; nights: number; rate: number; kept: boolean; onQty: (q: number) => void; onMeal: (m: MealPlanValue) => void }) {
  const qty = pick?.quantity ?? 0;
  const meal = pick?.mealPlan ?? ((room.mealPlans.includes("CP") ? "CP" : room.mealPlans[0]) as MealPlanValue);
  return (
    <li className={cn("overflow-hidden rounded-lg border bg-card transition-colors", qty > 0 && "border-primary/60 bg-primary/[0.04]")}>
      <div className="flex gap-3 p-3">
        {room.images[0] ? (
          <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-md sm:block">
            <HotelCover name={room.name} image={room.images[0]} rounded={false} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-medium">{room.name}</p>
            <p className="shrink-0 text-right text-[14px] font-semibold tabular">
              {formatINR(rate)}
              <span className="text-[11.5px] font-normal text-muted-foreground"> /night</span>
            </p>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" aria-hidden /> Sleeps {room.capacity}
            </span>
            {room.bedConfig ? <span>{room.bedConfig}</span> : null}
            {kept ? <span className="text-info">Booked rate kept</span> : null}
          </p>
          {room.description || room.amenities.length ? <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{[room.description, room.amenities.slice(0, 4).join(" · ")].filter(Boolean).join(" — ")}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
        <Select value={meal} onValueChange={(v) => onMeal(v as MealPlanValue)}>
          <SelectTrigger size="sm" className="h-8 w-[180px] text-[12.5px]" aria-label={`Meal plan for ${room.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {room.mealPlans.map((m) => (
              <SelectItem key={m} value={m}>
                {MEAL_PLAN_LABEL[m as MealPlanValue]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {qty > 0 ? <span className="text-[12px] text-muted-foreground tabular">{formatINR(rate * qty * nights)}</span> : null}
          <div className="flex items-center rounded-md border" role="group" aria-label={`Number of ${room.name} rooms`}>
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-r-none" onClick={() => onQty(qty - 1)} disabled={qty === 0} aria-label={`Fewer ${room.name} rooms`}>
              <Minus className="size-3.5" />
            </Button>
            <span className="w-7 text-center text-[13px] font-medium tabular" aria-live="polite">
              {qty}
            </span>
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-l-none" onClick={() => onQty(qty + 1)} disabled={qty >= 20} aria-label={`More ${room.name} rooms`}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRange, Hash, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ConfirmationBadge } from "@/components/app/badges";
import { Field, SubmitButton, toInt } from "@/components/app/form";
import { HotelCover, Stars } from "@/components/app/visuals";
import { fmtDate, fmtShort, nightsBetween, toISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { MEAL_PLAN_LABEL, type MealPlanValue } from "@/lib/labels";
import { stayRoomSchema, stayUpdateSchema, type StayRoomInput, type StayUpdateInput } from "@/lib/schemas";
import { roomLineAmount } from "@/lib/pricing";
import { useAction } from "@/lib/use-action";
import { addStayRoomAction, removeStayAction, removeStayRoomAction, updateStayAction, updateStayRoomAction } from "@/server/actions/trips";
import type { AgentHotel } from "@/server/hotels";
import type { TripFull } from "@/server/trips/queries";

type Stay = TripFull["hotels"][number];
type Range = { min: string; max: string };

export function StayCard({ stay, hotel, range, editable = true, showRooms = true }: { stay: Stay; hotel: AgentHotel | undefined; range: Range; editable?: boolean; showRooms?: boolean }) {
  const remove = useAction(removeStayAction);
  const nights = nightsBetween(toISO(stay.checkIn), toISO(stay.checkOut));
  const total = stay.rooms.reduce((s, r) => s + roomLineAmount(r), 0);
  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <div className="flex gap-4 p-4">
        <div className="hidden h-[72px] w-[104px] shrink-0 sm:block">
          <HotelCover name={stay.hotel.name} image={stay.hotel.images[0]} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="text-[15px] font-semibold">{stay.hotel.name}</h3>
            <Stars category={stay.hotel.category} />
            <ConfirmationBadge status={stay.confirmationStatus} />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{stay.hotel.location}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-1.5 tabular">
              <CalendarRange className="size-3.5 text-muted-foreground" aria-hidden />
              {fmtShort(stay.checkIn)} → {fmtShort(stay.checkOut)} · {nights} night{nights === 1 ? "" : "s"}
            </span>
            {stay.confirmationNumber ? (
              <span className="inline-flex items-center gap-1.5">
                <Hash className="size-3.5 text-muted-foreground" aria-hidden />
                {stay.confirmationNumber}
              </span>
            ) : null}
          </p>
          {stay.notes ? <p className="mt-1 text-[12.5px] text-muted-foreground">{stay.notes}</p> : null}
        </div>
        {editable ? (
          <div className="flex shrink-0 items-start gap-1">
            <StayDialog stay={stay} range={range} />
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${stay.hotel.name}`}>
                  <Trash2 className="size-4" />
                </Button>
              }
              title={`Remove ${stay.hotel.name}?`}
              description="Its rooms and check-in/check-out items will be removed from the trip."
              confirmLabel="Remove hotel"
              destructive
              onConfirm={() => remove.run(stay.id)}
            />
          </div>
        ) : null}
      </div>
      {showRooms ? (
        <div className="border-t bg-surface/40 px-4 py-3">
          {stay.rooms.length ? (
            <ul className="space-y-2">
              {stay.rooms.map((r) => (
                <RoomLine key={r.id} line={r} stay={stay} hotel={hotel} editable={editable} />
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-warn">No rooms selected yet.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {editable && hotel ? (
              <RoomDialog
                stay={stay}
                hotel={hotel}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="size-3.5" aria-hidden /> Add room
                  </Button>
                }
              />
            ) : (
              <span />
            )}
            {total ? (
              <p className="text-[13px] text-muted-foreground">
                Stay total <span className="font-medium text-foreground tabular">{formatINR(total)}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function RoomLine({ line, stay, hotel, editable }: { line: Stay["rooms"][number]; stay: Stay; hotel: AgentHotel | undefined; editable: boolean }) {
  const remove = useAction(removeStayRoomAction);
  const n = nightsBetween(toISO(line.checkIn), toISO(line.checkOut));
  const partial = toISO(line.checkIn) !== toISO(stay.checkIn) || toISO(line.checkOut) !== toISO(stay.checkOut);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-card px-3 py-2 text-[13.5px] ring-1 ring-border">
      <span className="font-medium">
        {line.quantity} × {line.roomName}
      </span>
      <span className="text-muted-foreground">
        {MEAL_PLAN_LABEL[line.mealPlan as MealPlanValue]} · {line.guests} guest{line.guests === 1 ? "" : "s"}
        {partial ? ` · ${fmtShort(line.checkIn)}–${fmtShort(line.checkOut)}` : ""}
      </span>
      <span className="ml-auto text-muted-foreground tabular">
        {formatINR(line.nightlyRate)} × {line.quantity} × {n}N = <span className="font-medium text-foreground">{formatINR(roomLineAmount(line))}</span>
      </span>
      {editable && hotel ? (
        <span className="flex items-center">
          <RoomDialog
            stay={stay}
            hotel={hotel}
            line={line}
            trigger={
              <Button variant="ghost" size="icon-xs" aria-label={`Edit ${line.roomName}`}>
                <Pencil />
              </Button>
            }
          />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-xs" aria-label={`Remove ${line.roomName}`}>
                <Trash2 />
              </Button>
            }
            title="Remove this room?"
            confirmLabel="Remove"
            destructive
            onConfirm={() => remove.run(line.id)}
          />
        </span>
      ) : null}
    </li>
  );
}

export function RoomDialog({ stay, hotel, line, trigger }: { stay: Stay; hotel: AgentHotel; line?: Stay["rooms"][number]; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const first = hotel.rooms[0];
  const initial: StayRoomInput = line
    ? { roomId: line.roomId, quantity: line.quantity, guests: line.guests, mealPlan: line.mealPlan, checkIn: toISO(line.checkIn)!, checkOut: toISO(line.checkOut)! }
    : { roomId: first?.id ?? "", quantity: 1, guests: Math.min(2, first?.capacity ?? 2), mealPlan: (first?.mealPlans.includes("CP") ? "CP" : first?.mealPlans[0]) ?? "CP", checkIn: toISO(stay.checkIn)!, checkOut: toISO(stay.checkOut)! };
  const form = useForm<StayRoomInput>({ resolver: zodResolver(stayRoomSchema), defaultValues: initial });
  const onError = (r: { fieldErrors?: Record<string, string> }) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof StayRoomInput, { message: m }));
  const save = useAction((v: StayRoomInput) => (line ? updateStayRoomAction(line.id, v) : addStayRoomAction(stay.id, v)), { onSuccess: () => setOpen(false), onError });
  const roomId = form.watch("roomId");
  const room = hotel.rooms.find((r) => r.id === roomId);
  const qty = form.watch("quantity") || 0;
  const n = nightsBetween(form.watch("checkIn"), form.watch("checkOut"));
  const rate = line && line.roomId === roomId ? line.nightlyRate : room?.rate ?? 0;
  const e = form.formState.errors;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(initial);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{line ? "Edit room" : `Add a room at ${hotel.name}`}</DialogTitle>
          <DialogDescription>
            Stay {fmtDate(stay.checkIn)} → {fmtDate(stay.checkOut)}. Rates shown are your agency&apos;s nightly rates.
          </DialogDescription>
        </DialogHeader>
        <form id="room-form" onSubmit={form.handleSubmit((v) => save.run(v))} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Room type" required error={e.roomId?.message} className="sm:col-span-2">
            {(p) => (
              <Select
                value={roomId}
                onValueChange={(v) => {
                  form.setValue("roomId", v, { shouldDirty: true });
                  const r = hotel.rooms.find((x) => x.id === v);
                  if (r && !r.mealPlans.includes(form.getValues("mealPlan"))) form.setValue("mealPlan", r.mealPlans[0]);
                }}
              >
                <SelectTrigger {...p} className="w-full">
                  <SelectValue placeholder="Choose a room" />
                </SelectTrigger>
                <SelectContent>
                  {hotel.rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} · {formatINR(r.rate)}/night · up to {r.capacity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          {room?.description ? <p className="-mt-2 text-[12.5px] text-muted-foreground sm:col-span-2">{[room.description, room.bedConfig].filter(Boolean).join(" · ")}</p> : null}
          <Field label="Rooms" required error={e.quantity?.message}>
            {(p) => <Input {...p} inputMode="numeric" {...form.register("quantity", { setValueAs: (v) => toInt(String(v)) })} />}
          </Field>
          <Field label="Guests" required error={e.guests?.message} hint={room ? `Up to ${room.capacity * (qty || 1)} for ${qty || 1} room(s)` : undefined}>
            {(p) => <Input {...p} inputMode="numeric" {...form.register("guests", { setValueAs: (v) => toInt(String(v)) })} />}
          </Field>
          <Field label="Meal plan" required error={e.mealPlan?.message} className="sm:col-span-2">
            {(p) => (
              <Select value={form.watch("mealPlan")} onValueChange={(v) => form.setValue("mealPlan", v as MealPlanValue, { shouldDirty: true })}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(room?.mealPlans ?? []).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MEAL_PLAN_LABEL[m as MealPlanValue]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Check-in" required error={e.checkIn?.message}>
            {(p) => <Input {...p} type="date" min={toISO(stay.checkIn)!} max={toISO(stay.checkOut)!} {...form.register("checkIn")} />}
          </Field>
          <Field label="Check-out" required error={e.checkOut?.message}>
            {(p) => <Input {...p} type="date" min={toISO(stay.checkIn)!} max={toISO(stay.checkOut)!} {...form.register("checkOut")} />}
          </Field>
          <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2.5 text-[13.5px] sm:col-span-2">
            <span className="text-muted-foreground tabular">
              {formatINR(rate)} × {qty || 0} room{qty === 1 ? "" : "s"} × {n} night{n === 1 ? "" : "s"}
            </span>
            <span className="font-semibold tabular">{formatINR(rate * (qty || 0) * n)}</span>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton form="room-form" pending={save.pending} pendingLabel="Saving…">
            {line ? "Save room" : "Add room"}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StayDialog({ stay, range }: { stay: Stay; range: Range }) {
  const [open, setOpen] = useState(false);
  const initial: StayUpdateInput = {
    checkIn: toISO(stay.checkIn)!,
    checkOut: toISO(stay.checkOut)!,
    confirmationStatus: stay.confirmationStatus,
    confirmationNumber: stay.confirmationNumber ?? "",
    notes: stay.notes ?? "",
  };
  const form = useForm<StayUpdateInput>({ resolver: zodResolver(stayUpdateSchema), defaultValues: initial });
  const onError = (r: { fieldErrors?: Record<string, string> }) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof StayUpdateInput, { message: m }));
  const save = useAction((v: StayUpdateInput) => updateStayAction(stay.id, v), { onSuccess: () => setOpen(false), onError });
  const e = form.formState.errors;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(initial);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${stay.hotel.name} stay`}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{stay.hotel.name}</DialogTitle>
          <DialogDescription>Stay dates and hotel confirmation.</DialogDescription>
        </DialogHeader>
        <form id="stay-form" onSubmit={form.handleSubmit((v) => save.run(v))} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Check-in" required error={e.checkIn?.message}>
            {(p) => <Input {...p} type="date" min={range.min} max={range.max} {...form.register("checkIn")} />}
          </Field>
          <Field label="Check-out" required error={e.checkOut?.message}>
            {(p) => <Input {...p} type="date" min={range.min} max={range.max} {...form.register("checkOut")} />}
          </Field>
          <Field label="Confirmation" required>
            {(p) => (
              <Select value={form.watch("confirmationStatus")} onValueChange={(v) => form.setValue("confirmationStatus", v as StayUpdateInput["confirmationStatus"], { shouldDirty: true })}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Not requested</SelectItem>
                  <SelectItem value="REQUESTED">Requested from hotel</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Confirmation number" error={e.confirmationNumber?.message}>
            {(p) => <Input {...p} placeholder="BL-77120" {...form.register("confirmationNumber")} />}
          </Field>
          <Field label="Notes for the hotel" error={e.notes?.message} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} placeholder="Early check-in requested; honeymoon decoration" {...form.register("notes")} />}
          </Field>
          <p className="text-[12.5px] text-muted-foreground sm:col-span-2">Rooms that matched the old dates move with the stay.</p>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton form="stay-form" pending={save.pending} pendingLabel="Saving…">
            Save stay
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, SubmitButton, toInt } from "@/components/app/form";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/states";
import { Pill } from "@/components/app/badges";
import { formatINR } from "@/lib/money";
import { MEAL_PLANS, MEAL_PLAN_LABEL, type MealPlanValue } from "@/lib/labels";
import { roomSchema, type RoomInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useAction } from "@/lib/use-action";
import { deleteRoomAction, removeHotelImageAction, saveRoomAction, setHotelAgenciesAction, setRoomRatesAction, uploadHotelImageAction } from "@/server/actions/admin";
import { AmenityPicker } from "./hotel-form";

type Room = { id: string; name: string; description: string | null; capacity: number; bedConfig: string | null; inventory: number; baseRate: number; mealPlans: string[]; amenities: string[]; status: string; rates: { agencyId: string; rate: number; agency: { id: string; name: string } }[] };

// ---- Images --------------------------------------------------------------------

export function HotelImages({ hotelId, images }: { hotelId: string; images: string[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const remove = useAction((key: string) => removeHotelImageAction(hotelId, key));
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadHotelImageAction(hotelId, fd);
      if (!r.ok) toast.error(`${f.name}: ${r.message}`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((k, i) => (
          <div key={k} className="group relative aspect-[4/3] overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${k}`} alt={`Hotel photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 ? <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">Cover</span> : null}
            <ConfirmDialog
              trigger={
                <Button variant="secondary" size="icon-sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Remove photo ${i + 1}`}>
                  <Trash2 className="size-4" />
                </Button>
              }
              title="Remove this photo?"
              confirmLabel="Remove"
              destructive
              onConfirm={() => remove.run(k)}
            />
          </div>
        ))}
        <button onClick={() => input.current?.click()} disabled={busy || images.length >= 12} className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50">
          <ImagePlus className="size-5" aria-hidden />
          {busy ? "Uploading…" : "Add photos"}
        </button>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Upload hotel photos" />
      <p className="mt-2 text-[12px] text-muted-foreground">JPG, PNG or WebP up to 4 MB, 12 photos max. Without photos, a generated cover is used.</p>
    </div>
  );
}

// ---- Rooms ---------------------------------------------------------------------

const emptyRoom: RoomInput = { name: "", description: "", capacity: 2, bedConfig: "", inventory: 1, baseRate: 0, mealPlans: ["CP"], amenities: [], status: "ACTIVE" };

function RoomDialog({ hotelId, room, trigger }: { hotelId: string; room?: Room; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const initial: RoomInput = room
    ? { name: room.name, description: room.description ?? "", capacity: room.capacity, bedConfig: room.bedConfig ?? "", inventory: room.inventory, baseRate: room.baseRate, mealPlans: room.mealPlans as MealPlanValue[], amenities: room.amenities, status: room.status as RoomInput["status"] }
    : emptyRoom;
  const form = useForm<RoomInput>({ resolver: zodResolver(roomSchema), defaultValues: initial });
  const save = useAction((v: RoomInput) => saveRoomAction(hotelId, room?.id ?? null, v), {
    onSuccess: () => setOpen(false),
    onError: (r) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof RoomInput, { message: m })),
  });
  const e = form.formState.errors;
  const plans = form.watch("mealPlans");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(initial);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{room ? `Edit ${room.name}` : "Add room type"}</DialogTitle>
          <DialogDescription>The base rate is the platform rack rate. Agency rates are set on the Rates tab.</DialogDescription>
        </DialogHeader>
        <form id="hotel-room-form" onSubmit={form.handleSubmit((v) => save.run(v))} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Room name" required error={e.name?.message}>
            {(p) => <Input {...p} placeholder="Deluxe" {...form.register("name")} />}
          </Field>
          <Field label="Base rate (₹ / night)" required error={e.baseRate?.message}>
            {(p) => <Input {...p} inputMode="numeric" {...form.register("baseRate", { setValueAs: (v) => toInt(String(v)) })} />}
          </Field>
          <Field label="Description" error={e.description?.message} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} {...form.register("description")} />}
          </Field>
          <Field label="Max guests" required error={e.capacity?.message}>
            {(p) => <Input {...p} inputMode="numeric" {...form.register("capacity", { setValueAs: (v) => toInt(String(v)) })} />}
          </Field>
          <Field label="Number of rooms" required error={e.inventory?.message}>
            {(p) => <Input {...p} inputMode="numeric" {...form.register("inventory", { setValueAs: (v) => toInt(String(v)) })} />}
          </Field>
          <Field label="Bed configuration" error={e.bedConfig?.message}>
            {(p) => <Input {...p} placeholder="1 king or 2 twin" {...form.register("bedConfig")} />}
          </Field>
          <Field label="Status">
            {(p) => (
              <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as RoomInput["status"])}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[13px] font-medium">
              Meal plans<span className="text-bad">*</span>
            </legend>
            <div className="flex flex-wrap gap-3">
              {MEAL_PLANS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-[13.5px]">
                  <Checkbox checked={plans.includes(m)} onCheckedChange={(c) => form.setValue("mealPlans", c ? [...plans, m] : plans.filter((x) => x !== m), { shouldValidate: true })} />
                  {MEAL_PLAN_LABEL[m]}
                </label>
              ))}
            </div>
            {e.mealPlans?.message ? <p className="mt-1 text-[12.5px] text-bad">{e.mealPlans.message}</p> : null}
          </fieldset>
          <div className="sm:col-span-2">
            <p className="mb-2 text-[13px] font-medium">Room amenities</p>
            <AmenityPicker value={form.watch("amenities")} onChange={(v) => form.setValue("amenities", v)} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton form="hotel-room-form" pending={save.pending} pendingLabel="Saving…">
            {room ? "Save room" : "Add room"}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RoomsManager({ hotelId, rooms }: { hotelId: string; rooms: Room[] }) {
  const del = useAction((roomId: string) => deleteRoomAction(hotelId, roomId), { success: (r) => (r === "deactivated" ? "Room is used by trips, so it was deactivated instead." : "Room deleted.") });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RoomDialog hotelId={hotelId} trigger={<Button><Plus className="size-4" aria-hidden /> Add room type</Button>} />
      </div>
      {rooms.length ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id} className={cn("rounded-xl border bg-card p-4", r.status === "INACTIVE" && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-semibold">
                    {r.name} {r.status === "INACTIVE" ? <Pill>Inactive</Pill> : null}
                  </p>
                  <p className="text-[13px] text-muted-foreground">{[r.bedConfig, `up to ${r.capacity} guests`, `${r.inventory} rooms`].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex shrink-0">
                  <RoomDialog hotelId={hotelId} room={r} trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.name}`}><Pencil className="size-4" /></Button>} />
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    }
                    title={`Delete ${r.name}?`}
                    description="If any trip has booked this room it is deactivated instead, keeping trip history intact."
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => del.run(r.id)}
                  />
                </div>
              </div>
              {r.description ? <p className="mt-2 text-[13px]">{r.description}</p> : null}
              <div className="mt-3 flex items-end justify-between">
                <p className="text-[12.5px] text-muted-foreground">{r.mealPlans.join(" · ")}</p>
                <p className="text-right">
                  <span className="text-[17px] font-semibold tabular">{formatINR(r.baseRate)}</span>
                  <span className="block text-[11.5px] text-muted-foreground">base / night · {r.rates.length} agency rate{r.rates.length === 1 ? "" : "s"}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No room types yet" description="Add Deluxe, Premium, Suite… Agents choose from these when planning." />
      )}
    </div>
  );
}

// ---- Agency rates ---------------------------------------------------------------

export function RatesEditor({ rooms, agencies }: { rooms: Room[]; agencies: { id: string; name: string }[] }) {
  if (!rooms.length) return <EmptyState compact title="Add room types first" />;
  if (!agencies.length) return <EmptyState compact title="No agencies have access" description="Give agencies access on the Agents tab, then set their rates here." />;
  return (
    <div className="space-y-4">
      <p className="text-[13.5px] text-muted-foreground">Each agency only ever sees its own nightly rate. Leave a field blank to use the base rate.</p>
      {rooms.map((r) => (
        <RoomRates key={r.id} room={r} agencies={agencies} />
      ))}
    </div>
  );
}

function RoomRates({ room, agencies }: { room: Room; agencies: { id: string; name: string }[] }) {
  const initial = Object.fromEntries(agencies.map((a) => [a.id, room.rates.find((x) => x.agencyId === a.id)?.rate.toString() ?? ""]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const dirty = agencies.some((a) => (values[a.id] ?? "") !== (initial[a.id] ?? ""));
  const save = useAction(() => setRoomRatesAction({ roomId: room.id, rates: agencies.map((a) => ({ agencyId: a.id, rate: values[a.id] ? Number(values[a.id]) : null })) }));
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-[14px] font-semibold">{room.name}</h3>
        <p className="text-[13px] text-muted-foreground">
          Base rate <span className="font-medium text-foreground tabular">{formatINR(room.baseRate)}</span>
        </p>
      </div>
      <ul className="divide-y">
        {agencies.map((a) => {
          const v = values[a.id] ?? "";
          const diff = v ? Math.round(((Number(v) - room.baseRate) / room.baseRate) * 100) : null;
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <label htmlFor={`rate-${room.id}-${a.id}`} className="min-w-0 flex-1 text-[13.5px]">
                {a.name}
              </label>
              {diff !== null ? <span className={cn("text-[12px] tabular", diff < 0 ? "text-ok" : diff > 0 ? "text-warn" : "text-muted-foreground")}>{diff > 0 ? `+${diff}` : diff}% vs base</span> : <span className="text-[12px] text-muted-foreground">Base rate</span>}
              <div className="relative w-32">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[13px] text-muted-foreground">₹</span>
                <Input id={`rate-${room.id}-${a.id}`} inputMode="numeric" value={v} placeholder={String(room.baseRate)} onChange={(e) => setValues((s) => ({ ...s, [a.id]: e.target.value.replace(/\D/g, "") }))} className="h-8 pl-6 text-right tabular" />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end border-t px-4 py-2.5">
        <Button size="sm" disabled={!dirty || save.pending} onClick={() => save.run()}>
          {save.pending ? "Saving…" : "Save rates"}
        </Button>
      </div>
    </section>
  );
}

// ---- Agencies with access --------------------------------------------------------

export function HotelAgencies({ hotelId, agencies, assigned }: { hotelId: string; agencies: { id: string; name: string; status: string }[]; assigned: string[] }) {
  const [sel, setSel] = useState(new Set(assigned));
  const dirty = sel.size !== assigned.length || assigned.some((a) => !sel.has(a));
  const save = useAction(() => setHotelAgenciesAction(hotelId, [...sel]));
  return (
    <div className="rounded-xl border bg-card">
      <ul className="divide-y">
        {agencies.map((a) => (
          <li key={a.id}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
              <Checkbox checked={sel.has(a.id)} onCheckedChange={(c) => setSel((s) => {
                const n = new Set(s);
                if (c) n.add(a.id);
                else n.delete(a.id);
                return n;
              })} />
              <span className="flex-1 text-[14px]">{a.name}</span>
              {a.status === "SUSPENDED" ? <Pill tone="bad">Suspended</Pill> : null}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-[13px] text-muted-foreground">
          {sel.size} of {agencies.length} agencies have access
        </span>
        <Button disabled={!dirty || save.pending} onClick={() => save.run()}>
          {save.pending ? "Saving…" : "Save access"}
        </Button>
      </div>
    </div>
  );
}

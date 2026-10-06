"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, SubmitButton, toInt } from "@/components/app/form";
import { activitySchema, transportSchema, type ActivityInput, type TransportInput } from "@/lib/schemas";
import { ACTIVITY_KINDS, ACTIVITY_KIND_LABEL, TRANSPORT_KINDS, TRANSPORT_KIND_LABEL } from "@/lib/labels";
import { useAction } from "@/lib/use-action";
import { saveActivityAction, saveTransportAction } from "@/server/actions/trips";

type Range = { min: string; max: string };

function useFieldErrors<T extends Record<string, unknown>>(setError: (k: keyof T & string, e: { message: string }) => void) {
  return (r: { fieldErrors?: Record<string, string> }) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => setError(k as keyof T & string, { message: m }));
}

export function TransportDialog({
  tripId,
  transportId,
  initial,
  range,
  trigger,
  title,
}: {
  tripId: string;
  transportId?: string;
  initial: TransportInput;
  range: Range;
  trigger: ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<TransportInput>({ resolver: zodResolver(transportSchema), defaultValues: initial });
  const onError = useFieldErrors<TransportInput>(form.setError);
  const { run, pending } = useAction((v: TransportInput) => saveTransportAction(tripId, transportId ?? null, v), { onSuccess: () => setOpen(false), onError });
  const e = form.formState.errors;
  const reg = form.register;
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
          <DialogTitle>{title ?? (transportId ? "Edit transport" : "Add transport")}</DialogTitle>
          <DialogDescription>Driver and vehicle details can be added later — you&apos;ll be reminded before pickup.</DialogDescription>
        </DialogHeader>
        <form id="transport-form" onSubmit={form.handleSubmit((v) => run(v))} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Type" required className="sm:col-span-2">
            {(p) => (
              <Select value={form.watch("kind")} onValueChange={(v) => form.setValue("kind", v as TransportInput["kind"], { shouldDirty: true })}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {TRANSPORT_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Date" required error={e.date?.message}>
            {(p) => <Input {...p} type="date" min={range.min} max={range.max} {...reg("date")} />}
          </Field>
          <Field label="Pickup time" error={e.time?.message}>
            {(p) => <Input {...p} type="time" {...reg("time")} />}
          </Field>
          <Field label="Pickup" required error={e.pickup?.message}>
            {(p) => <Input {...p} placeholder="Srinagar Airport" {...reg("pickup")} />}
          </Field>
          <Field label="Drop" required error={e.dropoff?.message}>
            {(p) => <Input {...p} placeholder="Blanco Hotel" {...reg("dropoff")} />}
          </Field>
          <Field label="Vehicle" error={e.vehicle?.message}>
            {(p) => <Input {...p} placeholder="Toyota Innova Crysta" {...reg("vehicle")} />}
          </Field>
          <Field label="Vehicle number" error={e.vehicleNumber?.message}>
            {(p) => <Input {...p} placeholder="JK01 AB 1234" {...reg("vehicleNumber")} />}
          </Field>
          <Field label="Driver" error={e.driverName?.message}>
            {(p) => <Input {...p} {...reg("driverName")} />}
          </Field>
          <Field label="Driver phone" error={e.driverPhone?.message}>
            {(p) => <Input {...p} type="tel" {...reg("driverPhone")} />}
          </Field>
          <Field label="Price (₹)" error={e.price?.message} hint="Selling price; 0 if included.">
            {(p) => <Input {...p} inputMode="numeric" {...reg("price", { setValueAs: (v) => toInt(String(v)) })} />}
          </Field>
          <Field label="Notes" error={e.notes?.message} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} placeholder="Flight AI 825, meet at Gate 2 with a name board" {...reg("notes")} />}
          </Field>
          <div className="flex items-center gap-2.5 sm:col-span-2">
            <Switch id="tr-itin" checked={form.watch("addToItinerary")} onCheckedChange={(c) => form.setValue("addToItinerary", c, { shouldDirty: true })} />
            <Label htmlFor="tr-itin" className="text-[13.5px] font-normal">
              Show in the itinerary
            </Label>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton form="transport-form" pending={pending} pendingLabel="Saving…">
            {transportId ? "Save transport" : "Add transport"}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ActivityDialog({
  tripId,
  activityId,
  initial,
  range,
  trigger,
}: {
  tripId: string;
  activityId?: string;
  initial: ActivityInput;
  range: Range;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ActivityInput>({ resolver: zodResolver(activitySchema), defaultValues: initial });
  const onError = useFieldErrors<ActivityInput>(form.setError);
  const { run, pending } = useAction((v: ActivityInput) => saveActivityAction(tripId, activityId ?? null, v), { onSuccess: () => setOpen(false), onError });
  const e = form.formState.errors;
  const reg = form.register;
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
          <DialogTitle>{activityId ? "Edit activity" : "Add activity"}</DialogTitle>
          <DialogDescription>Sightseeing, experiences, meals or free time.</DialogDescription>
        </DialogHeader>
        <form id="activity-form" onSubmit={form.handleSubmit((v) => run(v))} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Type" required>
            {(p) => (
              <Select value={form.watch("kind")} onValueChange={(v) => form.setValue("kind", v as ActivityInput["kind"], { shouldDirty: true })}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ACTIVITY_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Title" required error={e.title?.message}>
            {(p) => <Input {...p} placeholder="Gulmarg Gondola" {...reg("title")} />}
          </Field>
          <Field label="Date" required error={e.date?.message}>
            {(p) => <Input {...p} type="date" min={range.min} max={range.max} {...reg("date")} />}
          </Field>
          <Field label="Time" error={e.time?.message}>
            {(p) => <Input {...p} type="time" {...reg("time")} />}
          </Field>
          <Field label="Location" error={e.location?.message}>
            {(p) => <Input {...p} placeholder="Gulmarg" {...reg("location")} />}
          </Field>
          <Field label="Duration (minutes)" error={e.durationMins?.message}>
            {(p) => <Input {...p} inputMode="numeric" {...reg("durationMins", { setValueAs: (v) => (String(v ?? "").trim() === "" ? null : toInt(String(v))) })} />}
          </Field>
          <Field label="Description" error={e.description?.message} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} {...reg("description")} />}
          </Field>
          <Field label="Price (₹)" error={e.price?.message} hint="Selling price; 0 if included.">
            {(p) => <Input {...p} inputMode="numeric" {...reg("price", { setValueAs: (v) => toInt(String(v)) })} />}
          </Field>
          <Field label="Internal notes" error={e.notes?.message}>
            {(p) => <Input {...p} {...reg("notes")} />}
          </Field>
          <div className="flex items-center gap-2.5 sm:col-span-2">
            <Switch id="ac-itin" checked={form.watch("addToItinerary")} onCheckedChange={(c) => form.setValue("addToItinerary", c, { shouldDirty: true })} />
            <Label htmlFor="ac-itin" className="text-[13.5px] font-normal">
              Show in the itinerary
            </Label>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton form="activity-form" pending={pending} pendingLabel="Saving…">
            {activityId ? "Save activity" : "Add activity"}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { blankActivity, blankTransport } from "@/lib/plan";

"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, SubmitButton, toInt } from "@/components/app/form";
import { itineraryItemSchema, type ItineraryItemInput } from "@/lib/schemas";
import { ITEM_TYPES, ITEM_TYPE_LABEL } from "@/lib/labels";
import { ITEM_ICON } from "./item-icon";

export const blankItem: ItineraryItemInput = { time: "", type: "SIGHTSEEING", title: "", description: "", location: "", durationMins: null, notes: "" };

/**
 * Add/edit an itinerary item. Persistence is delegated to `onSubmit`, which
 * resolves true on success (the dialog then closes) — so the same dialog
 * serves trips and templates.
 */
export function ItemDialog({
  trigger,
  initial,
  title,
  description,
  onSubmit,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: ReactNode;
  initial: ItineraryItemInput;
  title: string;
  description?: string;
  onSubmit: (v: ItineraryItemInput) => Promise<boolean | { fieldErrors?: Record<string, string> }>;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const open = controlledOpen ?? own;
  const setOpen = onOpenChange ?? setOwn;
  const [pending, setPending] = useState(false);
  const form = useForm<ItineraryItemInput>({ resolver: zodResolver(itineraryItemSchema), defaultValues: initial });
  const e = form.formState.errors;
  const reg = form.register;
  const submit = form.handleSubmit(async (v) => {
    setPending(true);
    try {
      const r = await onSubmit(v);
      if (r === true) setOpen(false);
      else if (r && typeof r === "object" && r.fieldErrors) Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof ItineraryItemInput, { message: m }));
    } finally {
      setPending(false);
    }
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(initial);
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" onOpenAutoFocus={() => setTimeout(() => form.setFocus("title"), 0)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">Itinerary item details</DialogDescription>}
        </DialogHeader>
        <form id="item-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_minmax(0,1fr)]" noValidate>
          <Field label="Time" error={e.time?.message} hint="Optional">
            {(p) => <Input {...p} type="time" {...reg("time")} />}
          </Field>
          <Field label="Type" required>
            {(p) => (
              <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as ItineraryItemInput["type"], { shouldDirty: true })}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => {
                    const Icon = ITEM_ICON[t];
                    return (
                      <SelectItem key={t} value={t}>
                        <Icon className="text-muted-foreground" aria-hidden /> {ITEM_TYPE_LABEL[t]}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Title" required error={e.title?.message} className="sm:col-span-2">
            {(p) => <Input {...p} placeholder="Dal Lake shikara ride" {...reg("title")} />}
          </Field>
          <Field label="Location" error={e.location?.message}>
            {(p) => <Input {...p} placeholder="Dal Lake" {...reg("location")} />}
          </Field>
          <Field label="Duration (min)" error={e.durationMins?.message}>
            {(p) => <Input {...p} inputMode="numeric" placeholder="60" {...reg("durationMins", { setValueAs: (v) => (String(v ?? "").trim() === "" ? null : toInt(String(v))) })} />}
          </Field>
          <Field label="Description" error={e.description?.message} className="sm:col-span-2" hint="Shown to the guest.">
            {(p) => <Textarea {...p} rows={3} {...reg("description")} />}
          </Field>
          <Field label="Internal notes" error={e.notes?.message} className="sm:col-span-2" hint="Only your team sees these.">
            {(p) => <Input {...p} {...reg("notes")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton form="item-form" pending={pending} pendingLabel="Saving…">
            Save
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

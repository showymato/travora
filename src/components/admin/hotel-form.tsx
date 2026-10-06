"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection, SubmitButton } from "@/components/app/form";
import { hotelSchema, type HotelInput } from "@/lib/schemas";
import { AMENITIES, HOTEL_CATEGORIES, HOTEL_CATEGORY_LABEL, type HotelCategoryValue } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useAction } from "@/lib/use-action";
import { saveHotelAction } from "@/server/actions/admin";

export const emptyHotel: HotelInput = {
  name: "",
  category: "FOUR_STAR",
  description: "",
  destination: "",
  location: "",
  address: "",
  latitude: "",
  longitude: "",
  phone: "",
  email: "",
  website: "",
  amenities: [],
  checkInTime: "14:00",
  checkOutTime: "11:00",
  cancellationPolicy: "",
  notes: "",
  status: "ACTIVE",
};

/** Amenity chips: catalogue suggestions plus free text. */
export function AmenityPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const toggle = (a: string) => onChange(value.includes(a) ? value.filter((x) => x !== a) : [...value, a]);
  const extras = value.filter((v) => !(AMENITIES as readonly string[]).includes(v));
  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Amenities">
        {[...AMENITIES, ...extras].map((a) => {
          const on = value.includes(a);
          return (
            <button key={a} type="button" aria-pressed={on} onClick={() => toggle(a)} className={cn("h-8 rounded-full border px-3 text-[12.5px] transition-colors", on ? "border-primary bg-accent font-medium text-accent-foreground" : "hover:border-foreground/20")}>
              {a}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 sm:max-w-sm">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (custom.trim() && !value.includes(custom.trim())) onChange([...value, custom.trim()]);
              setCustom("");
            }
          }}
          placeholder="Add another amenity"
          aria-label="Custom amenity"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (custom.trim() && !value.includes(custom.trim())) onChange([...value, custom.trim()]);
            setCustom("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export function HotelForm({ hotelId, initial, destinations }: { hotelId?: string; initial: HotelInput; destinations: string[] }) {
  const router = useRouter();
  const form = useForm<HotelInput>({ resolver: zodResolver(hotelSchema), defaultValues: initial });
  const save = useAction((v: HotelInput) => saveHotelAction(hotelId ?? null, v), {
    onSuccess: (id) => router.push(`/admin/hotels/${id}${hotelId ? "" : "?tab=rooms"}`),
    onError: (r) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof HotelInput, { message: m })),
  });
  const e = form.formState.errors;
  const reg = form.register;
  return (
    <form onSubmit={form.handleSubmit((v) => save.run(v))} noValidate>
      <FormSection title="Hotel" description="How agents will find and recognise the property.">
        <Field label="Hotel name" required error={e.name?.message}>
          {(p) => <Input {...p} placeholder="Blanco Hotel" {...reg("name")} />}
        </Field>
        <Field label="Category" required>
          {(p) => (
            <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v as HotelCategoryValue, { shouldDirty: true })}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOTEL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {HOTEL_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Description" error={e.description?.message} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={3} placeholder="A lakeside five-star with views across Dal Lake…" {...reg("description")} />}
        </Field>
        <Field label="Status">
          {(p) => (
            <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as HotelInput["status"], { shouldDirty: true })}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active — bookable</SelectItem>
                <SelectItem value="INACTIVE">Inactive — hidden from agents</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </FormSection>
      <FormSection title="Location" description="Destination groups hotels in the trip planner.">
        <Field label="Destination" required error={e.destination?.message} hint="Pick an existing one or type a new destination.">
          {(p) => (
            <>
              <Input {...p} list="dest-list" placeholder="Srinagar" {...reg("destination")} />
              <datalist id="dest-list">
                {destinations.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Location" required error={e.location?.message} hint="Shown on cards, e.g. “Srinagar, Boulevard Road”">
          {(p) => <Input {...p} {...reg("location")} />}
        </Field>
        <Field label="Address" error={e.address?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...reg("address")} />}
        </Field>
        <Field label="Latitude" error={e.latitude?.message}>
          {(p) => <Input {...p} inputMode="decimal" placeholder="34.0837" {...reg("latitude")} />}
        </Field>
        <Field label="Longitude" error={e.longitude?.message}>
          {(p) => <Input {...p} inputMode="decimal" placeholder="74.8371" {...reg("longitude")} />}
        </Field>
      </FormSection>
      <FormSection title="Contact">
        <Field label="Phone" error={e.phone?.message}>
          {(p) => <Input {...p} type="tel" {...reg("phone")} />}
        </Field>
        <Field label="Email" error={e.email?.message}>
          {(p) => <Input {...p} type="email" {...reg("email")} />}
        </Field>
        <Field label="Website" error={e.website?.message} className="sm:col-span-2">
          {(p) => <Input {...p} type="url" placeholder="https://" {...reg("website")} />}
        </Field>
      </FormSection>
      <FormSection title="Stay rules">
        <Field label="Check-in time" required error={e.checkInTime?.message}>
          {(p) => <Input {...p} type="time" {...reg("checkInTime")} />}
        </Field>
        <Field label="Check-out time" required error={e.checkOutTime?.message}>
          {(p) => <Input {...p} type="time" {...reg("checkOutTime")} />}
        </Field>
        <Field label="Cancellation policy" error={e.cancellationPolicy?.message} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} {...reg("cancellationPolicy")} />}
        </Field>
        <Field label="Internal notes" error={e.notes?.message} className="sm:col-span-2" hint="Visible to platform admins only.">
          {(p) => <Textarea {...p} rows={2} {...reg("notes")} />}
        </Field>
      </FormSection>
      <FormSection title="Amenities">
        <AmenityPicker value={form.watch("amenities")} onChange={(v) => form.setValue("amenities", v, { shouldDirty: true })} />
      </FormSection>
      <div className="sticky bottom-16 z-10 -mx-5 mt-4 flex justify-end gap-2 border-t bg-card/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7 lg:bottom-0">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <SubmitButton pending={save.pending} pendingLabel="Saving…">
          {hotelId ? "Save hotel" : "Create hotel & add rooms"}
        </SubmitButton>
      </div>
      {form.formState.errors.root ? (
        <p className="mt-2 text-bad">
          <X className="inline size-4" /> {form.formState.errors.root.message}
        </p>
      ) : null}
    </form>
  );
}

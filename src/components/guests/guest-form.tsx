"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Field, FormSection, SubmitButton } from "@/components/app/form";
import { guestSchema, type GuestInput } from "@/lib/schemas";
import { GENDERS, GENDER_LABEL, ID_TYPES, ID_TYPE_LABEL } from "@/lib/labels";
import { useAction } from "@/lib/use-action";
import { createGuestAction, updateGuestAction } from "@/server/actions/agent";

export const emptyGuest: GuestInput = {
  fullName: "",
  phone: "",
  email: "",
  whatsapp: "",
  nationality: "Indian",
  dateOfBirth: "",
  gender: "",
  address: "",
  idType: "",
  idNumber: "",
  notes: "",
};

type Created = { id: string; fullName: string; phone: string | null; email: string | null };

/**
 * Create or edit a guest. `compact` renders the essentials only (used inside
 * the trip wizard's dialog); everything else can be filled in later.
 */
export function GuestForm({
  guestId,
  initial,
  compact = false,
  onSaved,
  onCancel,
  onDirtyChange,
}: {
  guestId?: string;
  initial?: Partial<GuestInput>;
  compact?: boolean;
  onSaved?: (g: Created | null) => void;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const form = useForm<GuestInput>({ resolver: zodResolver(guestSchema), defaultValues: { ...emptyGuest, ...initial } });
  const { errors, isDirty } = form.formState;
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  const setFieldErrors = (r: { fieldErrors?: Record<string, string> }) =>
    r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof GuestInput, { message: m }));
  const create = useAction(createGuestAction, { onSuccess: (g) => onSaved?.(g), onError: setFieldErrors });
  const update = useAction((v: GuestInput) => updateGuestAction(guestId!, v), {
    onSuccess: () => {
      form.reset(form.getValues());
      onSaved?.(null);
    },
    onError: setFieldErrors,
  });
  const pending = create.pending || update.pending;
  const submit = form.handleSubmit((v) => (guestId ? update.run(v) : create.run(v)));
  const reg = form.register;

  const contact = (
    <>
      <Field label="Full name" required error={errors.fullName?.message} className="sm:col-span-2">
        {(p) => <Input {...p} {...reg("fullName")} placeholder="As on ID, e.g. Rahul Sharma" autoComplete="off" />}
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        {(p) => <Input {...p} {...reg("phone")} type="tel" placeholder="+91 98765 43210" />}
      </Field>
      <Field label="Email" error={errors.email?.message}>
        {(p) => <Input {...p} {...reg("email")} type="email" placeholder="guest@example.com" />}
      </Field>
    </>
  );

  if (compact) {
    return (
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{contact}</div>
        <p className="text-[12.5px] text-muted-foreground">Add ID, address and documents later from the guest&apos;s profile.</p>
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <SubmitButton pending={pending} pendingLabel="Adding…">
            Add guest
          </SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <FormSection title="Contact" description="How you and your team reach this guest.">
        {contact}
        <Field label="WhatsApp" error={errors.whatsapp?.message} hint="Leave blank if same as phone.">
          {(p) => <Input {...p} {...reg("whatsapp")} type="tel" placeholder="+91 98765 43210" />}
        </Field>
        <Field label="Address" error={errors.address?.message}>
          {(p) => <Input {...p} {...reg("address")} placeholder="City, state" />}
        </Field>
      </FormSection>
      <FormSection title="Personal" description="Used on hotel vouchers and guest summaries.">
        <Field label="Nationality" error={errors.nationality?.message}>
          {(p) => <Input {...p} {...reg("nationality")} />}
        </Field>
        <Field label="Date of birth" error={errors.dateOfBirth?.message}>
          {(p) => <Input {...p} {...reg("dateOfBirth")} type="date" max={new Date().toISOString().slice(0, 10)} />}
        </Field>
        <Field label="Gender" error={errors.gender?.message}>
          {(p) => (
            <Select value={form.watch("gender") || "none"} onValueChange={(v) => form.setValue("gender", (v === "none" ? "" : v) as GuestInput["gender"], { shouldDirty: true })}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GENDER_LABEL[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </FormSection>
      <FormSection title="Identity" description="ID numbers are only visible to your agency and are masked on documents.">
        <Field label="ID type" error={errors.idType?.message}>
          {(p) => (
            <Select value={form.watch("idType") || "none"} onValueChange={(v) => form.setValue("idType", (v === "none" ? "" : v) as GuestInput["idType"], { shouldDirty: true })}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {ID_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ID_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="ID number" error={errors.idNumber?.message}>
          {(p) => <Input {...p} {...reg("idNumber")} autoComplete="off" />}
        </Field>
      </FormSection>
      <FormSection title="Notes" description="Preferences, dietary needs, special occasions.">
        <Field label="Notes" error={errors.notes?.message} className="sm:col-span-2">
          {(p) => <Textarea {...p} {...reg("notes")} rows={4} placeholder="e.g. Vegetarian, celebrating anniversary on Day 2" />}
        </Field>
      </FormSection>
      <div className="sticky bottom-16 z-10 -mx-4 mt-2 flex justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <SubmitButton pending={pending} pendingLabel="Saving…">
          {guestId ? "Save changes" : "Create guest"}
        </SubmitButton>
      </div>
    </form>
  );
}

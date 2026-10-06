"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Field, SubmitButton } from "@/components/app/form";
import { agencySettingsSchema, type AgencySettingsInput } from "@/lib/schemas";
import { useAction } from "@/lib/use-action";
import { updateAgencySettingsAction } from "@/server/actions/agent";

export function AgencySettingsForm({ initial }: { initial: AgencySettingsInput }) {
  const form = useForm<AgencySettingsInput>({ resolver: zodResolver(agencySettingsSchema), defaultValues: initial });
  const save = useAction(updateAgencySettingsAction, {
    onSuccess: () => form.reset(form.getValues()),
    onError: (r) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof AgencySettingsInput, { message: m })),
  });
  const e = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit((v) => save.run(v))} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
      <Field label="Agency name" required error={e.name?.message} className="sm:col-span-2">
        {(p) => <Input {...p} {...form.register("name")} />}
      </Field>
      <Field label="Support email" error={e.supportEmail?.message} hint="Shown to guests.">
        {(p) => <Input {...p} type="email" {...form.register("supportEmail")} />}
      </Field>
      <Field label="Support phone" error={e.supportPhone?.message} hint="Used for the guest's Call and WhatsApp buttons.">
        {(p) => <Input {...p} type="tel" {...form.register("supportPhone")} />}
      </Field>
      <Field label="Business address" error={e.address?.message} className="sm:col-span-2">
        {(p) => <Input {...p} {...form.register("address")} />}
      </Field>
      <Field label="GSTIN" error={e.gstNumber?.message}>
        {(p) => <Input {...p} className="uppercase" {...form.register("gstNumber")} />}
      </Field>
      <div className="flex items-end justify-end sm:col-span-2">
        <SubmitButton pending={save.pending} pendingLabel="Saving…" disabled={!form.formState.isDirty}>
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

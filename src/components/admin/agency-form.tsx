"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormSection, SubmitButton } from "@/components/app/form";
import { cn } from "@/lib/utils";
import { agencyCreateSchema, agencyUpdateSchema, type AgencyCreateInput, type AgencyUpdateInput } from "@/lib/schemas";
import { PLAN_CODES, type PlanCodeValue } from "@/lib/labels";
import { formatINR } from "@/lib/money";
import { useAction } from "@/lib/use-action";
import { createAgencyAction, updateAgencyAction } from "@/server/actions/admin";

type Plan = { code: string; name: string; priceMonthly: number; maxUsers: number; features: string[] };

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const pick = (n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => chars[x % chars.length]).join("");
  return `Trv-${pick(4)}-${pick(4)}-${pick(4)}`;
}

function PlanPicker({ plans, value, onChange }: { plans: Plan[]; value: string; onChange: (c: PlanCodeValue) => void }) {
  return (
    <div role="radiogroup" aria-label="Plan" className="grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2 xl:grid-cols-4">
      {PLAN_CODES.map((code) => {
        const p = plans.find((x) => x.code === code);
        if (!p) return null;
        const active = value === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(code)}
            className={cn("rounded-xl border p-3.5 text-left transition-colors", active ? "border-primary ring-2 ring-primary/15" : "hover:border-foreground/20")}
          >
            <p className="text-[14px] font-semibold">{p.name}</p>
            <p className="text-[13px] text-muted-foreground tabular">{formatINR(p.priceMonthly)}/mo · {p.maxUsers} users</p>
            <p className="mt-1.5 line-clamp-2 text-[12px] text-muted-foreground">{p.features.slice(0, 2).join(" · ")}</p>
          </button>
        );
      })}
    </div>
  );
}

const profileFields = (form: ReturnType<typeof useForm<AgencyCreateInput>> | ReturnType<typeof useForm<AgencyUpdateInput>>) => {
  const f = form as ReturnType<typeof useForm<AgencyUpdateInput>>;
  const e = f.formState.errors;
  return (
    <>
      <FormSection title="Business information" description="The agency's legal and contact details.">
        <Field label="Agency name" required error={e.name?.message}>
          {(p) => <Input {...p} placeholder="ABC Travels" {...f.register("name")} />}
        </Field>
        <Field label="Owner name" required error={e.ownerName?.message}>
          {(p) => <Input {...p} placeholder="Rahul Verma" {...f.register("ownerName")} />}
        </Field>
        <Field label="Email" required error={e.email?.message}>
          {(p) => <Input {...p} type="email" placeholder="hello@abctravels.in" {...f.register("email")} />}
        </Field>
        <Field label="Phone" required error={e.phone?.message}>
          {(p) => <Input {...p} type="tel" placeholder="+91 98100 11223" {...f.register("phone")} />}
        </Field>
        <Field label="City" error={e.city?.message}>
          {(p) => <Input {...p} {...f.register("city")} />}
        </Field>
        <Field label="State" error={e.state?.message}>
          {(p) => <Input {...p} {...f.register("state")} />}
        </Field>
        <Field label="Country" error={e.country?.message}>
          {(p) => <Input {...p} {...f.register("country")} />}
        </Field>
        <Field label="GST number" error={e.gstNumber?.message} hint="15-character GSTIN">
          {(p) => <Input {...p} className="uppercase" placeholder="07AABCA1234F1Z5" {...f.register("gstNumber")} />}
        </Field>
        <Field label="Business address" error={e.address?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...f.register("address")} />}
        </Field>
      </FormSection>
    </>
  );
};

export function CreateAgencyForm({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [created, setCreated] = useState<{ id: string; email: string; password: string; emailStatus: string } | null>(null);
  const form = useForm<AgencyCreateInput>({
    resolver: zodResolver(agencyCreateSchema),
    defaultValues: { name: "", ownerName: "", email: "", phone: "", city: "", state: "", country: "India", address: "", gstNumber: "", plan: "GROWTH", status: "TRIAL", loginEmail: "", tempPassword: tempPassword() },
  });
  const create = useAction(createAgencyAction, {
    success: false,
    refresh: false,
    onSuccess: (d) => setCreated({ id: d.agencyId, email: form.getValues("loginEmail"), password: form.getValues("tempPassword"), emailStatus: d.emailStatus }),
    onError: (r) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof AgencyCreateInput, { message: m })),
  });
  const e = form.formState.errors;

  if (created) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-7 text-center animate-fade-in">
        <CheckCircle2 className="mx-auto size-10 text-ok" aria-hidden />
        <h2 className="mt-3 text-[20px] font-semibold">{form.getValues("name")} is ready</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Workspace, owner account and subscription created.{" "}
          {created.emailStatus === "SENT" ? "A welcome email is on its way." : created.emailStatus === "LOGGED" ? "Welcome email recorded (development mode — not delivered)." : "The welcome email failed — share these credentials securely."}
        </p>
        <dl className="mt-5 space-y-2 rounded-xl border bg-surface p-4 text-left font-mono text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Login</dt>
            <dd>{created.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Temporary password</dt>
            <dd>{created.password}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[12px] text-muted-foreground">Shown once. The agent must choose a new password at first sign-in.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(`TRAVORA login\nEmail: ${created.email}\nTemporary password: ${created.password}`).then(() => toast.success("Copied."), () => toast.error("Couldn't copy."))}
          >
            <Copy className="size-4" aria-hidden /> Copy credentials
          </Button>
          <Button asChild>
            <Link href={`/admin/agents/${created.id}`}>Open agency</Link>
          </Button>
        </div>
        <Button asChild variant="link" className="mt-2">
          <Link href={`/admin/agents/${created.id}/hotels`}>Assign hotels next →</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit((v) => create.run(v))} noValidate>
      {profileFields(form)}
      <FormSection title="Plan" description="Can be changed any time.">
        <PlanPicker plans={plans} value={form.watch("plan")} onChange={(c) => form.setValue("plan", c)} />
      </FormSection>
      <FormSection title="Account" description="The owner signs in with these and must set a new password.">
        <Field label="Login email" required error={e.loginEmail?.message}>
          {(p) => (
            <div className="flex gap-2">
              <Input {...p} type="email" {...form.register("loginEmail")} />
              <Button type="button" variant="outline" onClick={() => form.setValue("loginEmail", form.getValues("email"), { shouldValidate: true })}>
                Same as email
              </Button>
            </div>
          )}
        </Field>
        <Field label="Temporary password" required error={e.tempPassword?.message}>
          {(p) => (
            <div className="flex gap-2">
              <Input {...p} className="font-mono" autoComplete="off" {...form.register("tempPassword")} />
              <Button type="button" variant="outline" size="icon" onClick={() => form.setValue("tempPassword", tempPassword())} aria-label="Generate a new password">
                <RefreshCw className="size-4" />
              </Button>
            </div>
          )}
        </Field>
      </FormSection>
      <FormSection title="Status" description="Trial agencies have full access for 14 days.">
        <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2 sm:col-span-2">
          {(["ACTIVE", "TRIAL", "SUSPENDED"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={form.watch("status") === s} onClick={() => form.setValue("status", s)} className={cn("rounded-lg border px-4 py-2 text-[13.5px] font-medium capitalize", form.watch("status") === s ? "border-primary bg-accent text-accent-foreground" : "hover:border-foreground/20")}>
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      </FormSection>
      <div className="sticky bottom-16 z-10 -mx-5 mt-4 flex justify-end gap-2 border-t bg-card/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7 lg:bottom-0">
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/agents")}>
          Cancel
        </Button>
        <SubmitButton pending={create.pending} pendingLabel="Creating workspace…">
          Create agency
        </SubmitButton>
      </div>
    </form>
  );
}

export function EditAgencyForm({ agencyId, plans, initial }: { agencyId: string; plans: Plan[]; initial: AgencyUpdateInput }) {
  const router = useRouter();
  const form = useForm<AgencyUpdateInput>({ resolver: zodResolver(agencyUpdateSchema), defaultValues: initial });
  const save = useAction((v: AgencyUpdateInput) => updateAgencyAction(agencyId, v), {
    onSuccess: () => router.push(`/admin/agents/${agencyId}`),
    onError: (r) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof AgencyUpdateInput, { message: m })),
  });
  return (
    <form onSubmit={form.handleSubmit((v) => save.run(v))} noValidate>
      {profileFields(form)}
      <FormSection title="Plan">
        <PlanPicker plans={plans} value={form.watch("plan")} onChange={(c) => form.setValue("plan", c, { shouldDirty: true })} />
      </FormSection>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push(`/admin/agents/${agencyId}`)}>
          Cancel
        </Button>
        <SubmitButton pending={save.pending} pendingLabel="Saving…">
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

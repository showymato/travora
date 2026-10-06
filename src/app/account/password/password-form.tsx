"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, SubmitButton } from "@/components/app/form";
import { passwordChangeSchema } from "@/lib/schemas";
import { useAction } from "@/lib/use-action";
import { changePasswordAction } from "@/server/actions/auth";

type V = z.infer<typeof passwordChangeSchema>;

export function PasswordForm({ home, forced }: { home: string; forced: boolean }) {
  const form = useForm<V>({ resolver: zodResolver(passwordChangeSchema), defaultValues: { current: "", next: "", confirm: "" } });
  const { run, pending } = useAction(changePasswordAction, {
    refresh: false,
    // Full navigation: the client router may still hold the pre-change
    // redirect to this page, which would bounce the user straight back.
    onSuccess: (to) => window.location.assign(to),
    onError: (r) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof V, { message: m })),
  });
  const e = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit((v) => run(v))} className="mt-8 space-y-4" noValidate>
      <Field label={forced ? "Temporary password" : "Current password"} required error={e.current?.message}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" className="h-10" {...form.register("current")} />}
      </Field>
      <Field label="New password" required error={e.next?.message} hint="At least 10 characters.">
        {(p) => <Input {...p} type="password" autoComplete="new-password" className="h-10" {...form.register("next")} />}
      </Field>
      <Field label="Confirm new password" required error={e.confirm?.message}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" className="h-10" {...form.register("confirm")} />}
      </Field>
      <SubmitButton pending={pending} pendingLabel="Saving…" className="h-10 w-full">
        Save password
      </SubmitButton>
      {!forced ? (
        <Button asChild variant="ghost" className="w-full">
          <Link href={home}>Cancel</Link>
        </Button>
      ) : null}
    </form>
  );
}

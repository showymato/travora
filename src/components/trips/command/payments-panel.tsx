"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Plus, Receipt } from "lucide-react";
import type { Payment } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, SubmitButton, toInt } from "@/components/app/form";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/states";
import { Pill } from "@/components/app/badges";
import { fmtDate, todayISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethodValue } from "@/lib/labels";
import { paymentSchema, type PaymentInput } from "@/lib/schemas";
import { useAction } from "@/lib/use-action";
import { generateDocumentAction, recordPaymentAction, voidPaymentAction } from "@/server/actions/trips";

export function RecordPaymentDialog({ tripId, pending, hasEmail, trigger }: { tripId: string; pending: number; hasEmail: boolean; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const initial: PaymentInput = { amount: pending > 0 ? pending : 0, paidAt: todayISO(), method: "UPI", reference: "", notes: "", notifyGuest: hasEmail };
  const form = useForm<PaymentInput>({ resolver: zodResolver(paymentSchema), defaultValues: initial });
  const save = useAction((v: PaymentInput) => recordPaymentAction(tripId, v), {
    success: (d) => `Payment recorded. Balance now ${formatINR(d.summary.pending)}.`,
    onSuccess: () => setOpen(false),
    onError: (r) => r.fieldErrors && Object.entries(r.fieldErrors).forEach(([k, m]) => form.setError(k as keyof PaymentInput, { message: m })),
  });
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
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden /> Record payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>Balance due: {formatINR(pending)}. Online payments (Razorpay) will be recorded automatically once connected.</DialogDescription>
        </DialogHeader>
        <form id="pay-form" onSubmit={form.handleSubmit((v) => save.run(v))} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Amount (₹)" required error={e.amount?.message}>
            {(p) => <Input {...p} inputMode="numeric" autoFocus {...form.register("amount", { setValueAs: (v) => toInt(String(v)) })} />}
          </Field>
          <Field label="Date" required error={e.paidAt?.message}>
            {(p) => <Input {...p} type="date" max={todayISO()} {...form.register("paidAt")} />}
          </Field>
          <Field label="Method" required>
            {(p) => (
              <Select value={form.watch("method")} onValueChange={(v) => form.setValue("method", v as PaymentMethodValue)}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.filter((m) => m !== "RAZORPAY").map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Reference" error={e.reference?.message} hint="UTR, cheque no., etc.">
            {(p) => <Input {...p} {...form.register("reference")} />}
          </Field>
          <Field label="Notes" error={e.notes?.message} className="sm:col-span-2">
            {(p) => <Input {...p} {...form.register("notes")} />}
          </Field>
          <div className="flex items-center gap-2.5 sm:col-span-2">
            <Switch id="pay-notify" checked={form.watch("notifyGuest")} disabled={!hasEmail} onCheckedChange={(c) => form.setValue("notifyGuest", c)} />
            <Label htmlFor="pay-notify" className="font-normal">
              {hasEmail ? "Email the guest a confirmation" : "Guest has no email address"}
            </Label>
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton form="pay-form" pending={save.pending} pendingLabel="Recording…">
            Record payment
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentsList({ tripId, payments }: { tripId: string; payments: Payment[] }) {
  const voidP = useAction((id: string, reason: string) => voidPaymentAction(id, reason));
  const receipt = useAction((paymentId: string) => generateDocumentAction(tripId, "PAYMENT_RECEIPT", paymentId), { success: (d) => `${d.title} generated.` });
  const [reason, setReason] = useState("");
  if (!payments.length) return <EmptyState compact icon={<Receipt />} title="No payments yet" description="Record advances and balances as they come in. Totals update automatically." />;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="border-b text-left text-[12px] text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">Date</th>
            <th scope="col" className="py-2 pr-3 font-medium">Method</th>
            <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">Reference</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Amount</th>
            <th scope="col" className="py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="py-2.5 pr-3 whitespace-nowrap tabular">{fmtDate(p.paidAt)}</td>
              <td className="py-2.5 pr-3">
                {PAYMENT_METHOD_LABEL[p.method as PaymentMethodValue]}
                {p.voidedAt ? (
                  <Pill tone="bad" className="ml-2">
                    Void
                  </Pill>
                ) : null}
              </td>
              <td className="hidden py-2.5 pr-3 font-mono text-[12.5px] text-muted-foreground sm:table-cell">{p.reference ?? "—"}</td>
              <td className={`py-2.5 pr-3 text-right font-medium whitespace-nowrap tabular ${p.voidedAt ? "text-muted-foreground line-through" : ""}`}>{formatINR(p.amount)}</td>
              <td className="py-2.5 text-right whitespace-nowrap">
                {!p.voidedAt ? (
                  <>
                    <Button variant="ghost" size="xs" onClick={() => receipt.run(p.id)} disabled={receipt.pending}>
                      Receipt
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-xs" aria-label="Void payment">
                          <Ban />
                        </Button>
                      }
                      title={`Void ${formatINR(p.amount)} payment?`}
                      description="Voided payments stay in the history but no longer count towards the total paid."
                      confirmLabel="Void payment"
                      destructive
                      onConfirm={() => voidP.run(p.id, reason || "Entered in error")}
                    >
                      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. duplicate entry)" aria-label="Reason" />
                    </ConfirmDialog>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

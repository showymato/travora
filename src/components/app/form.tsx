"use client";

import { useId, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + hint/error, wired for accessibility. The child receives
 * id / aria-invalid / aria-describedby through the render prop.
 */
export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
  id: idProp,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  id?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string; "aria-required"?: boolean }) => ReactNode;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[13px] font-medium">
        {label}
        {required ? (
          <span className="text-bad" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy, "aria-required": required || undefined })}
      {error ? (
        <p id={`${id}-error`} className="text-[12.5px] text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12.5px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("grid grid-cols-1 gap-x-10 gap-y-4 border-b py-7 first:pt-0 last:border-0 last:pb-0 lg:grid-cols-[220px_minmax(0,1fr)]", className)}>
      <div>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 min-w-0 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SubmitButton({ pending, children, pendingLabel, className, ...props }: React.ComponentProps<typeof Button> & { pending?: boolean; pendingLabel?: string }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} className={className} {...props}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Integer input that keeps react-hook-form values numeric. */
export function toInt(v: string) {
  const n = Number(v.replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

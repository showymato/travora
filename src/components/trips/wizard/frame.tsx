"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronLeft, CloudCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtRelative } from "@/lib/dates";

export const STEPS = ["Guest", "Dates", "Destinations", "Hotels", "Rooms", "Transport", "Activities", "Itinerary", "Review", "Send"] as const;

export { stepHref } from "@/lib/plan";
import { stepHref } from "@/lib/plan";

/** Warn before leaving with edits that haven't been saved yet. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export function SaveStatus({ state, savedAt }: { state: SaveState; savedAt: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground" aria-live="polite" suppressHydrationWarning>
      {state === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving…
        </>
      ) : state === "error" ? (
        <span className="text-bad">Not saved — check the highlighted fields</span>
      ) : savedAt ? (
        <>
          <CloudCheck className="size-3.5 text-ok" aria-hidden /> <span suppressHydrationWarning>Saved {fmtRelative(savedAt)}</span>
        </>
      ) : (
        "Draft not saved yet"
      )}
    </span>
  );
}

export function WizardFrame({
  tripId,
  code,
  step,
  reached,
  title,
  description,
  summary,
  savedAt,
  children,
}: {
  tripId: string | null;
  code: string | null;
  step: number;
  reached: number;
  title: string;
  description?: ReactNode;
  summary?: ReactNode;
  savedAt: string | null;
  children: ReactNode;
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={tripId ? `/app/trips/${tripId}` : "/app/trips"} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3.5" aria-hidden /> {tripId ? `Trip ${code}` : "Trips"}
        </Link>
        <SaveStatus state="idle" savedAt={savedAt} />
      </div>

      {/* Mobile progress */}
      <div className="mb-6 lg:hidden">
        <div className="flex items-baseline justify-between text-[12.5px]">
          <span className="font-medium">
            Step {String(step).padStart(2, "0")} · {STEPS[step - 1]}
          </span>
          <span className="text-muted-foreground">{step} of 10</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={10} aria-valuenow={step} aria-label="Trip setup progress">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${step * 10}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_280px]">
        <nav aria-label="Trip setup steps" className="hidden lg:block">
          <ol className="sticky top-20 space-y-0.5">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step || n <= reached - 1;
              const current = n === step;
              const enabled = Boolean(tripId) && n <= Math.max(reached, step);
              const inner = (
                <>
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular",
                      current ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary/30 bg-secondary text-primary" : "bg-card text-muted-foreground",
                    )}
                  >
                    {done && !current ? <Check className="size-3.5" aria-hidden /> : String(n).padStart(2, "0")}
                  </span>
                  <span className={cn(current ? "font-semibold text-foreground" : done ? "text-foreground/80" : "text-muted-foreground")}>{label}</span>
                </>
              );
              return (
                <li key={label}>
                  {enabled && !current ? (
                    <Link href={stepHref(tripId, n)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13.5px] transition-colors hover:bg-muted">
                      {inner}
                    </Link>
                  ) : (
                    <span aria-current={current ? "step" : undefined} className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13.5px]", current && "bg-accent")}>
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="min-w-0" aria-labelledby="step-title">
          <p className="text-[12.5px] font-medium tracking-wide text-muted-foreground">STEP {String(step).padStart(2, "0")}</p>
          <h1 id="step-title" className="mt-1 text-[26px] font-semibold tracking-[-0.02em]">
            {title}
          </h1>
          {description ? <p className="mt-1 text-[14.5px] text-muted-foreground">{description}</p> : null}
          <div className="mt-6">{children}</div>
        </section>

        {summary ? <aside className="hidden xl:block">{summary}</aside> : null}
      </div>
    </div>
  );
}

export function WizardFooter({
  back,
  onContinue,
  continueLabel = "Continue",
  pending,
  disabled,
  extra,
}: {
  back?: string | null;
  onContinue: () => void;
  continueLabel?: string;
  pending?: boolean;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="sticky bottom-16 z-20 -mx-4 mt-8 flex items-center gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0 lg:mx-0 lg:rounded-xl lg:border lg:px-4">
      {back ? (
        <Button asChild variant="ghost">
          <Link href={back}>
            <ChevronLeft className="size-4" aria-hidden /> Back
          </Link>
        </Button>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        {extra}
        <Button onClick={onContinue} disabled={pending || disabled}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronLeft, CloudCheck, Loader2, TriangleAlert } from "lucide-react";
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
  mobileSummary,
  attention = {},
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
  /** Collapsed summary for screens without the side panel. */
  mobileSummary?: { label: ReactNode; body: ReactNode };
  /** Steps needing attention → reason. */
  attention?: Record<number, string>;
  savedAt: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const stateOf = (n: number) => {
    if (n === step) return "current" as const;
    const visited = n < Math.max(reached, step);
    if (visited && attention[n]) return "attention" as const;
    if (visited) return "done" as const;
    return "upcoming" as const;
  };
  const enabled = (n: number) => Boolean(tripId) && n <= Math.max(reached, step);
  const collapsible = mobileSummary ? (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] [&::-webkit-details-marker]:hidden">
        {mobileSummary.label}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t px-4 py-3">{mobileSummary.body}</div>
    </details>
  ) : null;
  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={tripId ? `/app/trips/${tripId}` : "/app/trips"} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3.5" aria-hidden /> {tripId ? `Trip ${code}` : "Trips"}
        </Link>
        <SaveStatus state="idle" savedAt={savedAt} />
      </div>

      {/* Compact progress + step selector below lg */}
      <div className="mb-5 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="wizard-step" className="sr-only">
            Go to step
          </label>
          <select
            id="wizard-step"
            value={step}
            onChange={(e) => router.push(stepHref(tripId, Number(e.target.value)))}
            disabled={!tripId}
            className="h-9 min-w-0 flex-1 rounded-lg border bg-card px-3 text-[13.5px] font-medium dark:bg-input/30"
          >
            {STEPS.map((label, i) => {
              const n = i + 1;
              const st = stateOf(n);
              return (
                <option key={label} value={n} disabled={!enabled(n)}>
                  {`${String(n).padStart(2, "0")} · ${label}${st === "done" ? " ✓" : st === "attention" ? " — needs attention" : ""}`}
                </option>
              );
            })}
          </select>
          <span className="shrink-0 text-[12.5px] text-muted-foreground tabular">{step} of 10</span>
        </div>
        <div className="mt-2.5 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={10} aria-valuenow={step} aria-label="Trip setup progress">
          {STEPS.map((label, i) => {
            const st = stateOf(i + 1);
            return <span key={label} className={cn("h-1 flex-1 rounded-full", st === "current" ? "bg-primary" : st === "attention" ? "bg-warn" : st === "done" ? "bg-primary/45" : "bg-muted")} />;
          })}
        </div>
        {collapsible ? <div className="mt-4">{collapsible}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[180px_minmax(0,1fr)_272px] xl:gap-7">
        <nav aria-label="Trip setup steps" className="hidden lg:block">
          <ol className="sticky top-20 space-y-0.5">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const st = stateOf(n);
              const reason = st === "attention" ? attention[n] : undefined;
              const inner = (
                <>
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular transition-colors",
                      st === "current" && "border-primary bg-primary text-primary-foreground",
                      st === "done" && "border-primary/30 bg-primary/10 text-primary",
                      st === "attention" && "border-warn/50 bg-warn-soft text-warn",
                      st === "upcoming" && "bg-card text-muted-foreground",
                    )}
                  >
                    {st === "done" ? <Check className="size-3.5" aria-hidden /> : st === "attention" ? <TriangleAlert className="size-3" aria-hidden /> : String(n).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block", st === "current" ? "font-semibold text-foreground" : st === "upcoming" ? "text-muted-foreground" : "text-foreground/85")}>{label}</span>
                    {reason ? <span className="block truncate text-[11.5px] leading-tight text-warn">{reason}</span> : null}
                  </span>
                  <span className="sr-only">{st === "done" ? " (completed)" : st === "attention" ? ` (needs attention: ${reason})` : st === "current" ? " (current step)" : ""}</span>
                </>
              );
              return (
                <li key={label}>
                  {enabled(n) && st !== "current" ? (
                    <Link href={stepHref(tripId, n)} title={reason} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] transition-colors hover:bg-muted">
                      {inner}
                    </Link>
                  ) : (
                    <span aria-current={st === "current" ? "step" : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px]", st === "current" && "bg-primary/10 ring-1 ring-primary/20")}>
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="min-w-0" aria-labelledby="step-title">
          {collapsible ? <div className="mb-5 hidden lg:block xl:hidden">{collapsible}</div> : null}
          <p className="text-[12px] font-medium tracking-[0.06em] text-muted-foreground">STEP {String(step).padStart(2, "0")} / 10</p>
          <h1 id="step-title" className="mt-1 text-[24px] font-semibold tracking-[-0.02em] sm:text-[26px]">
            {title}
          </h1>
          {description ? <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">{description}</p> : null}
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

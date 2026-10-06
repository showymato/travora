"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/form";
import { addDays, fmtLong, nightsBetween, todayISO } from "@/lib/dates";
import { tripDatesSchema } from "@/lib/schemas";
import { updateDatesAction } from "@/server/actions/trips";
import { SaveStatus, WizardFooter, stepHref, useUnsavedGuard, type SaveState } from "./frame";

export function DatesStep({ tripId, initial, savedAt }: { tripId: string; initial: { startDate: string | null; endDate: string | null }; savedAt: string | null }) {
  const router = useRouter();
  const [start, setStart] = useState(initial.startDate ?? "");
  const [end, setEnd] = useState(initial.endDate ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState({ start: initial.startDate ?? "", end: initial.endDate ?? "" });
  const dirty = start !== saved.start || end !== saved.end;
  useUnsavedGuard(dirty);

  const nights = start && end ? nightsBetween(start, end) : 0;
  const parsed = tripDatesSchema.safeParse({ startDate: start, endDate: end });
  const issue = start && end && !parsed.success ? parsed.error.issues[0].message : null;

  const save = async (): Promise<boolean> => {
    if (!parsed.success) {
      setError(start && end ? parsed.error.issues[0].message : "Choose both dates.");
      return false;
    }
    if (!dirty) return true;
    setState("saving");
    const r = await updateDatesAction(tripId, { startDate: start, endDate: end });
    if (!r.ok) {
      setState("error");
      setError(r.message);
      toast.error(r.message);
      return false;
    }
    setSaved({ start, end });
    setState("saved");
    setError(null);
    router.refresh();
    return true;
  };

  // Autosave valid changes after a short pause.
  useEffect(() => {
    if (!dirty || !parsed.success) return;
    const t = setTimeout(save, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const presets = [3, 4, 5, 6, 7];

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="rounded-xl border bg-card p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Arrival" required error={!start && error ? "Choose the arrival date." : undefined}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={start}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Keep the trip length when moving the arrival date.
                    if (start && end && v && nights > 0) setEnd(addDays(v, nights));
                    setStart(v);
                  }}
                  className="h-10"
                />
              )}
            </Field>
            <Field label="Departure" required error={issue ?? (start && !end && error ? "Choose the departure date." : undefined)}>
              {(p) => <Input {...p} type="date" value={end} min={start ? addDays(start, 1) : undefined} onChange={(e) => setEnd(e.target.value)} className="h-10" />}
            </Field>
          </div>
          <div className="mt-5">
            <p className="text-[12.5px] font-medium text-muted-foreground">Quick length</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((n) => (
                <Button
                  key={n}
                  variant={nights === n ? "secondary" : "outline"}
                  size="sm"
                  disabled={!start}
                  onClick={() => setEnd(addDays(start, n))}
                  aria-pressed={nights === n}
                >
                  {n}N / {n + 1}D
                </Button>
              ))}
            </div>
            {!start ? <p className="mt-2 text-[12.5px] text-muted-foreground">Pick the arrival date first.</p> : null}
          </div>
          {start && start < todayISO() ? <p className="mt-4 text-[12.5px] text-warn">The arrival date is in the past — fine for recording a completed trip.</p> : null}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden /> Trip length
          </div>
          {nights > 0 && !issue ? (
            <>
              <div className="mt-3 flex items-end gap-6">
                <div>
                  <p className="text-[34px] leading-none font-semibold tabular">{nights}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                    <Moon className="size-3.5" aria-hidden /> Nights
                  </p>
                </div>
                <div>
                  <p className="text-[34px] leading-none font-semibold tabular">{nights + 1}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                    <Sun className="size-3.5" aria-hidden /> Days
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[13px]">
                {fmtLong(start)}
                <br />
                <span className="text-muted-foreground">to</span> {fmtLong(end)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-[13.5px] text-muted-foreground">Nights and days are calculated as soon as both dates are set.</p>
          )}
          <div className="mt-4 border-t pt-3">
            <SaveStatus state={state} savedAt={state === "saved" ? new Date().toISOString() : savedAt} />
          </div>
        </div>
      </div>
      <p className="mt-4 text-[12.5px] text-muted-foreground">Changing the dates later moves hotels, transfers and activities with the trip when its length stays the same.</p>
      <WizardFooter
        back={stepHref(tripId, 1)}
        pending={state === "saving"}
        onContinue={async () => {
          if (await save()) router.push(stepHref(tripId, 3));
        }}
      />
    </>
  );
}

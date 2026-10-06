"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Search, Star, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Initials } from "@/components/app/visuals";
import { GuestForm } from "@/components/guests/guest-form";
import { searchGuestsAction } from "@/server/actions/agent";
import { startTripAction, updateTravelersAction } from "@/server/actions/trips";
import { cn } from "@/lib/utils";
import { WizardFooter, stepHref, useUnsavedGuard } from "./frame";

export type GuestLite = { id: string; fullName: string; phone: string | null; email: string | null };

function Counter({ label, hint, value, min, onChange }: { label: string; hint: string; value: number; min: number; onChange: (n: number) => void }) {
  const id = label.toLowerCase();
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <p id={`${id}-l`} className="text-[14px] font-medium">
          {label}
        </p>
        <p className="text-[12.5px] text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-2" role="group" aria-labelledby={`${id}-l`}>
        <Button variant="outline" size="icon-sm" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus className="size-3.5" />
        </Button>
        <span className="w-6 text-center text-[15px] font-semibold tabular" aria-live="polite">
          {value}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => onChange(Math.min(60, value + 1))} aria-label={`More ${label.toLowerCase()}`}>
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

import { travellerSummary } from "@/lib/plan";
export { travellerSummary };

export function GuestStep({
  tripId,
  initial,
}: {
  tripId: string | null;
  initial: { primaryId: string | null; guests: GuestLite[]; adults: number; children: number; infants: number };
}) {
  const router = useRouter();
  const [guests, setGuests] = useState<GuestLite[]>(initial.guests);
  const [primaryId, setPrimaryId] = useState<string | null>(initial.primaryId);
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);
  const [infants, setInfants] = useState(initial.infants);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<(GuestLite & { _count: { trips: number } })[]>([]);
  const [searching, startSearch] = useTransition();
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);

  useEffect(() => {
    const t = setTimeout(
      () =>
        startSearch(async () => {
          const r = await searchGuestsAction(q);
          if (r.ok) setResults(r.data);
        }),
      q ? 200 : 0,
    );
    return () => clearTimeout(t);
  }, [q]);

  const add = (g: GuestLite) => {
    if (guests.some((x) => x.id === g.id)) return;
    const next = [...guests, g];
    setGuests(next);
    if (!primaryId) setPrimaryId(g.id);
    if (next.length > adults + children + infants) setAdults(next.length - children - infants);
    setDirty(true);
  };
  const remove = (id: string) => {
    const next = guests.filter((g) => g.id !== id);
    setGuests(next);
    if (primaryId === id) setPrimaryId(next[0]?.id ?? null);
    setDirty(true);
  };

  const save = async () => {
    if (!primaryId) {
      toast.error("Choose the primary guest — the person you'll be in touch with.");
      return;
    }
    setPending(true);
    const payload = { primaryGuestId: primaryId, guestIds: guests.map((g) => g.id), adults, children, infants };
    const r = tripId ? await updateTravelersAction(tripId, payload) : await startTripAction(payload);
    setPending(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    setDirty(false);
    const id = tripId ?? (r.data as string);
    if (!tripId) toast.success("Draft saved. You can leave and come back any time.");
    router.push(stepHref(id, 2));
  };

  const available = results.filter((r) => !guests.some((g) => g.id === r.id));

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests by name, phone or email" className="pl-9" aria-label="Search guests" autoFocus />
            </div>
            <Button variant="outline" onClick={() => setCreating(true)}>
              <UserPlus className="size-4" aria-hidden /> <span className="hidden sm:inline">Create guest</span>
              <span className="sr-only sm:hidden">Create guest</span>
            </Button>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-1.5" aria-busy={searching}>
            <p className="px-2.5 pt-1.5 pb-1 text-[12px] font-medium text-muted-foreground">{q ? "Matches" : "Recent guests"}</p>
            {searching && !results.length ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />
              </div>
            ) : available.length ? (
              <ul>
                {available.map((g) => (
                  <li key={g.id}>
                    <button onClick={() => add(g)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted">
                      <Initials name={g.fullName} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{g.fullName}</span>
                        <span className="block truncate text-[12.5px] text-muted-foreground">
                          {[g.phone, g.email].filter(Boolean).join(" · ") || "No contact details"} · {g._count.trips} trip{g._count.trips === 1 ? "" : "s"}
                        </span>
                      </span>
                      <Plus className="size-4 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                {q ? `No guest matches “${q}”.` : "No guests yet."}{" "}
                <button onClick={() => setCreating(true)} className="font-medium text-primary underline-offset-2 hover:underline">
                  Create {q ? `“${q}”` : "a guest"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[14px] font-semibold">Travellers on this trip</h2>
              <span className="text-[12.5px] text-muted-foreground">{travellerSummary(adults, children, infants)}</span>
            </div>
            {guests.length ? (
              <ul className="mt-3 space-y-1.5">
                {guests.map((g) => {
                  const primary = g.id === primaryId;
                  return (
                    <li key={g.id} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2", primary && "border-primary/30 bg-accent/50")}>
                      <Initials name={g.fullName} className="size-7 text-[11px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium">{g.fullName}</p>
                        {primary ? <p className="text-[11.5px] text-primary">Primary guest · main contact</p> : null}
                      </div>
                      {!primary ? (
                        <Button variant="ghost" size="xs" onClick={() => (setPrimaryId(g.id), setDirty(true))} aria-label={`Make ${g.fullName} the primary guest`}>
                          <Star className="size-3" aria-hidden /> Primary
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="icon-xs" onClick={() => remove(g.id)} aria-label={`Remove ${g.fullName}`}>
                        <X />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed px-3 py-6 text-center text-[13px] text-muted-foreground">Select or create the primary guest to start.</p>
            )}
            <p className="mt-3 text-[12px] text-muted-foreground">Name only the travellers you need on vouchers — headcounts below can include unnamed travellers.</p>
          </div>
          <div className="divide-y rounded-xl border bg-card px-4">
            <Counter label="Adults" hint="12 years and over" value={adults} min={1} onChange={(n) => (setAdults(n), setDirty(true))} />
            <Counter label="Children" hint="2–11 years" value={children} min={0} onChange={(n) => (setChildren(n), setDirty(true))} />
            <Counter label="Infants" hint="Under 2" value={infants} min={0} onChange={(n) => (setInfants(n), setDirty(true))} />
          </div>
        </div>
      </div>

      <WizardFooter back={null} onContinue={save} pending={pending} disabled={!primaryId} continueLabel={tripId ? "Save & continue" : "Start trip"} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create guest</DialogTitle>
            <DialogDescription>Just the essentials — complete the profile later.</DialogDescription>
          </DialogHeader>
          <GuestForm
            compact
            initial={{ fullName: q }}
            onCancel={() => setCreating(false)}
            onSaved={(g) => {
              if (g) add(g);
              setCreating(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

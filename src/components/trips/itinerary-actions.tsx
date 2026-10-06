"use client";

import { useState } from "react";
import { LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import { generateItineraryAction } from "@/server/actions/trips";

export type TemplateOption = { id: string; name: string; description: string | null; destination: string; nights: number; tags: string[] };

/** "Generate from trip details" and "Use template". Both replace the current plan, so they confirm first. */
export function ItineraryActions({ tripId, templates, hasItems, nights }: { tripId: string; templates: TemplateOption[]; hasItems: boolean; nights: number }) {
  const gen = useAction((templateId: string | null) => generateItineraryAction(tripId, templateId));
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const sorted = [...templates].sort((a, b) => Math.abs(a.nights - nights) - Math.abs(b.nights - nights));
  const pickedT = templates.find((t) => t.id === picked);

  const generateButton = (
    <Button variant={hasItems ? "outline" : "default"} disabled={gen.pending} onClick={hasItems ? undefined : () => gen.run(null)}>
      {gen.pending && !open ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
      {hasItems ? "Regenerate" : "Generate itinerary"}
    </Button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {hasItems ? (
        <ConfirmDialog
          trigger={generateButton}
          title="Rebuild the itinerary?"
          description="This replaces the current plan with a fresh skeleton built from the trip's hotels, transfers and activities. Manual edits will be lost."
          confirmLabel="Rebuild"
          onConfirm={() => gen.run(null)}
        />
      ) : (
        generateButton
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <LayoutTemplate className="size-4" aria-hidden /> Use template
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start from a template</DialogTitle>
            <DialogDescription>
              Templates fill each day with a proven plan. Your hotels, transfers and activities are kept and replace the template&apos;s placeholders. Templates closest to {nights} nights are listed first.
            </DialogDescription>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="py-6 text-center text-[13.5px] text-muted-foreground">No templates are available yet. Your platform administrator can add them.</p>
          ) : (
            <div role="radiogroup" aria-label="Templates" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sorted.map((t) => (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={picked === t.id}
                  onClick={() => setPicked(t.id)}
                  className={cn("rounded-xl border p-3.5 text-left transition-colors hover:border-foreground/20", picked === t.id && "border-primary ring-2 ring-primary/20")}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium">{t.name}</p>
                    <span className="shrink-0 text-[12px] text-muted-foreground tabular">
                      {t.nights}N / {t.nights + 1}D
                    </span>
                  </div>
                  {t.description ? <p className="mt-1 line-clamp-2 text-[12.5px] text-muted-foreground">{t.description}</p> : null}
                  {t.tags.length ? <p className="mt-2 text-[11.5px] text-muted-foreground">{t.tags.join(" · ")}</p> : null}
                </button>
              ))}
            </div>
          )}
          {pickedT && pickedT.nights !== nights ? (
            <p className="text-[12.5px] text-warn">
              This template has {pickedT.nights} nights and your trip has {nights}. Extra template days are skipped; extra trip days stay free to plan.
            </p>
          ) : null}
          {hasItems ? <p className="text-[12.5px] text-muted-foreground">Applying a template replaces the current itinerary.</p> : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!picked || gen.pending}
              onClick={async () => {
                const r = await gen.run(picked);
                if (r.ok) setOpen(false);
              }}
            >
              {gen.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Apply template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

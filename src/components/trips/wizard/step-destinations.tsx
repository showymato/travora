"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, fmtShort } from "@/lib/dates";
import { setDestinationsAction } from "@/server/actions/trips";
import { cn } from "@/lib/utils";
import { SaveStatus, WizardFooter, stepHref, useUnsavedGuard, type SaveState } from "./frame";

type Dest = { key: string; name: string; destinationId: string | null; nights: number | null };
type CatalogItem = { id: string; name: string; region: string | null };

/** Consecutive date ranges for a list of night counts. */
function toRanges(start: string, nights: number[]) {
  const out: { from: string; to: string }[] = [];
  for (const n of nights) {
    const from = out.length ? out[out.length - 1].to : start;
    out.push({ from, to: addDays(from, n) });
  }
  return out;
}

let seq = 0;
const k = () => `d${++seq}`;

/** Same allocation rule as the server, for the live preview. */
function allocate(total: number, explicit: (number | null)[]) {
  const fixed = explicit.reduce<number>((s, n) => s + (n ?? 0), 0);
  const open = explicit.filter((n) => n === null).length;
  const rest = Math.max(0, total - fixed);
  let extra = open ? rest % open : 0;
  return explicit.map((n) => {
    if (n !== null) return n;
    const v = Math.floor(rest / open) + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    return v;
  });
}

export function DestinationsStep({
  tripId,
  start,
  nights,
  initial,
  catalog,
  savedAt,
}: {
  tripId: string;
  start: string;
  nights: number;
  initial: { name: string; destinationId: string | null; nights: number | null }[];
  catalog: CatalogItem[];
  savedAt: string | null;
}) {
  const router = useRouter();
  const dndId = useId();
  const [list, setList] = useState<Dest[]>(() => initial.map((d) => ({ ...d, key: k() })));
  const [q, setQ] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial.map(({ name, destinationId, nights }) => ({ name, destinationId, nights }))));
  const payload = list.map(({ name, destinationId, nights }) => ({ name, destinationId, nights }));
  const dirty = JSON.stringify(payload) !== savedJson;
  useUnsavedGuard(dirty);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const allocated = allocate(nights, list.map((d) => d.nights));
  const totalAllocated = allocated.reduce((s, n) => s + n, 0);
  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase();
    return catalog.filter((c) => !list.some((d) => d.name.toLowerCase() === c.name.toLowerCase()) && (!term || c.name.toLowerCase().includes(term) || c.region?.toLowerCase().includes(term))).slice(0, 8);
  }, [q, catalog, list]);

  const save = async () => {
    if (!dirty) return true;
    setState("saving");
    const r = await setDestinationsAction(tripId, { destinations: payload });
    if (!r.ok) {
      setState("error");
      toast.error(r.message);
      return false;
    }
    setSavedJson(JSON.stringify(payload));
    setState("saved");
    router.refresh();
    return true;
  };

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(payload)]);

  const addName = (name: string, destinationId: string | null) => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return;
    if (list.some((d) => d.name.toLowerCase() === clean.toLowerCase())) {
      toast.info(`${clean} is already on the trip.`);
      return;
    }
    const match = catalog.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    setList((l) => [...l, { key: k(), name: match?.name ?? clean, destinationId: destinationId ?? match?.id ?? null, nights: null }]);
    setQ("");
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setList((l) => arrayMove(l, l.findIndex((d) => d.key === active.id), l.findIndex((d) => d.key === over.id)));
  };

  const ranges = toRanges(start, allocated);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="min-w-0">
          <div className="rounded-xl border bg-card">
            <div className="border-b p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addName(q, null);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or type a destination" className="pl-9" aria-label="Destination" />
                </div>
                <Button type="submit" variant="outline" disabled={!q.trim()}>
                  <Plus className="size-4" aria-hidden /> Add
                </Button>
              </form>
              {suggestions.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button key={s.id} onClick={() => addName(s.name, s.id)} className="inline-flex h-7 items-center gap-1 rounded-full border bg-background px-2.5 text-[12.5px] transition-colors hover:border-foreground/20 hover:bg-muted">
                      <Plus className="size-3 text-muted-foreground" aria-hidden />
                      {s.name}
                      {s.region ? <span className="text-muted-foreground">· {s.region}</span> : null}
                    </button>
                  ))}
                </div>
              ) : q.trim() ? (
                <p className="mt-2 text-[12.5px] text-muted-foreground">Press Enter to add “{q.trim()}” as a custom destination.</p>
              ) : null}
            </div>
            {list.length ? (
              <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={list.map((d) => d.key)} strategy={verticalListSortingStrategy}>
                  <ol className="divide-y">
                    {list.map((d, i) => (
                      <DestRow
                        key={d.key}
                        d={d}
                        index={i}
                        auto={allocated[i]}
                        range={ranges[i]}
                        onNights={(n) => setList((l) => l.map((x) => (x.key === d.key ? { ...x, nights: n } : x)))}
                        onRemove={() => setList((l) => l.filter((x) => x.key !== d.key))}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="px-4 py-10 text-center text-[13.5px] text-muted-foreground">Add the places your guest will stay, in order. You can drag to reorder.</p>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-[14px] font-semibold">Route</h2>
          {list.length ? (
            <ol className="mt-3 space-y-3">
              {list.map((d, i) => (
                <li key={d.key} className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-teal-soft text-[11px] font-semibold text-teal">{i + 1}</span>
                  <span className="flex-1 text-[14px] font-medium">{d.name}</span>
                  <span className="text-[12.5px] text-muted-foreground tabular">
                    {allocated[i]}N{allocated[i] ? ` · ${fmtShort(ranges[i].from)}–${fmtShort(ranges[i].to)}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">No destinations yet.</p>
          )}
          <p className={cn("mt-4 text-[12.5px]", totalAllocated !== nights && list.length ? "text-warn" : "text-muted-foreground")}>
            {list.length ? (totalAllocated === nights ? `All ${nights} nights are planned.` : `${totalAllocated} of ${nights} nights planned — adjust the nights so they add up.`) : `${nights} nights to plan.`}
          </p>
          <div className="mt-4 border-t pt-3">
            <SaveStatus state={state} savedAt={state === "saved" ? new Date().toISOString() : savedAt} />
          </div>
        </div>
      </div>
      <WizardFooter
        back={stepHref(tripId, 2)}
        pending={state === "saving"}
        onContinue={async () => {
          if (!list.length) {
            toast.error("Add at least one destination.");
            return;
          }
          if (await save()) router.push(stepHref(tripId, 4));
        }}
      />
    </>
  );
}

function DestRow({ d, index, auto, range, onNights, onRemove }: { d: Dest; index: number; auto: number; range: { from: string; to: string }; onNights: (n: number | null) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: d.key });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-2 bg-card px-2 py-2.5 sm:px-3", isDragging && "relative z-10 shadow-md")}>
      <button {...attributes} {...listeners} className="flex h-8 w-6 cursor-grab touch-none items-center justify-center text-muted-foreground/60 hover:text-foreground" aria-label={`Reorder ${d.name}`}>
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 text-[12.5px] text-muted-foreground tabular">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">{d.name}</p>
        <p className="text-[12px] text-muted-foreground">{auto ? `${fmtShort(range.from)} → ${fmtShort(range.to)}` : "No nights"}{!d.destinationId ? " · custom" : ""}</p>
      </div>
      <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Input
          type="number"
          min={0}
          max={60}
          value={d.nights ?? ""}
          placeholder={String(auto)}
          onChange={(e) => onNights(e.target.value === "" ? null : Math.max(0, Math.min(60, Number(e.target.value))))}
          className="h-8 w-16 text-center"
          aria-label={`Nights in ${d.name}`}
        />
        nights
      </label>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${d.name}`}>
        <X className="size-4" />
      </Button>
    </li>
  );
}

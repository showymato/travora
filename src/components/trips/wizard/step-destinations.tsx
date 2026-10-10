"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CircleAlert, GripVertical, MapPin, Minus, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtShort } from "@/lib/dates";
import { allocateNights, toRanges } from "@/lib/plan";
import { setDestinationsAction } from "@/server/actions/trips";
import { cn } from "@/lib/utils";
import { SaveStatus, WizardFooter, stepHref, useUnsavedGuard, type SaveState } from "./frame";

type Dest = { key: string; name: string; destinationId: string | null; nights: number | null };
type CatalogItem = { id: string; name: string; region: string | null };
type Range = { from: string; to: string };

let seq = 0;
const k = () => `d${++seq}`;

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
  // Dates as last saved, so the agent can see what a change moved.
  const [savedRanges, setSavedRanges] = useState<Map<string, Range>>(() => {
    const r = toRanges(start, allocateNights(nights, initial.map((d) => d.nights)));
    return new Map(initial.map((d, i) => [d.name.toLowerCase(), r[i]]));
  });
  const payload = list.map(({ name, destinationId, nights }) => ({ name, destinationId, nights }));
  const dirty = JSON.stringify(payload) !== savedJson;
  useUnsavedGuard(dirty);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const allocated = allocateNights(nights, list.map((d) => d.nights));
  const totalAllocated = allocated.reduce((s, n) => s + n, 0);
  const over = totalAllocated > nights;
  const under = list.length > 0 && totalAllocated < nights;
  const ranges = toRanges(start, allocated);
  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase();
    return catalog.filter((c) => !list.some((d) => d.name.toLowerCase() === c.name.toLowerCase()) && (!term || c.name.toLowerCase().includes(term) || c.region?.toLowerCase().includes(term))).slice(0, 8);
  }, [q, catalog, list]);

  const save = async () => {
    if (!dirty) return true;
    if (over) {
      setState("error");
      return false;
    }
    setState("saving");
    const snapshot = JSON.stringify(payload);
    let r;
    try {
      r = await setDestinationsAction(tripId, { destinations: payload });
    } catch {
      r = { ok: false as const, message: "We couldn't reach the server. Your changes are kept here — try again." };
    }
    if (!r.ok) {
      setState("error");
      toast.error(r.message);
      return false;
    }
    setSavedJson(snapshot);
    setSavedRanges(new Map(list.map((d, i) => [d.name.toLowerCase(), ranges[i]])));
    setState("saved");
    router.refresh();
    return true;
  };

  useEffect(() => {
    if (!dirty || over) return;
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
    if (list.length >= 15) {
      toast.error("15 destinations at most.");
      return;
    }
    const match = catalog.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    setList((l) => [...l, { key: k(), name: match?.name ?? clean, destinationId: destinationId ?? match?.id ?? null, nights: null }]);
    setQ("");
  };

  const onDragEnd = ({ active, over: target }: DragEndEvent) => {
    if (!target || active.id === target.id) return;
    setList((l) => arrayMove(l, l.findIndex((d) => d.key === active.id), l.findIndex((d) => d.key === target.id)));
  };
  const move = (key: string, dir: -1 | 1) =>
    setList((l) => {
      const i = l.findIndex((d) => d.key === key);
      const j = i + dir;
      return j < 0 || j >= l.length ? l : arrayMove(l, i, j);
    });

  const setNights = (key: string, n: number | null) => setList((l) => l.map((x) => (x.key === key ? { ...x, nights: n === null ? null : Math.max(0, Math.min(60, n)) } : x)));
  const splitEvenly = () => setList((l) => l.map((x) => ({ ...x, nights: null })));
  const fitLast = () =>
    setList((l) => {
      const last = l[l.length - 1];
      const others = allocated.slice(0, -1).reduce((s, n) => s + n, 0);
      return l.map((x) => (x.key === last.key ? { ...x, nights: Math.max(0, nights - others) } : x));
    });

  const routePanel = (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13.5px] font-semibold">Route</h2>
        <SaveStatus state={state} savedAt={state === "saved" ? new Date().toISOString() : savedAt} />
      </div>
      {list.length ? (
        <ol className="relative mt-3 space-y-0">
          {list.map((d, i) => (
            <li key={d.key} className="relative flex gap-3 pb-4 last:pb-0">
              {i < list.length - 1 ? <span className="absolute top-6 bottom-0 left-[11px] w-px bg-border" aria-hidden /> : null}
              <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-soft text-[11px] font-semibold text-teal">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{d.name}</p>
                <p className="text-[12.5px] text-muted-foreground tabular">
                  {allocated[i] ? `${fmtShort(ranges[i].from)} → ${fmtShort(ranges[i].to)} · ${allocated[i]}N` : "Day visit · no nights"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">No destinations yet.</p>
      )}
      <div className="mt-4 border-t pt-3">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-muted-foreground">Nights planned</span>
          <span className={cn("font-medium tabular", over ? "text-bad" : under ? "text-warn" : "text-ok")}>
            {totalAllocated} / {nights}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-[width]", over ? "bg-bad" : under ? "bg-warn" : "bg-ok")} style={{ width: `${Math.min(100, nights ? (totalAllocated / nights) * 100 : 0)}%` }} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border bg-card">
            <div className="border-b p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addName(q, null);
                }}
                className="flex gap-2"
              >
                <div className="relative min-w-0 flex-1">
                  <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or type a destination" className="pl-9" aria-label="Destination" />
                </div>
                <Button type="submit" variant="outline" disabled={!q.trim()}>
                  <Plus className="size-4" aria-hidden /> Add
                </Button>
              </form>
              {suggestions.length ? (
                <div className="mt-2.5">
                  <p className="mb-1.5 text-[11.5px] font-medium tracking-wide text-muted-foreground">{q.trim() ? "MATCHES" : "SUGGESTED"}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button key={s.id} type="button" onClick={() => addName(s.name, s.id)} className="inline-flex h-7 items-center gap-1 rounded-full border bg-background px-2.5 text-[12.5px] transition-colors hover:border-foreground/20 hover:bg-muted">
                        <Plus className="size-3 text-muted-foreground" aria-hidden />
                        {s.name}
                        {s.region ? <span className="text-muted-foreground">· {s.region}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : q.trim() ? (
                <p className="mt-2 text-[12.5px] text-muted-foreground">Press Enter to add “{q.trim()}” as a custom destination.</p>
              ) : null}
            </div>
            {list.length ? (
              <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={list.map((d) => d.key)} strategy={verticalListSortingStrategy}>
                  <ol className="divide-y">
                    {list.map((d, i) => {
                      const prev = savedRanges.get(d.name.toLowerCase());
                      const moved = Boolean(prev && allocated[i] && (prev.from !== ranges[i].from || prev.to !== ranges[i].to));
                      return (
                        <DestRow
                          key={d.key}
                          d={d}
                          index={i}
                          count={list.length}
                          auto={allocated[i]}
                          range={ranges[i]}
                          previous={moved ? prev! : null}
                          onNights={(n) => setNights(d.key, n)}
                          onMove={(dir) => move(d.key, dir)}
                          onRemove={() => setList((l) => l.filter((x) => x.key !== d.key))}
                        />
                      );
                    })}
                  </ol>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="px-4 py-10 text-center text-[13.5px] text-muted-foreground">Add the places your guest will stay, in the order they&apos;ll visit. You can drag to reorder.</p>
            )}
          </div>

          {over || under ? (
            <div role="status" className={cn("flex flex-col gap-2 rounded-xl border px-4 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between", over ? "border-bad/40 bg-bad-soft text-bad" : "border-warn/40 bg-warn-soft text-warn")}>
              <p className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {over
                  ? `${totalAllocated} nights planned, but the trip has ${nights}. Reduce some nights or change the dates — nothing is saved until this adds up.`
                  : `${totalAllocated} of ${nights} nights planned. ${nights - totalAllocated} night${nights - totalAllocated === 1 ? " has" : "s have"} no destination.`}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={fitLast}>
                  Fit {list[list.length - 1]?.name}
                </Button>
                <Button size="sm" variant="outline" onClick={splitEvenly}>
                  Split evenly
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        {routePanel}
      </div>
      <WizardFooter
        back={stepHref(tripId, 2)}
        pending={state === "saving"}
        onContinue={async () => {
          if (!list.length) {
            toast.error("Add at least one destination.");
            return;
          }
          if (over) {
            toast.error("The nights add up to more than the trip. Fix the schedule first.");
            return;
          }
          if (await save()) router.push(stepHref(tripId, 4));
        }}
      />
    </>
  );
}

function DestRow({
  d,
  index,
  count,
  auto,
  range,
  previous,
  onNights,
  onMove,
  onRemove,
}: {
  d: Dest;
  index: number;
  count: number;
  auto: number;
  range: Range;
  previous: Range | null;
  onNights: (n: number | null) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: d.key });
  const value = d.nights ?? auto;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex flex-wrap items-center gap-x-2 gap-y-2 bg-card px-2 py-3 sm:flex-nowrap sm:px-3", isDragging && "relative z-10 shadow-md")}>
      <button
        {...attributes}
        {...listeners}
        onKeyDown={(e) => {
          if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            onMove(e.key === "ArrowUp" ? -1 : 1);
          } else listeners?.onKeyDown?.(e);
        }}
        className="flex h-8 w-6 cursor-grab touch-none items-center justify-center text-muted-foreground/60 hover:text-foreground"
        aria-label={`Reorder ${d.name} (position ${index + 1} of ${count})`}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular">{index + 1}</span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-[14px] font-medium">
          {d.name}
          {!d.destinationId ? <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">custom</span> : null}
        </p>
        <p className="text-[12.5px] text-muted-foreground tabular">
          {auto ? `${fmtShort(range.from)} → ${fmtShort(range.to)}` : "Day visit · no nights"}
          {previous ? (
            <span className="ml-1.5 rounded bg-info-soft px-1 py-px text-[11px] text-info" title={`Was ${fmtShort(previous.from)} → ${fmtShort(previous.to)}`}>
              moved · was {fmtShort(previous.from)}–{fmtShort(previous.to)}
            </span>
          ) : null}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <div className="flex items-center rounded-lg border" role="group" aria-label={`Adjust stay length for ${d.name}`}>
          <Button type="button" variant="ghost" size="icon-sm" className="rounded-r-none" onClick={() => onNights(value - 1)} disabled={value <= 0} aria-label={`One night fewer in ${d.name}`}>
            <Minus className="size-3.5" />
          </Button>
          <Input
            type="number"
            min={0}
            max={60}
            value={d.nights ?? ""}
            placeholder={String(auto)}
            onChange={(e) => onNights(e.target.value === "" ? null : Number(e.target.value))}
            className="h-8 w-12 rounded-none border-0 bg-transparent px-0 text-center tabular shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-label={`Nights in ${d.name}`}
          />
          <Button type="button" variant="ghost" size="icon-sm" className="rounded-l-none" onClick={() => onNights(value + 1)} disabled={value >= 60} aria-label={`One more night in ${d.name}`}>
            <Plus className="size-3.5" />
          </Button>
        </div>
        <span className="w-12 text-[11.5px] text-muted-foreground">
          {d.nights === null ? (
            "auto"
          ) : (
            <button type="button" onClick={() => onNights(null)} className="inline-flex items-center gap-0.5 hover:text-foreground" title="Let TRAVORA split the remaining nights" aria-label={`Set ${d.name} nights back to automatic`}>
              <RotateCcw className="size-3" aria-hidden /> fixed
            </button>
          )}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${d.name}`}>
          <X className="size-4" />
        </Button>
      </div>
    </li>
  );
}

"use client";

import { useId, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, GripVertical, Link2, MoreHorizontal, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fmtDow, fmtDuration, fmtTime } from "@/lib/dates";
import { ITEM_TYPE_LABEL, type ItemTypeValue } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ItineraryItemInput } from "@/lib/schemas";
import { addItemAction, deleteItemAction, duplicateItemAction, reorderItemsAction, updateDayAction, updateItemAction } from "@/server/actions/trips";
import { ItemIcon } from "./item-icon";
import { ItemDialog, blankItem } from "./item-dialog";

export type BuilderItem = {
  id: string;
  time: string | null;
  type: string;
  title: string;
  description: string | null;
  location: string | null;
  durationMins: number | null;
  notes: string | null;
  source: string;
};
export type BuilderDay = { id: string; dayNumber: number; date: Date | string; title: string | null; summary: string | null; items: BuilderItem[] };

const SOURCE_HINT: Record<string, string> = { HOTEL: "From hotel stay", TRANSPORT: "From transport", ACTIVITY: "From activities" };

function toInput(i: BuilderItem): ItineraryItemInput {
  return { time: i.time ?? "", type: i.type as ItemTypeValue, title: i.title, description: i.description ?? "", location: i.location ?? "", durationMins: i.durationMins, notes: i.notes ?? "" };
}

/**
 * Day-by-day itinerary editor. Items can be dragged within and across days
 * (pointer or keyboard), or moved with the menu. Every change persists
 * immediately; reorders are optimistic and roll back on failure.
 */
export function ItineraryBuilder({ tripId, days: initialDays, readOnly = false }: { tripId: string; days: BuilderDay[]; readOnly?: boolean }) {
  const router = useRouter();
  const dndId = useId();
  const [days, setDays] = useState(initialDays);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<BuilderDay[] | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const dayOf = (id: string) => days.find((d) => d.id === id || d.items.some((i) => i.id === id));
  const activeItem = useMemo(() => days.flatMap((d) => d.items).find((i) => i.id === activeId) ?? null, [days, activeId]);

  const persist = async (layout: Record<string, string[]>, rollback: BuilderDay[]) => {
    const res = await reorderItemsAction(tripId, layout);
    if (!res.ok) {
      setDays(rollback);
      toast.error(res.message);
    }
    router.refresh();
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setSnapshot(days);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = dayOf(String(active.id));
    const to = dayOf(String(over.id));
    if (!from || !to || from.id === to.id) return;
    setDays((prev) => {
      const item = from.items.find((i) => i.id === active.id)!;
      return prev.map((d) => {
        if (d.id === from.id) return { ...d, items: d.items.filter((i) => i.id !== active.id) };
        if (d.id === to.id) {
          const idx = d.items.findIndex((i) => i.id === over.id);
          const items = [...d.items];
          items.splice(idx < 0 ? items.length : idx, 0, item);
          return { ...d, items };
        }
        return d;
      });
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const before = snapshot ?? days;
    setSnapshot(null);
    if (!over) {
      setDays(before);
      return;
    }
    const day = dayOf(String(active.id));
    if (!day) return;
    let items = day.items;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (newIndex >= 0 && oldIndex !== newIndex) items = arrayMove(items, oldIndex, newIndex);
    const next = days.map((d) => (d.id === day.id ? { ...d, items } : d));
    setDays(next);
    const origin = before.find((d) => d.items.some((i) => i.id === active.id))!;
    const changedOrder = origin.id !== day.id || origin.items.map((i) => i.id).join() !== items.map((i) => i.id).join();
    if (!changedOrder) return;
    const layout: Record<string, string[]> = { [day.id]: items.map((i) => i.id) };
    if (origin.id !== day.id) layout[origin.id] = next.find((d) => d.id === origin.id)!.items.map((i) => i.id);
    persist(layout, before);
  };

  const move = (itemId: string, toDayId: string, position: "start" | "end" | number) => {
    const before = days;
    const from = dayOf(itemId)!;
    const item = from.items.find((i) => i.id === itemId)!;
    let next = days.map((d) => (d.id === from.id ? { ...d, items: d.items.filter((i) => i.id !== itemId) } : d));
    next = next.map((d) => {
      if (d.id !== toDayId) return d;
      const items = [...d.items];
      const at = position === "start" ? 0 : position === "end" ? items.length : position;
      items.splice(at, 0, item);
      return { ...d, items };
    });
    setDays(next);
    const layout: Record<string, string[]> = { [toDayId]: next.find((d) => d.id === toDayId)!.items.map((i) => i.id) };
    if (from.id !== toDayId) layout[from.id] = next.find((d) => d.id === from.id)!.items.map((i) => i.id);
    persist(layout, before);
  };

  if (!days.length) return null;

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => snapshot && setDays(snapshot)}>
      <ol className="space-y-4">
        {days.map((day) => (
          <DayColumn key={day.id} day={day} days={days} readOnly={readOnly} onMove={move} justAdded={justAdded} onAdded={(title) => setJustAdded(title)} />
        ))}
      </ol>
      <DragOverlay dropAnimation={null}>{activeItem ? <ItemRow item={activeItem} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function DayColumn({
  day,
  days,
  readOnly,
  onMove,
  justAdded,
  onAdded,
}: {
  day: BuilderDay;
  days: BuilderDay[];
  readOnly: boolean;
  onMove: (itemId: string, toDayId: string, position: "start" | "end" | number) => void;
  justAdded: string | null;
  onAdded: (title: string) => void;
}) {
  const router = useRouter();
  const { setNodeRef, isOver } = useDroppable({ id: day.id });
  const [editDay, setEditDay] = useState(false);

  const add = async (v: ItineraryItemInput) => {
    const res = await addItemAction(day.id, v);
    if (!res.ok) {
      toast.error(res.message);
      return { fieldErrors: res.fieldErrors };
    }
    toast.success(`Added to Day ${day.dayNumber}`);
    onAdded(v.title);
    router.refresh();
    return true;
  };

  return (
    <li className="rounded-xl border bg-card" aria-labelledby={`day-${day.id}`}>
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <span className="text-[9.5px] leading-none font-semibold tracking-wider uppercase">Day</span>
          <span className="text-[16px] leading-tight font-semibold tabular">{day.dayNumber}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 id={`day-${day.id}`} className="truncate text-[15px] font-semibold">
            {day.title || `Day ${day.dayNumber}`}
          </h3>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {fmtDow(day.date)}
            {day.summary ? ` · ${day.summary}` : ""}
          </p>
        </div>
        {!readOnly ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Rename Day ${day.dayNumber}`} onClick={() => setEditDay(true)}>
              <Pencil className="size-3.5" />
            </Button>
            <ItemDialog
              title={`Add to Day ${day.dayNumber}`}
              description={fmtDow(day.date)}
              initial={blankItem}
              onSubmit={add}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus className="size-3.5" aria-hidden /> Add item
                </Button>
              }
            />
          </div>
        ) : null}
      </div>
      <div ref={setNodeRef} className={cn("min-h-14 px-2 py-2 transition-colors sm:px-3", isOver && "bg-accent/50")}>
        <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {day.items.length ? (
            <ul>
              {day.items.map((item, idx) => (
                <SortableItem key={item.id} item={item} day={day} index={idx} days={days} readOnly={readOnly} onMove={onMove} highlight={justAdded === item.title} />
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-[13px] text-muted-foreground">{readOnly ? "At leisure." : "Nothing planned. Add an item or drag one here."}</p>
          )}
        </SortableContext>
      </div>
      {!readOnly ? <DayDialog day={day} open={editDay} onOpenChange={setEditDay} /> : null}
    </li>
  );
}

function SortableItem({
  item,
  day,
  index,
  days,
  readOnly,
  onMove,
  highlight,
}: {
  item: BuilderItem;
  day: BuilderDay;
  index: number;
  days: BuilderDay[];
  readOnly: boolean;
  onMove: (itemId: string, toDayId: string, position: "start" | "end" | number) => void;
  highlight: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: readOnly });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40", highlight && "animate-insert rounded-lg")}>
      <ItemRow
        item={item}
        handle={
          readOnly ? null : (
            <button {...attributes} {...listeners} className="flex h-8 w-5 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 hover:text-foreground active:cursor-grabbing" aria-label={`Drag ${item.title}`}>
              <GripVertical className="size-4" />
            </button>
          )
        }
        actions={readOnly ? null : <ItemActions item={item} day={day} index={index} days={days} onMove={onMove} />}
      />
    </li>
  );
}

export function ItemRow({ item, handle, actions, overlay }: { item: BuilderItem; handle?: React.ReactNode; actions?: React.ReactNode; overlay?: boolean }) {
  const placeholder = item.notes && /^(Add |Transport not)/.test(item.notes);
  return (
    <div className={cn("group flex items-start gap-2 rounded-lg px-1.5 py-2 sm:gap-3", overlay ? "border bg-card shadow-lg" : "hover:bg-muted/50")}>
      {handle}
      <div className="w-[64px] shrink-0 pt-1.5 text-right text-[12.5px] font-medium text-muted-foreground tabular">{item.time ? fmtTime(item.time) : "—"}</div>
      <ItemIcon type={item.type} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[14px] leading-snug font-medium">{item.title}</p>
        <p className="text-[12.5px] text-muted-foreground">{[ITEM_TYPE_LABEL[item.type as ItemTypeValue], item.location, fmtDuration(item.durationMins)].filter(Boolean).join(" · ")}</p>
        {item.description ? <p className="mt-1 text-[13px] whitespace-pre-line text-foreground/80">{item.description}</p> : null}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {SOURCE_HINT[item.source] ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <Link2 className="size-3" aria-hidden /> {SOURCE_HINT[item.source]}
            </span>
          ) : null}
          {item.notes ? (
            <span className={cn("inline-flex items-center gap-1 text-[11.5px]", placeholder ? "text-warn" : "text-muted-foreground")}>
              <StickyNote className="size-3" aria-hidden /> {item.notes}
            </span>
          ) : null}
        </div>
      </div>
      {actions}
    </div>
  );
}

function ItemActions({
  item,
  day,
  index,
  days,
  onMove,
}: {
  item: BuilderItem;
  day: BuilderDay;
  index: number;
  days: BuilderDay[];
  onMove: (itemId: string, toDayId: string, position: "start" | "end" | number) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const call = async (fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) => {
    const r = await fn();
    if (r.ok) toast.success(ok);
    else toast.error(r.message ?? "Something went wrong.");
    router.refresh();
    return r.ok;
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:data-[state=open]:opacity-100" aria-label={`Actions for ${item.title}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil aria-hidden /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => call(() => duplicateItemAction(item.id), "Item duplicated.")}>
            <Copy aria-hidden /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(item.id, day.id, index - 1)}>
            <ArrowUp aria-hidden /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === day.items.length - 1} onSelect={() => onMove(item.id, day.id, index + 1)}>
            <ArrowDown aria-hidden /> Move down
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to day</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              {days
                .filter((d) => d.id !== day.id)
                .map((d) => (
                  <DropdownMenuItem key={d.id} onSelect={() => onMove(item.id, d.id, "end")}>
                    Day {d.dayNumber} · {fmtDow(d.date)}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ItemDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit item"
        description={item.source !== "MANUAL" && SOURCE_HINT[item.source] ? `${SOURCE_HINT[item.source]} — editing the source later will refresh this item.` : `Day ${day.dayNumber} · ${fmtDow(day.date)}`}
        initial={toInput(item)}
        onSubmit={async (v) => {
          const r = await updateItemAction(item.id, v);
          if (!r.ok) {
            toast.error(r.message);
            return { fieldErrors: r.fieldErrors };
          }
          toast.success("Item saved.");
          router.refresh();
          return true;
        }}
      />
      {confirmDelete ? (
        <ConfirmDeleteItem title={item.title} onClose={() => setConfirmDelete(false)} onConfirm={() => call(() => deleteItemAction(item.id), "Item removed.")} />
      ) : null}
    </>
  );
}

function ConfirmDeleteItem({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: () => Promise<boolean> }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{title}”?</DialogTitle>
          <DialogDescription>This removes it from the itinerary. You can add it again later.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <DeleteButton
            onClick={async () => {
              const ok = await onConfirm();
              if (ok) onClose();
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ onClick }: { onClick: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className="bg-bad text-white hover:bg-bad/90"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await onClick();
        setBusy(false);
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </Button>
  );
}

function DayDialog({ day, open, onOpenChange }: { day: BuilderDay; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(day.title ?? "");
  const [summary, setSummary] = useState(day.summary ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setTitle(day.title ?? "");
          setSummary(day.summary ?? "");
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Day {day.dayNumber}</DialogTitle>
          <DialogDescription>{fmtDow(day.date)}</DialogDescription>
        </DialogHeader>
        <form
          id={`day-form-${day.id}`}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await updateDayAction(day.id, { title, summary });
            setBusy(false);
            if (r.ok) {
              toast.success("Day updated.");
              onOpenChange(false);
              router.refresh();
            } else toast.error(r.message);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`dt-${day.id}`}>Title</Label>
            <Input id={`dt-${day.id}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Srinagar → Gulmarg" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ds-${day.id}`}>Summary</Label>
            <Textarea id={`ds-${day.id}`} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={600} placeholder="A short line the guest sees under the day title." />
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={`day-form-${day.id}`} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { builderKey } from "@/lib/plan";

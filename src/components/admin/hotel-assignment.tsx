"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stars } from "@/components/app/visuals";
import { Pill } from "@/components/app/badges";
import { HOTEL_CATEGORIES, HOTEL_CATEGORY_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useAction } from "@/lib/use-action";
import { setAssignmentsAction } from "@/server/actions/admin";

type Hotel = { id: string; name: string; category: string; location: string; status: string; destination: { name: string } | null; _count: { rooms: number } };

/** Which hotels an agency may see and book. Changes are staged, then saved together. */
export function HotelAssignment({ agencyId, agencyName, hotels, assigned }: { agencyId: string; agencyName: string; hotels: Hotel[]; assigned: string[] }) {
  const [selected, setSelected] = useState(new Set(assigned));
  const [saved, setSaved] = useState(new Set(assigned));
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const save = useAction(() => setAssignmentsAction(agencyId, [...selected]), {
    success: (d) => (d.added || d.removed ? `Saved: ${d.added} added, ${d.removed} removed.` : "No changes."),
    onSuccess: () => setSaved(new Set(selected)),
  });
  const visible = useMemo(
    () => hotels.filter((h) => (category === "all" || h.category === category) && (!q || `${h.name} ${h.location} ${h.destination?.name ?? ""}`.toLowerCase().includes(q.toLowerCase()))),
    [hotels, q, category],
  );
  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id));
  const allVisible = visible.length > 0 && visible.every((h) => selected.has(h.id));
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hotels…" className="pl-9" aria-label="Search hotels" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {HOTEL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {HOTEL_CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={() => setSelected((s) => new Set([...s, ...visible.map((h) => h.id)]))} disabled={allVisible}>
            <Check className="size-3.5" aria-hidden /> Select {q || category !== "all" ? "shown" : "all"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelected((s) => new Set([...s].filter((id) => !visible.some((h) => h.id === id))))}>
            <X className="size-3.5" aria-hidden /> Clear {q || category !== "all" ? "shown" : "all"}
          </Button>
        </div>
      </div>
      <p className="border-b bg-surface/50 px-4 py-2 text-[12.5px] text-muted-foreground">
        AVAILABLE HOTELS for {agencyName} · {selected.size} of {hotels.length} selected
      </p>
      <ul className="divide-y">
        {visible.map((h) => {
          const on = selected.has(h.id);
          const changed = on !== saved.has(h.id);
          return (
            <li key={h.id}>
              <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40", on && "bg-accent/30")}>
                <Checkbox checked={on} onCheckedChange={() => toggle(h.id)} aria-label={`${on ? "Remove" : "Give"} access to ${h.name}`} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                    {h.name} <Stars category={h.category} />
                    {h.status === "INACTIVE" ? <Pill>Inactive</Pill> : null}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {h.location} · {h._count.rooms} room type{h._count.rooms === 1 ? "" : "s"}
                  </p>
                </div>
                {changed ? <span className="text-[12px] font-medium text-warn">{on ? "Will add" : "Will remove"}</span> : null}
                <span className={cn("flex size-6 items-center justify-center rounded-full text-[12px]", on ? "bg-ok-soft text-ok" : "bg-muted text-muted-foreground")} aria-hidden>
                  {on ? "✓" : "✕"}
                </span>
              </label>
            </li>
          );
        })}
        {!visible.length ? <li className="px-4 py-8 text-center text-[13.5px] text-muted-foreground">No hotels match.</li> : null}
      </ul>
      <div className="sticky bottom-16 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur lg:bottom-0">
        <span className="text-[13px] text-muted-foreground">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setSelected(new Set(saved))}>
            Discard
          </Button>
          <Button disabled={!dirty || save.pending} onClick={() => save.run()}>
            {save.pending ? "Saving…" : "Save access"}
          </Button>
        </div>
      </div>
    </div>
  );
}

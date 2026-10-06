"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ItemDialog, blankItem } from "@/components/trips/item-dialog";
import { ItemRow } from "@/components/trips/itinerary-builder";
import { useUnsavedGuard } from "@/components/trips/wizard/frame";
import { templateSchema, type TemplateInput, type TemplateItemInput } from "@/lib/schemas";
import { saveTemplateAction, deleteTemplateAction } from "@/server/actions/admin";

const blankDay = () => ({ title: "", summary: "", items: [] as TemplateItemInput[] });

export function TemplateEditor({ templateId, initial }: { templateId?: string; initial: TemplateInput }) {
  const router = useRouter();
  const [t, setT] = useState<TemplateInput>(initial);
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);

  const update = (patch: Partial<TemplateInput>) => {
    setT((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const setNights = (n: number) => {
    const nights = Math.max(1, Math.min(30, n || 1));
    const days = [...t.days];
    while (days.length < nights + 1) days.push(blankDay());
    update({ nights, days: days.slice(0, nights + 1) });
  };
  const setDay = (i: number, patch: Partial<TemplateInput["days"][number]>) => update({ days: t.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const moveItem = (di: number, ii: number, dir: -1 | 1) => {
    const items = [...t.days[di].items];
    const [it] = items.splice(ii, 1);
    items.splice(ii + dir, 0, it);
    setDay(di, { items });
  };

  const save = async () => {
    const payload = { ...t, tags: tagText.split(",").map((s) => s.trim()).filter(Boolean) };
    const parsed = templateSchema.safeParse(payload);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (fe[i.path.join(".")] ??= i.message));
      setErrors(fe);
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setErrors({});
    setSaving(true);
    const r = await saveTemplateAction(templateId ?? null, parsed.data);
    setSaving(false);
    if (!r.ok) return toast.error(r.message);
    setDirty(false);
    toast.success("Template saved.");
    router.push(`/admin/templates/${r.data}`);
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">
              Name<span className="text-bad">*</span>
            </Label>
            <Input id="t-name" value={t.name} onChange={(e) => update({ name: e.target.value })} placeholder="Kashmir 6N / 7D" aria-invalid={Boolean(errors.name)} />
            {errors.name ? <p className="text-[12.5px] text-bad">{errors.name}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-dest">
              Destination<span className="text-bad">*</span>
            </Label>
            <Input id="t-dest" value={t.destination} onChange={(e) => update({ destination: e.target.value })} placeholder="Kashmir" aria-invalid={Boolean(errors.destination)} />
            {errors.destination ? <p className="text-[12.5px] text-bad">{errors.destination}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-nights">Nights</Label>
              <Input id="t-nights" type="number" min={1} max={30} value={t.nights} onChange={(e) => setNights(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-status">Status</Label>
              <Select value={t.status} onValueChange={(v) => update({ status: v as TemplateInput["status"] })}>
                <SelectTrigger id="t-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-tags">Tags</Label>
            <Input id="t-tags" value={tagText} onChange={(e) => (setTagText(e.target.value), setDirty(true))} placeholder="Honeymoon, Luxury" />
            <p className="text-[12px] text-muted-foreground">Comma separated</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" rows={3} value={t.description} onChange={(e) => update({ description: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save template"}
          </Button>
          {templateId ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="icon" aria-label="Delete template">
                  <Trash2 className="size-4" />
                </Button>
              }
              title="Delete this template?"
              description="Trips that already used it keep their itineraries."
              confirmLabel="Delete"
              destructive
              onConfirm={async () => {
                const r = await deleteTemplateAction(templateId);
                if (r.ok) {
                  setDirty(false);
                  toast.success("Template deleted.");
                  router.push("/admin/templates");
                } else toast.error(r.message);
                return r;
              }}
            />
          ) : null}
        </div>
        {dirty ? <p className="text-center text-[12.5px] text-warn">Unsaved changes</p> : null}
      </aside>

      <ol className="space-y-4">
        {t.days.map((d, di) => (
          <li key={di} className="rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <span className="text-[9.5px] leading-none font-semibold uppercase">Day</span>
                <span className="text-[16px] leading-tight font-semibold">{di + 1}</span>
              </span>
              <Input value={d.title} onChange={(e) => setDay(di, { title: e.target.value })} placeholder={di === 0 ? "Arrival in Srinagar" : `Day ${di + 1} title`} className="min-w-0 flex-1" aria-label={`Day ${di + 1} title`} />
              <ItemDialog
                title={`Add to Day ${di + 1}`}
                initial={blankItem}
                onSubmit={async (v) => {
                  setDay(di, { items: [...d.items, v].sort((a, b) => (a.time || "99").localeCompare(b.time || "99")) });
                  return true;
                }}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="size-3.5" aria-hidden /> Add item
                  </Button>
                }
              />
            </div>
            <div className="px-4 pt-3">
              <Input value={d.summary} onChange={(e) => setDay(di, { summary: e.target.value })} placeholder="One-line summary the guest sees under the day title" aria-label={`Day ${di + 1} summary`} className="text-[13px]" />
            </div>
            <ul className="px-2 py-2">
              {d.items.map((it, ii) => (
                <li key={ii}>
                  <ItemRow
                    item={{ id: String(ii), time: it.time || null, type: it.type, title: it.title, description: it.description || null, location: it.location || null, durationMins: it.durationMins, notes: it.notes || null, source: "TEMPLATE" }}
                    actions={
                      <div className="flex shrink-0">
                        <Button variant="ghost" size="icon-xs" disabled={ii === 0} onClick={() => moveItem(di, ii, -1)} aria-label="Move up">
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon-xs" disabled={ii === d.items.length - 1} onClick={() => moveItem(di, ii, 1)} aria-label="Move down">
                          <ArrowDown />
                        </Button>
                        <ItemDialog
                          title="Edit item"
                          initial={it}
                          onSubmit={async (v) => {
                            setDay(di, { items: d.items.map((x, j) => (j === ii ? v : x)) });
                            return true;
                          }}
                          trigger={
                            <Button variant="ghost" size="icon-xs" aria-label={`Edit ${it.title}`}>
                              <Pencil />
                            </Button>
                          }
                        />
                        <Button variant="ghost" size="icon-xs" onClick={() => setDay(di, { items: d.items.filter((_, j) => j !== ii) })} aria-label={`Remove ${it.title}`}>
                          <Trash2 />
                        </Button>
                      </div>
                    }
                  />
                </li>
              ))}
              {!d.items.length ? <li className="px-3 py-3 text-[13px] text-muted-foreground">No items — this day is at leisure.</li> : null}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

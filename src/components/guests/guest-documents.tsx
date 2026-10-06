"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileText, Lock, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { GuestDocument } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/states";
import { fmtDateTime } from "@/lib/dates";
import { ID_TYPES, ID_TYPE_LABEL, type IdTypeValue } from "@/lib/labels";
import { useAction } from "@/lib/use-action";
import { deleteGuestDocumentAction, uploadGuestDocumentAction } from "@/server/actions/agent";

/** Private ID documents. Files are never public: every view goes through an authorised, audited route. */
export function GuestDocuments({ guestId, documents }: { guestId: string; documents: GuestDocument[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<IdTypeValue>("PASSPORT");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const remove = useAction(deleteGuestDocumentAction);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 8 MB.`);
        continue;
      }
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      fd.set("label", label);
      const r = await uploadGuestDocumentAction(guestId, fd);
      if (r.ok) ok++;
      else toast.error(`${file.name}: ${r.message}`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (ok) {
      toast.success(ok === 1 ? "Document uploaded." : `${ok} documents uploaded.`);
      setLabel("");
      router.refresh();
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-dashed bg-surface/50 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="doc-kind" className="text-[13px] font-medium">
              Type
            </label>
            <Select value={kind} onValueChange={(v) => setKind(v as IdTypeValue)}>
              <SelectTrigger id="doc-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ID_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ID_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="doc-label" className="text-[13px] font-medium">
              Label <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input id="doc-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Passport — front page" maxLength={80} />
          </div>
          <div>
            <input ref={input} id="doc-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
            <Button onClick={() => input.current?.click()} disabled={busy} className="w-full sm:w-auto">
              <Upload className="size-4" aria-hidden /> {busy ? "Uploading…" : "Upload files"}
            </Button>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Lock className="size-3" aria-hidden /> PDF, JPG, PNG or WebP up to 8 MB. Stored privately; only your agency can open them, and every view is logged.
        </p>
      </div>

      {documents.length ? (
        <ul className="divide-y rounded-xl border bg-card">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{d.label ?? d.fileName}</p>
                <p className="text-[12.5px] text-muted-foreground">
                  {ID_TYPE_LABEL[d.kind as IdTypeValue]} · {(d.sizeBytes / 1024).toFixed(0)} KB · {fmtDateTime(d.createdAt)}
                </p>
              </div>
              <Button asChild variant="ghost" size="icon-sm">
                <a href={`/api/guest-documents/${d.id}?inline=1`} target="_blank" rel="noreferrer" aria-label={`View ${d.fileName}`}>
                  <Eye className="size-4" />
                </a>
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${d.fileName}`}>
                    <Trash2 className="size-4" />
                  </Button>
                }
                title="Delete this document?"
                description="The file is permanently removed from storage."
                confirmLabel="Delete"
                destructive
                onConfirm={() => remove.run(d.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<FileText />} title="No documents on file" description="Upload passports, Aadhaar or other IDs needed for hotel check-in and permits." />
      )}
    </div>
  );
}

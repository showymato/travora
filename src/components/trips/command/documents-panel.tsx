"use client";

import { useState } from "react";
import { Download, Eye, EyeOff, FileText, Loader2, Mail, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { Document } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/states";
import { Pill } from "@/components/app/badges";
import { fmtDateTime } from "@/lib/dates";
import { DOCUMENT_KINDS, DOCUMENT_KIND_HINT, DOCUMENT_KIND_LABEL, type DocumentKindValue } from "@/lib/labels";
import { useAction } from "@/lib/use-action";
import { deleteDocumentAction, generateDocumentAction, sendDocumentAction, setDocumentVisibilityAction } from "@/server/actions/trips";

type Stay = { id: string; name: string };

export function DocumentsPanel({ tripId, documents, stays, canSend, hasPayments, hasTransport }: { tripId: string; documents: Document[]; stays: Stay[]; canSend: boolean; hasPayments: boolean; hasTransport: boolean }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const gen = useAction((kind: string, subject?: string) => generateDocumentAction(tripId, kind, subject ?? null), {
    success: (d) => `${d.title} is ready.`,
    onSuccess: (d) => window.open(`/api/documents/${d.id}?inline=1`, "_blank", "noopener"),
  });
  const send = useAction(sendDocumentAction, { success: (s) => (s === "LOGGED" ? "Email recorded (development mode — not delivered)." : "Guest notified by email.") });
  const visibility = useAction(setDocumentVisibilityAction);
  const remove = useAction(deleteDocumentAction);

  const run = async (key: string, kind: string, subject?: string) => {
    setGenerating(key);
    await gen.run(kind, subject);
    setGenerating(null);
  };

  const available = (k: DocumentKindValue) => (k === "PAYMENT_RECEIPT" ? hasPayments : k === "TRANSPORT_VOUCHER" ? hasTransport : k === "HOTEL_VOUCHER" ? stays.length > 0 : true);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-[13.5px] font-semibold">Generate</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {DOCUMENT_KINDS.map((k) =>
            k === "HOTEL_VOUCHER" && stays.length > 1 ? (
              <DropdownMenu key={k}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-foreground/20 disabled:opacity-50" disabled={generating !== null}>
                    <GenIcon busy={generating === k} />
                    <GenText k={k} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">Voucher for…</DropdownMenuLabel>
                  {stays.map((s) => (
                    <DropdownMenuItem key={s.id} onSelect={() => run(k, k, s.id)}>
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                key={k}
                onClick={() => run(k, k, k === "HOTEL_VOUCHER" ? stays[0]?.id : undefined)}
                disabled={generating !== null || !available(k)}
                title={!available(k) ? (k === "PAYMENT_RECEIPT" ? "Record a payment first" : k === "TRANSPORT_VOUCHER" ? "Add transport first" : "Add a hotel first") : undefined}
                className="flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-foreground/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GenIcon busy={generating === k} />
                <GenText k={k} />
              </button>
            ),
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[13.5px] font-semibold">Documents ({documents.length})</h3>
        {documents.length ? (
          <ul className="divide-y rounded-xl border bg-card">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground" aria-hidden>
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{d.title}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {fmtDateTime(d.createdAt)} · {(d.sizeBytes / 1024).toFixed(0)} KB{d.sentAt ? ` · emailed ${fmtDateTime(d.sentAt)}` : ""}
                  </p>
                </div>
                {d.visibleToGuest ? <Pill tone="teal">Guest can see</Pill> : <Pill>Internal</Pill>}
                <div className="flex items-center">
                  <Button asChild variant="ghost" size="icon-sm">
                    <a href={`/api/documents/${d.id}?inline=1`} target="_blank" rel="noreferrer" aria-label={`Preview ${d.title}`}>
                      <Eye className="size-4" />
                    </a>
                  </Button>
                  <Button asChild variant="ghost" size="icon-sm">
                    <a href={`/api/documents/${d.id}`} aria-label={`Download ${d.title}`}>
                      <Download className="size-4" />
                    </a>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${d.title}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem disabled={!canSend || !d.visibleToGuest || send.pending} onSelect={() => send.run(d.id)}>
                        <Mail aria-hidden /> Email guest
                      </DropdownMenuItem>
                      {d.kind !== "GUEST_SUMMARY" ? (
                        <DropdownMenuItem onSelect={() => visibility.run(d.id, !d.visibleToGuest)}>
                          {d.visibleToGuest ? <EyeOff aria-hidden /> : <Eye aria-hidden />} {d.visibleToGuest ? "Hide from guest" : "Show to guest"}
                        </DropdownMenuItem>
                      ) : null}
                      {!canSend ? <DropdownMenuLabel className="text-[11.5px] font-normal text-muted-foreground">Send the trip first to email documents.</DropdownMenuLabel> : null}
                      <DropdownMenuSeparator />
                      <ConfirmDialog
                        trigger={
                          <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                            <Trash2 aria-hidden /> Delete
                          </DropdownMenuItem>
                        }
                        title={`Delete ${d.title}?`}
                        description="The file is removed. The guest can no longer open it."
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() => remove.run(d.id)}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={<FileText />} title="No documents yet" description="Generate an itinerary, vouchers or an invoice above. Documents use your agency's branding and the trip's current details." />
        )}
      </div>
    </div>
  );
}

function GenIcon({ busy }: { busy: boolean }) {
  return <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-surface text-muted-foreground">{busy ? <Loader2 className="size-3.5 animate-spin" aria-label="Generating" /> : <Plus className="size-3.5" aria-hidden />}</span>;
}

function GenText({ k }: { k: DocumentKindValue }) {
  return (
    <span className="min-w-0">
      <span className="block text-[13.5px] font-medium">{DOCUMENT_KIND_LABEL[k]}</span>
      <span className="block text-[12px] text-muted-foreground">{DOCUMENT_KIND_HINT[k]}</span>
    </span>
  );
}

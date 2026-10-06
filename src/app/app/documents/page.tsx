import type { Metadata } from "next";
import Link from "next/link";
import { Download, Eye, FileText } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { listAgencyDocuments } from "@/server/documents/service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page";
import { Pill } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/app/list-controls";
import { fmtDateTime } from "@/lib/dates";
import { DOCUMENT_KINDS, DOCUMENT_KIND_LABEL, type DocumentKindValue } from "@/lib/labels";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: PageProps<"/app/documents">) {
  const actor = await requireAgentPage();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const data = await listAgencyDocuments(actor, { q: str("q"), kind: str("kind"), page: Number(str("page")) || 1 });
  return (
    <>
      <PageHeader title="Documents" description="Itineraries, vouchers, invoices and receipts generated across your trips. Generate new ones from a trip's Documents tab." />
      <div className="rounded-xl border bg-card">
        <FilterBar>
          <FilterSelect param="kind" placeholder="All types" options={DOCUMENT_KINDS.map((k) => ({ value: k, label: DOCUMENT_KIND_LABEL[k] }))} />
          <SearchInput placeholder="Search title, trip ID or guest…" className="sm:ml-auto" />
        </FilterBar>
        {data.rows.length ? (
          <>
            <ul className="divide-y">
              {data.rows.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground" aria-hidden>
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{d.title}</p>
                    <p className="truncate text-[12.5px] text-muted-foreground">
                      {DOCUMENT_KIND_LABEL[d.kind as DocumentKindValue]} ·{" "}
                      <Link href={`/app/trips/${d.trip.id}?tab=documents`} className="hover:underline">
                        {d.trip.code}
                      </Link>{" "}
                      · {d.trip.primaryGuest?.fullName ?? "—"} · {fmtDateTime(d.createdAt)}
                    </p>
                  </div>
                  {d.visibleToGuest ? <Pill tone="teal">Guest can see</Pill> : <Pill>Internal</Pill>}
                  <div className="flex">
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
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} />
          </>
        ) : (
          <EmptyState icon={<FileText />} title="No documents yet" description="Open a trip and use its Documents tab to generate an itinerary, vouchers or an invoice." />
        )}
      </div>
    </>
  );
}

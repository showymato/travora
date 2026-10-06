import type { Metadata } from "next";
import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";
import { requireAdminPage } from "@/server/auth/context";
import { listTemplatesAdmin } from "@/server/templates";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page";
import { Pill } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { fmtDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const actor = await requireAdminPage();
  const templates = await listTemplatesAdmin(actor);
  return (
    <>
      <PageHeader
        title="Itinerary templates"
        description="Proven day-by-day plans every agency can start from. Agents can edit everything after applying one."
        actions={
          <Button asChild>
            <Link href="/admin/templates/new">
              <Plus className="size-4" aria-hidden /> New template
            </Link>
          </Button>
        }
      />
      {templates.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/templates/${t.id}`} className="block h-full rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold">{t.name}</p>
                  <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[12px] font-medium text-secondary-foreground tabular">
                    {t.nights}N / {t.nights + 1}D
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{t.description ?? t.destination}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <span>{t.destination}</span>·<span>{t.days.reduce((s, d) => s + d._count.items, 0)} items</span>·<span>Updated {fmtDate(t.updatedAt)}</span>
                  {t.status === "INACTIVE" ? <Pill>Hidden</Pill> : null}
                </div>
                {t.tags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.tags.map((g) => (
                      <span key={g} className="rounded-full border px-2 py-0.5 text-[11.5px]">
                        {g}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={<LayoutTemplate />} title="No templates yet" description="Create Kashmir 6N/7D, Honeymoon, Family… so agents can build itineraries in one click." />
        </div>
      )}
    </>
  );
}

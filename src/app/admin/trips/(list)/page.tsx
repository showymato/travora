import type { Metadata } from "next";
import Link from "next/link";
import { Map } from "lucide-react";
import { requireAdminPage } from "@/server/auth/context";
import { listAllTrips } from "@/server/reports";
import { tripTitle } from "@/server/trips/core";
import { db } from "@/server/db";
import { PageHeader } from "@/components/app/page";
import { TripStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/app/list-controls";
import { fmtRange } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { TRIP_STATUSES, TRIP_STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Trips" };

export default async function AdminTrips({ searchParams }: PageProps<"/admin/trips">) {
  const actor = await requireAdminPage();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [data, agencies] = await Promise.all([
    listAllTrips(actor, { q: str("q"), status: str("status"), agencyId: str("agency"), page: Number(str("page")) || 1 }),
    db.agency.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Trips" description="Every trip across every agency. Agents manage trips in their own workspace; this view is read-only." />
      <div className="rounded-xl border bg-card">
        <FilterBar>
          <FilterSelect param="agency" placeholder="All agencies" options={agencies.map((a) => ({ value: a.id, label: a.name }))} />
          <FilterSelect param="status" placeholder="Any status" options={TRIP_STATUSES.map((s) => ({ value: s, label: TRIP_STATUS_LABEL[s] }))} />
          <SearchInput placeholder="Trip ID, guest or destination…" className="sm:ml-auto" />
        </FilterBar>
        {data.rows.length ? (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b text-left text-[12px] text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">Trip</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Agency</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">Destination</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Dates</th>
                    <th scope="col" className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Value</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((t) => (
                    <tr key={t.id} className="relative border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link href={`/admin/trips/${t.id}`} className="after:absolute after:inset-0">
                          <span className="block font-medium">{t.primaryGuest?.fullName ?? "—"}</span>
                          <span className="font-mono text-[11.5px] text-muted-foreground">{t.code}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">{t.agency.name}</td>
                      <td className="hidden max-w-[220px] truncate px-3 py-3 text-muted-foreground lg:table-cell">{tripTitle(t)}</td>
                      <td className="px-3 py-3 whitespace-nowrap tabular">{fmtRange(t.startDate, t.endDate)}</td>
                      <td className="hidden px-3 py-3 text-right tabular md:table-cell">{formatINR(t.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <TripStatusBadge status={t.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} />
          </>
        ) : (
          <EmptyState icon={<Map />} title="No trips match" />
        )}
      </div>
    </>
  );
}

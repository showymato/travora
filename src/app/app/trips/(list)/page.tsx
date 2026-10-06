import type { Metadata } from "next";
import Link from "next/link";
import { Map, Plus } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { listTrips, tripCounts } from "@/server/trips/queries";
import { tripTitle } from "@/server/trips/core";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page";
import { TripStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { Initials } from "@/components/app/visuals";
import { FilterBar, FilterSelect, Pagination, SearchInput, SegmentedFilter } from "@/components/app/list-controls";
import { fmtRange, fmtRelative, nightsBetween, toISO } from "@/lib/dates";
import { TRIP_STATUSES, TRIP_STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Trips" };

const WHEN = ["upcoming", "ongoing", "past", "drafts"] as const;

export default async function TripsPage({ searchParams }: PageProps<"/app/trips">) {
  const actor = await requireAgentPage();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const when = (WHEN as readonly string[]).includes(str("when")) ? (str("when") as (typeof WHEN)[number]) : "";
  const [data, counts] = await Promise.all([
    listTrips(actor, { q: str("q"), status: str("status"), when, page: Number(str("page")) || 1 }),
    tripCounts(actor),
  ]);
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
  const filtered = Boolean(str("q") || str("status") || when);

  return (
    <>
      <PageHeader
        title="Trips"
        description="Every journey your agency is planning, running or has delivered."
        actions={
          <Button asChild>
            <Link href="/app/trips/new">
              <Plus className="size-4" aria-hidden /> New trip
            </Link>
          </Button>
        }
      />
      <div className="rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <FilterBar>
          <SegmentedFilter
            param="when"
            options={[
              { value: "", label: "All", count: total },
              { value: "upcoming", label: "Upcoming" },
              { value: "ongoing", label: "Travelling" },
              { value: "drafts", label: "Drafts", count: counts.DRAFT ?? 0 },
              { value: "past", label: "Past" },
            ]}
          />
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
            <FilterSelect param="status" placeholder="Any status" options={TRIP_STATUSES.map((s) => ({ value: s, label: TRIP_STATUS_LABEL[s] }))} />
            <SearchInput placeholder="Search trip ID, guest, phone, place…" />
          </div>
        </FilterBar>

        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState icon={<Map />} title="No trips match" description="Try a different search or clear the filters." />
          ) : (
            <EmptyState
              icon={<Map />}
              title="No trips yet"
              description="Create your first trip and start planning your customer's journey."
              action={
                <Button asChild>
                  <Link href="/app/trips/new">
                    <Plus className="size-4" aria-hidden /> Create trip
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b text-left text-[12px] text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">Guest</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Trip</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Dates</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium xl:table-cell">Travellers</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                    <th scope="col" className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((t) => {
                    const href = t.status === "DRAFT" ? `/app/trips/${t.id}/plan` : `/app/trips/${t.id}`;
                    const n = nightsBetween(toISO(t.startDate), toISO(t.endDate));
                    return (
                      <tr key={t.id} className="group relative border-b transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <Link href={href} className="flex items-center gap-3 after:absolute after:inset-0">
                            <Initials name={t.primaryGuest?.fullName ?? "?"} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{t.primaryGuest?.fullName ?? "No guest"}</span>
                              <span className="block truncate text-[12.5px] text-muted-foreground">{t.primaryGuest?.phone ?? "—"}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="max-w-[280px] px-3 py-3">
                          <span className="block truncate">{tripTitle(t)}</span>
                          <span className="font-mono text-[11.5px] text-muted-foreground">{t.code}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap tabular">
                          {fmtRange(t.startDate, t.endDate)}
                          {n ? <span className="block text-[12px] text-muted-foreground">{n}N / {n + 1}D</span> : null}
                        </td>
                        <td className="hidden px-3 py-3 whitespace-nowrap text-muted-foreground xl:table-cell">
                          {t.adults} adult{t.adults === 1 ? "" : "s"}
                          {t.children ? `, ${t.children} child${t.children === 1 ? "" : "ren"}` : ""}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <TripStatusBadge status={t.status} />
                            {t.status === "DRAFT" ? <span className="text-[11.5px] text-muted-foreground">Step {t.wizardStep} of 10</span> : null}
                            {t.hasUnpublishedChanges ? <span className="text-[11.5px] text-warn">Unpublished edits</span> : null}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-right text-[12.5px] whitespace-nowrap text-muted-foreground lg:table-cell">{fmtRelative(t.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y md:hidden">
              {data.rows.map((t) => (
                <li key={t.id}>
                  <Link href={t.status === "DRAFT" ? `/app/trips/${t.id}/plan` : `/app/trips/${t.id}`} className="block px-4 py-3.5 active:bg-muted/60">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{t.primaryGuest?.fullName ?? "No guest"}</span>
                      <TripStatusBadge status={t.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{tripTitle(t)}</p>
                    <p className="mt-1 flex justify-between text-[12.5px] text-muted-foreground tabular">
                      <span>{fmtRange(t.startDate, t.endDate)}</span>
                      <span className="font-mono">{t.code}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} />
          </>
        )}
      </div>
    </>
  );
}

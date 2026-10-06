import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { listGuests } from "@/server/guests";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page";
import { EmptyState } from "@/components/app/states";
import { Initials } from "@/components/app/visuals";
import { FilterBar, FilterSelect, Pagination, SearchInput, SegmentedFilter } from "@/components/app/list-controls";
import { fmtDate, fmtShort } from "@/lib/dates";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage({ searchParams }: PageProps<"/app/guests">) {
  const actor = await requireAgentPage();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filter = (["upcoming", "past", "none"].includes(str("filter")) ? str("filter") : "all") as "all" | "upcoming" | "past" | "none";
  const sort = (["name", "trips"].includes(str("sort")) ? str("sort") : "created") as "name" | "trips" | "created";
  const data = await listGuests(actor, { q: str("q"), filter, sort, page: Number(str("page")) || 1 });

  return (
    <>
      <PageHeader
        title="Guests"
        description="Every traveller you've looked after. History builds automatically from their trips."
        actions={
          <Button asChild>
            <Link href="/app/guests/new">
              <UserPlus className="size-4" aria-hidden /> New guest
            </Link>
          </Button>
        }
      />
      <div className="rounded-xl border bg-card">
        <FilterBar>
          <SegmentedFilter
            param="filter"
            options={[
              { value: "", label: "All" },
              { value: "upcoming", label: "Upcoming trip" },
              { value: "past", label: "Travelled" },
              { value: "none", label: "No trips" },
            ]}
          />
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
            <FilterSelect
              param="sort"
              placeholder="Newest first"
              options={[
                { value: "name", label: "Name A–Z" },
                { value: "trips", label: "Most trips" },
              ]}
            />
            <SearchInput placeholder="Search name, phone, email…" />
          </div>
        </FilterBar>
        {data.rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={str("q") || filter !== "all" ? "No guests match" : "No guests yet"}
            description={str("q") || filter !== "all" ? "Try a different search or filter." : "Add guests as enquiries come in — their trips, documents and payments collect here."}
            action={
              !str("q") && filter === "all" ? (
                <Button asChild>
                  <Link href="/app/guests/new">
                    <UserPlus className="size-4" aria-hidden /> Add guest
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b text-left text-[12px] text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Phone</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">Email</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Trips</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Last trip</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Upcoming</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((g) => (
                    <tr key={g.id} className="relative border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link href={`/app/guests/${g.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                          <Initials name={g.fullName} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{g.fullName}</span>
                            <span className="block truncate text-[12.5px] text-muted-foreground md:hidden">{g.phone ?? g.email ?? "—"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-3 py-3 whitespace-nowrap md:table-cell">{g.phone ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="hidden max-w-[220px] truncate px-3 py-3 lg:table-cell">{g.email ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-3 text-right tabular">{g.tripCount}</td>
                      <td className="hidden px-3 py-3 whitespace-nowrap text-muted-foreground sm:table-cell">{g.last?.startDate ? fmtDate(g.last.startDate) : "—"}</td>
                      <td className="hidden px-4 py-3 whitespace-nowrap sm:table-cell">{g.upcoming?.startDate ? <span className="text-teal">{fmtShort(g.upcoming.startDate)} · {g.upcoming.code}</span> : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} />
          </>
        )}
      </div>
    </>
  );
}

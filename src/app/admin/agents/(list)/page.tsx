import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Building2, Plus } from "lucide-react";
import type { AgencyStatus, PlanCode } from "@prisma/client";
import { requireAdminPage } from "@/server/auth/context";
import { listAgencies } from "@/server/agencies";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page";
import { AgencyStatusBadge, PlanBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { Initials } from "@/components/app/visuals";
import { FilterBar, FilterSelect, Pagination, SearchInput, SegmentedFilter } from "@/components/app/list-controls";
import { AgencyActions } from "@/components/admin/agency-actions";
import { fmtDate } from "@/lib/dates";
import { PLAN_CODES } from "@/lib/labels";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage({ searchParams }: PageProps<"/admin/agents">) {
  const actor = await requireAdminPage();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = (["ACTIVE", "TRIAL", "SUSPENDED"].includes(str("status")) ? str("status") : "") as AgencyStatus | "";
  const plan = ((PLAN_CODES as readonly string[]).includes(str("plan")) ? str("plan") : "") as PlanCode | "";
  const sort = (["name", "trips"].includes(str("sort")) ? str("sort") : "created") as "name" | "trips" | "created";
  const dir = str("dir") === "asc" ? "asc" : str("dir") === "desc" ? "desc" : undefined;
  const data = await listAgencies(actor, { q: str("q"), status, plan, sort, dir, page: Number(str("page")) || 1 });

  const sortHref = (key: "name" | "trips" | "created") => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    const currentDir = dir ?? (sort === "name" ? "asc" : "desc");
    next.set("sort", key);
    next.set("dir", sort === key && currentDir === "desc" ? "asc" : sort === key ? "desc" : key === "name" ? "asc" : "desc");
    next.delete("page");
    return `/admin/agents?${next.toString()}`;
  };
  const sortTh = (k: "name" | "trips" | "created", children: React.ReactNode, className?: string) => {
    const active = sort === k;
    const d = dir ?? (k === "name" ? "asc" : "desc");
    return (
      <th scope="col" className={className} aria-sort={active ? (d === "asc" ? "ascending" : "descending") : "none"}>
        <Link href={sortHref(k)} className="inline-flex items-center gap-1 font-medium hover:text-foreground">
          {children}
          {active ? d === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : null}
        </Link>
      </th>
    );
  };

  return (
    <>
      <PageHeader
        title="Agents"
        description="Travel agencies on TRAVORA. Each has an isolated workspace."
        actions={
          <Button asChild>
            <Link href="/admin/agents/new">
              <Plus className="size-4" aria-hidden /> New agency
            </Link>
          </Button>
        }
      />
      <div className="rounded-xl border bg-card">
        <FilterBar>
          <SegmentedFilter
            param="status"
            options={[
              { value: "", label: "All" },
              { value: "ACTIVE", label: "Active" },
              { value: "TRIAL", label: "Trial" },
              { value: "SUSPENDED", label: "Suspended" },
            ]}
          />
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
            <FilterSelect param="plan" placeholder="Any plan" options={PLAN_CODES.map((p) => ({ value: p, label: p[0] + p.slice(1).toLowerCase() }))} />
            <SearchInput placeholder="Agency, owner, email, phone…" />
          </div>
        </FilterBar>
        {data.rows.length ? (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b text-left text-[12px] text-muted-foreground">
                    {sortTh("name", "Agency", "px-4 py-2.5")}
                    <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">Owner</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium xl:table-cell">Email</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium xl:table-cell">Phone</th>
                    {sortTh("trips", "Trips", "px-3 py-2.5 text-right")}
                    <th scope="col" className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Guests</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Plan</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                    {sortTh("created", "Created", "hidden px-3 py-2.5 md:table-cell")}
                    <th scope="col" className="px-3 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link href={`/admin/agents/${a.id}`} className="flex items-center gap-3 hover:underline">
                          <Initials name={a.name} className="rounded-lg" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{a.name}</span>
                            <span className="block truncate text-[12px] text-muted-foreground">{[a.city, a.state].filter(Boolean).join(", ") || "—"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-3 py-3 lg:table-cell">{a.ownerName}</td>
                      <td className="hidden max-w-[200px] truncate px-3 py-3 xl:table-cell">{a.email}</td>
                      <td className="hidden px-3 py-3 whitespace-nowrap xl:table-cell">{a.phone}</td>
                      <td className="px-3 py-3 text-right tabular">{a._count.trips}</td>
                      <td className="hidden px-3 py-3 text-right tabular md:table-cell">{a._count.guests}</td>
                      <td className="hidden px-3 py-3 sm:table-cell">{a.subscription ? <PlanBadge name={a.subscription.plan.name} /> : "—"}</td>
                      <td className="px-3 py-3">
                        <AgencyStatusBadge status={a.status} />
                      </td>
                      <td className="hidden px-3 py-3 whitespace-nowrap text-muted-foreground md:table-cell">{fmtDate(a.createdAt)}</td>
                      <td className="px-3 py-3 text-right">
                        <AgencyActions agencyId={a.id} name={a.name} status={a.status} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} />
          </>
        ) : (
          <EmptyState
            icon={<Building2 />}
            title={str("q") || status || plan ? "No agencies match" : "No agencies yet"}
            description={str("q") || status || plan ? "Try a different search or filter." : "Create the first agency workspace."}
            action={<Button asChild><Link href="/admin/agents/new"><Plus className="size-4" aria-hidden /> New agency</Link></Button>}
          />
        )}
      </div>
    </>
  );
}

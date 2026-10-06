import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requireAdminPage } from "@/server/auth/context";
import { auditFeed } from "@/server/reports";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { DetailList, PageHeader, Panel } from "@/components/app/page";
import { FilterSelect, Pagination } from "@/components/app/list-controls";
import { fmtDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Settings" };

const ENTITIES = ["Agency", "User", "Hotel", "HotelRoom", "Trip", "Guest", "ItineraryTemplate"];

export default async function AdminSettings({ searchParams }: PageProps<"/admin/settings">) {
  const actor = await requireAdminPage();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [log, agencies] = await Promise.all([
    auditFeed(actor, { agencyId: str("agency"), entity: ENTITIES.includes(str("entity")) ? str("entity") : "", page: Number(str("page")) || 1 }),
    db.agency.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const email = process.env.EMAIL_PROVIDER ?? "log";
  const storage = process.env.STORAGE_PROVIDER ?? "local";
  return (
    <>
      <PageHeader title="Settings" description="Your account, platform configuration and the audit log." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Your account">
          <DetailList items={[["Name", actor.name], ["Email", actor.email], ["Role", "Super Admin"]]} />
          <Button asChild variant="outline" className="mt-4">
            <Link href="/account/password">
              <KeyRound className="size-4" aria-hidden /> Change password
            </Link>
          </Button>
        </Panel>
        <Panel title="Platform configuration" description="Set through environment variables; secrets are never shown.">
          <DetailList
            items={[
              ["Email delivery", email === "resend" ? `Resend ${process.env.RESEND_API_KEY ? "(key set)" : "(key missing)"}` : "Logged only (development)"],
              ["File storage", storage === "vercel-blob" ? "Vercel Blob (private)" : "Local disk (development)"],
              ["Payments", "Manual recording (Razorpay planned)"],
              ["App URL", process.env.APP_URL ?? "http://localhost:3000"],
            ]}
          />
        </Panel>
      </div>
      <section className="mt-5 rounded-xl border bg-card" aria-labelledby="audit-h">
        <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center">
          <h2 id="audit-h" className="text-[15px] font-semibold">
            Audit log
          </h2>
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
            <FilterSelect param="agency" placeholder="All agencies" options={agencies.map((a) => ({ value: a.id, label: a.name }))} />
            <FilterSelect param="entity" placeholder="All entities" options={ENTITIES.map((e) => ({ value: e, label: e }))} />
          </div>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[12px] text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">When</th>
                <th scope="col" className="px-3 py-2 font-medium">User</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Agency</th>
                <th scope="col" className="px-3 py-2 font-medium">Action</th>
                <th scope="col" className="hidden px-4 py-2 font-medium lg:table-cell">Entity</th>
              </tr>
            </thead>
            <tbody>
              {log.rows.map((l) => (
                <tr key={l.id} className="border-b align-top last:border-0">
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{l.userName ?? "System"}</td>
                  <td className="hidden px-3 py-2.5 md:table-cell">{l.agency?.name ?? "Platform"}</td>
                  <td className="px-3 py-2.5">
                    <span className="block">{l.summary ?? l.action}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{l.action}</span>
                    {l.before || l.after ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11.5px] text-muted-foreground">Changes</summary>
                        <pre className="mt-1 max-w-[520px] overflow-x-auto rounded bg-surface p-2 text-[11px] whitespace-pre-wrap">{JSON.stringify({ before: l.before, after: l.after }, null, 1)}</pre>
                      </details>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-2.5 font-mono text-[11.5px] text-muted-foreground lg:table-cell">
                    {l.entity} {l.entityId.slice(-8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={log.page} pages={log.pages} total={log.total} pageSize={log.pageSize} />
      </section>
    </>
  );
}

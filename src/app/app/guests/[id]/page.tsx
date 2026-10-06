import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { getGuestProfile } from "@/server/guests";
import { Button } from "@/components/ui/button";
import { DetailList, Panel } from "@/components/app/page";
import { TripStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { Initials } from "@/components/app/visuals";
import { GuestDocuments } from "@/components/guests/guest-documents";
import { DeleteGuestButton } from "./delete-guest";
import { fmtDate, fmtRange, todayISO, toISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { GENDER_LABEL, ID_TYPE_LABEL, PAYMENT_METHOD_LABEL, type IdTypeValue, type PaymentMethodValue } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Guest" };

const TABS = [
  ["overview", "Overview"],
  ["trips", "Trips"],
  ["documents", "Documents"],
  ["payments", "Payments"],
  ["notes", "Notes"],
] as const;

function maskId(n: string | null) {
  if (!n) return null;
  return n.length <= 4 ? "••••" : `${"•".repeat(Math.min(6, n.length - 4))}${n.slice(-4)}`;
}

export default async function GuestProfile({ params, searchParams }: PageProps<"/app/guests/[id]">) {
  const actor = await requireAgentPage();
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as (typeof TABS)[number][0]) : "overview";
  const g = await getGuestProfile(actor, id);
  const today = todayISO();
  const trips = g.trips.map((t) => t.trip);
  const upcoming = trips.filter((t) => t.startDate && toISO(t.startDate)! >= today && t.status !== "CANCELLED");
  const payments = trips.flatMap((t) => t.payments.map((p) => ({ ...p, trip: t })));
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const wa = (g.whatsapp ?? g.phone)?.replace(/[^\d]/g, "");

  return (
    <>
      <Link href="/app/guests" className="mb-3 inline-flex text-[13px] text-muted-foreground hover:text-foreground">
        ← Guests
      </Link>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          <Initials name={g.fullName} className="size-14 text-[18px]" />
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">{g.fullName}</h1>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
              {g.phone ? (
                <a href={`tel:${g.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Phone className="size-3.5" aria-hidden /> {g.phone}
                </a>
              ) : null}
              {g.email ? (
                <a href={`mailto:${g.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Mail className="size-3.5" aria-hidden /> {g.email}
                </a>
              ) : null}
              {g.address ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden /> {g.address}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {wa ? (
            <Button asChild variant="outline">
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" aria-hidden /> WhatsApp
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={`/app/guests/${g.id}/edit`}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/app/trips/new?guest=${g.id}`}>
              <Plus className="size-4" aria-hidden /> New trip
            </Link>
          </Button>
        </div>
      </header>

      <nav aria-label="Guest sections" className="scrollbar-none mt-6 mb-6 overflow-x-auto border-b">
        <ul className="flex min-w-max gap-1">
          {TABS.map(([k, label]) => (
            <li key={k}>
              <Link
                href={k === "overview" ? `/app/guests/${g.id}` : `/app/guests/${g.id}?tab=${k}`}
                scroll={false}
                aria-current={tab === k ? "page" : undefined}
                className={cn("relative flex h-10 items-center px-3 text-[13.5px] font-medium", tab === k ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
                {k === "trips" && trips.length ? <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{trips.length}</span> : null}
                {k === "documents" && g.documents.length ? <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{g.documents.length}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title="Details">
            <DetailList
              items={[
                ["Phone", g.phone],
                ["WhatsApp", g.whatsapp],
                ["Email", g.email],
                ["Nationality", g.nationality],
                ["Date of birth", g.dateOfBirth ? fmtDate(g.dateOfBirth) : null],
                ["Gender", g.gender ? GENDER_LABEL[g.gender] : null],
                ["ID", g.idType ? `${ID_TYPE_LABEL[g.idType as IdTypeValue]} ${maskId(g.idNumber) ?? ""}` : null],
                ["Guest since", fmtDate(g.createdAt)],
              ]}
            />
          </Panel>
          <div className="space-y-5">
            <Panel title="At a glance">
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-[12px] text-muted-foreground">Trips</dt>
                  <dd className="text-[22px] font-semibold tabular">{trips.length}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted-foreground">Upcoming</dt>
                  <dd className="text-[22px] font-semibold tabular">{upcoming.length}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted-foreground">Paid</dt>
                  <dd className="text-[16px] leading-[33px] font-semibold tabular">{formatINR(paid)}</dd>
                </div>
              </dl>
              {upcoming[0] ? (
                <Link href={`/app/trips/${upcoming[0].id}`} className="mt-4 block rounded-lg border bg-teal-soft/50 px-3 py-2.5 text-[13.5px] hover:border-teal/40">
                  <span className="font-medium">Next trip:</span> {fmtRange(upcoming[0].startDate, upcoming[0].endDate)} · {upcoming[0].destinations.map((d) => d.name).join(", ") || upcoming[0].code}
                </Link>
              ) : null}
            </Panel>
            {g.notes ? (
              <Panel title="Notes">
                <p className="text-[14px] whitespace-pre-line">{g.notes}</p>
              </Panel>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "trips" ? (
        trips.length ? (
          <ul className="divide-y rounded-xl border bg-card">
            {trips.map((t) => (
              <li key={t.id}>
                <Link href={`/app/trips/${t.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-muted/40">
                  <span className="font-mono text-[12.5px] text-muted-foreground">{t.code}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.title ?? (t.destinations.map((d) => d.name).join(" · ") || "Untitled trip")}</span>
                  <span className="text-[13px] text-muted-foreground tabular">{fmtRange(t.startDate, t.endDate)}</span>
                  <TripStatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No trips yet" description="Start planning this guest's first journey." action={<Button asChild><Link href={`/app/trips/new?guest=${g.id}`}><Plus className="size-4" aria-hidden /> New trip</Link></Button>} />
        )
      ) : null}

      {tab === "documents" ? <GuestDocuments guestId={g.id} documents={g.documents} /> : null}

      {tab === "payments" ? (
        payments.length ? (
          <div className="relative overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b text-left text-[12px] text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Trip</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Method</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(p.paidAt)}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/app/trips/${p.trip.id}?tab=payments`} className="font-mono text-[12.5px] hover:underline">
                        {p.trip.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">{PAYMENT_METHOD_LABEL[p.method as PaymentMethodValue]}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular">{formatINR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No payments yet" description="Payments recorded on this guest's trips appear here." />
        )
      ) : null}

      {tab === "notes" ? (
        <Panel title="Notes" actions={<Button asChild variant="ghost" size="sm"><Link href={`/app/guests/${g.id}/edit`}>Edit</Link></Button>}>
          <p className="text-[14px] whitespace-pre-line">{g.notes ?? <span className="text-muted-foreground">No notes yet. Add preferences, dietary needs or special occasions.</span>}</p>
        </Panel>
      ) : null}

      {tab === "overview" && trips.length === 0 ? (
        <div className="mt-8 border-t pt-6">
          <DeleteGuestButton guestId={g.id} name={g.fullName} />
        </div>
      ) : null}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BedDouble, CalendarDays, Car, FileText, Mail, MapPin, Mountain, Phone, Plus, Star, Users } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { getTrip, tripActivityLog } from "@/server/trips/queries";
import { listAgentHotels } from "@/server/hotels";
import { listTemplatesForAgent } from "@/server/templates";
import { guestTripUrl } from "@/server/trips/publish";
import { tripTitle } from "@/server/trips/core";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app/page";
import { TripStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { Initials } from "@/components/app/visuals";
import { TripHeaderActions } from "@/components/trips/command/header-actions";
import { ActivityFeed, Checklist, NowPanel, PaymentSummary, StaysMini, tripChecklist } from "@/components/trips/command/overview";
import { TabsNav, TRIP_TABS, type TripTab } from "@/components/trips/command/tabs-nav";
import { PaymentsList, RecordPaymentDialog } from "@/components/trips/command/payments-panel";
import { DocumentsPanel } from "@/components/trips/command/documents-panel";
import { NotesPanel } from "@/components/trips/command/notes-panel";
import { ItineraryBuilder } from "@/components/trips/itinerary-builder";
import { ItineraryActions } from "@/components/trips/itinerary-actions";
import { StayCard } from "@/components/trips/stay-editor";
import { ActivityCard, TransportCard } from "@/components/trips/line-cards";
import { ActivityDialog, TransportDialog } from "@/components/trips/line-forms";
import { fmtDateTime, fmtRange, fmtRelative, nightsBetween, toISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { ID_TYPE_LABEL, type IdTypeValue } from "@/lib/labels";
import { blankActivity, blankTransport, builderKey, stepHref, travellerSummary } from "@/lib/plan";

export async function generateMetadata({ params }: PageProps<"/app/trips/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Trip ${id.slice(-6)}` };
}

export default async function TripCommandCenter({ params, searchParams }: PageProps<"/app/trips/[id]">) {
  const actor = await requireAgentPage();
  const { id } = await params;
  const sp = await searchParams;
  const tab: TripTab = TRIP_TABS.some(([k]) => k === sp.tab) ? (sp.tab as TripTab) : "overview";
  const { trip, lines, total, payment, computed, overridden } = await getTrip(actor, id);
  const start = toISO(trip.startDate);
  const end = toISO(trip.endDate);
  const range = { min: start ?? "", max: end ?? "" };
  const nights = nightsBetween(start, end);
  const shareUrl = trip.shareToken && trip.shareEnabled && trip.publishedVersion ? guestTripUrl(trip.shareToken) : null;
  const base = `/app/trips/${trip.id}`;
  const money = { ...payment, total };
  const counts = {
    itinerary: trip.days.reduce((s, d) => s + d.items.length, 0),
    hotels: trip.hotels.length,
    transport: trip.transports.length,
    guests: trip.guests.length,
    documents: trip.documents.length,
    payments: trip.payments.filter((p) => !p.voidedAt).length,
  };

  return (
    <div className="animate-fade-in">
      <Link href="/app/trips" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        ← Trips
      </Link>
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[13px] text-muted-foreground">{trip.code}</span>
            <TripStatusBadge status={trip.status} />
            {trip.hasUnpublishedChanges ? (
              <span className="inline-flex items-center gap-1 text-[12.5px] text-warn">
                <AlertTriangle className="size-3.5" aria-hidden /> Unpublished changes
              </span>
            ) : null}
          </div>
          <h1 className="mt-1.5 text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">{trip.primaryGuest?.fullName ?? "No guest"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden /> {fmtRange(trip.startDate, trip.endDate)}
              {nights ? ` · ${nights}N / ${nights + 1}D` : ""}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {tripTitle(trip)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden /> {travellerSummary(trip.adults, trip.children, trip.infants)}
            </span>
          </p>
        </div>
        <TripHeaderActions
          tripId={trip.id}
          status={trip.status}
          guestName={trip.primaryGuest?.fullName ?? null}
          guestEmail={trip.primaryGuest?.email ?? null}
          shareUrl={shareUrl}
          published={trip.publishedVersion}
          unpublished={trip.hasUnpublishedChanges}
        />
      </header>

      {trip.hasUnpublishedChanges && trip.publishedVersion ? (
        <div className="mt-5 flex flex-col gap-1 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-[13.5px] sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="font-medium">The guest is seeing version {trip.publishedVersion}.</span> Your latest edits are private until you publish an update.
          </span>
        </div>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            [<Users key="g" />, "Guests", trip.adults + trip.children + trip.infants],
            [<BedDouble key="h" />, "Hotels", trip.hotels.length],
            [<Car key="t" />, "Transfers", trip.transports.length],
            [<Mountain key="a" />, "Activities", trip.activities.length],
            [<FileText key="d" />, "Documents", trip.documents.length],
            [null, "Balance", formatINR(payment.pending)],
          ] as const
        ).map(([icon, label, value]) => (
          <div key={label} className="bg-card px-4 py-3">
            <dt className="flex items-center gap-1.5 text-[12px] text-muted-foreground [&_svg]:size-3.5">
              {icon}
              {label}
            </dt>
            <dd className="mt-0.5 text-[18px] font-semibold tabular">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <TabsNav base={base} current={tab} counts={counts} />
        {tab === "overview" ? <Overview /> : null}
        {tab === "itinerary" ? <ItineraryTab /> : null}
        {tab === "hotels" ? <HotelsTab /> : null}
        {tab === "transport" ? <TransportTab /> : null}
        {tab === "guests" ? <GuestsTab /> : null}
        {tab === "documents" ? (
          <DocumentsPanel tripId={trip.id} documents={trip.documents} stays={trip.hotels.map((h) => ({ id: h.id, name: h.hotel.name }))} canSend={Boolean(shareUrl && trip.primaryGuest?.email)} hasPayments={counts.payments > 0} hasTransport={trip.transports.length > 0} />
        ) : null}
        {tab === "payments" ? <PaymentsTab /> : null}
        {tab === "activity" ? <ActivityTab /> : null}
      </div>
    </div>
  );

  async function Overview() {
    const log = await tripActivityLog(actor, trip.id, 8);
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <NowPanel trip={trip} tz={trip.agency.timezone} />
          <Panel
            title="Where they're staying"
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href={`${base}?tab=hotels`}>Manage</Link>
              </Button>
            }
          >
            <StaysMini trip={trip} />
          </Panel>
          <Panel title="Recent activity" actions={<Button asChild variant="ghost" size="sm"><Link href={`${base}?tab=activity`}>All activity</Link></Button>}>
            <ActivityFeed entries={log} />
          </Panel>
        </div>
        <div className="min-w-0 space-y-5">
          <Checklist items={tripChecklist(trip, money)} />
          <Panel title="Payments" actions={<RecordPaymentDialog tripId={trip.id} pending={payment.pending} hasEmail={Boolean(trip.primaryGuest?.email)} trigger={<Button variant="outline" size="sm"><Plus className="size-3.5" aria-hidden /> Record</Button>} />}>
            <PaymentSummary money={money} compact />
          </Panel>
          {trip.notesList.length ? (
            <Panel title="Latest note">
              <p className="text-[13.5px] whitespace-pre-line">{trip.notesList[0].body}</p>
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                {trip.notesList[0].authorName} · {fmtRelative(trip.notesList[0].createdAt)}
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    );
  }

  async function ItineraryTab() {
    const templates = await listTemplatesForAgent(actor);
    const hasItems = trip.days.some((d) => d.items.length);
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-muted-foreground">
            {trip.publishedVersion ? "Edits stay private until you publish an update." : "Every change is saved automatically."} Drag to reorder or move between days.
          </p>
          {start && end ? <ItineraryActions tripId={trip.id} templates={templates} hasItems={hasItems} nights={nights} /> : null}
        </div>
        {trip.activities.length ? (
          <details className="rounded-xl border bg-card px-4 py-3">
            <summary className="cursor-pointer text-[13.5px] font-medium">Booked activities ({trip.activities.length})</summary>
            <ul className="mt-3 space-y-2">
              {trip.activities.map((a) => (
                <ActivityCard key={a.id} a={a} tripId={trip.id} range={range} />
              ))}
            </ul>
          </details>
        ) : null}
        {trip.days.length ? (
          <ItineraryBuilder key={builderKey(trip.days)} tripId={trip.id} days={trip.days} />
        ) : (
          <EmptyState
            title="No itinerary yet"
            description={start ? "Generate a day-by-day plan from the trip details, or start from a template." : "Set the travel dates first."}
            action={!start ? <Button asChild><Link href={stepHref(trip.id, 2)}>Set dates</Link></Button> : undefined}
          />
        )}
        {start ? (
          <ActivityDialog tripId={trip.id} range={range} initial={blankActivity(start)} trigger={<Button variant="outline"><Plus className="size-4" aria-hidden /> Add a booked activity</Button>} />
        ) : null}
      </div>
    );
  }

  async function HotelsTab() {
    const hotels = await listAgentHotels(actor, { includeInactive: true });
    return (
      <div className="space-y-4">
        {trip.hotels.length ? (
          trip.hotels.map((s) => <StayCard key={s.id} stay={s} hotel={hotels.find((h) => h.id === s.hotelId)} range={range} />)
        ) : (
          <EmptyState icon={<BedDouble />} title="No hotels yet" description="Pick from the hotels assigned to your agency." />
        )}
        {start ? (
          <Button asChild variant="outline">
            <Link href={stepHref(trip.id, 4)}>
              <Plus className="size-4" aria-hidden /> Add hotel
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  async function TransportTab() {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          {start ? <TransportDialog tripId={trip.id} range={range} initial={blankTransport(start)} trigger={<Button><Plus className="size-4" aria-hidden /> Add transport</Button>} /> : null}
        </div>
        {trip.transports.length ? (
          <ul className="space-y-2">
            {trip.transports.map((t) => (
              <TransportCard key={t.id} t={t} tripId={trip.id} range={range} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Car />} title="No transport yet" description="Add airport pickups, intercity transfers and local cars. They appear in the itinerary automatically." />
        )}
      </div>
    );
  }

  async function GuestsTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[13.5px] text-muted-foreground">{travellerSummary(trip.adults, trip.children, trip.infants)} · {trip.guests.length} named</p>
          <Button asChild variant="outline">
            <Link href={stepHref(trip.id, 1)}>Edit travellers</Link>
          </Button>
        </div>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {trip.guests.map(({ guest: g, isPrimary }) => (
            <li key={g.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <Initials name={g.fullName} className="size-10 text-[13px]" />
                <div className="min-w-0 flex-1">
                  <Link href={`/app/guests/${g.id}`} className="text-[15px] font-semibold hover:underline">
                    {g.fullName}
                  </Link>
                  {isPrimary ? (
                    <p className="flex items-center gap-1 text-[12px] text-primary">
                      <Star className="size-3 fill-current" aria-hidden /> Primary guest
                    </p>
                  ) : null}
                  <div className="mt-2 space-y-1 text-[13px]">
                    {g.phone ? (
                      <a href={`tel:${g.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:underline">
                        <Phone className="size-3.5 text-muted-foreground" aria-hidden /> {g.phone}
                      </a>
                    ) : (
                      <p className="text-warn">No phone</p>
                    )}
                    {g.email ? (
                      <a href={`mailto:${g.email}`} className="flex items-center gap-1.5 hover:underline">
                        <Mail className="size-3.5 text-muted-foreground" aria-hidden /> {g.email}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">No email</p>
                    )}
                    <p className="text-muted-foreground">{g.idType ? `${ID_TYPE_LABEL[g.idType as IdTypeValue]} on file` : "No ID on file"}</p>
                  </div>
                  {g.notes ? <p className="mt-2 rounded-md bg-surface px-2.5 py-1.5 text-[12.5px]">{g.notes}</p> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  async function PaymentsTab() {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <Panel title="Summary">
            <PaymentSummary money={money} />
            <div className="mt-5">
              <RecordPaymentDialog tripId={trip.id} pending={payment.pending} hasEmail={Boolean(trip.primaryGuest?.email)} />
            </div>
          </Panel>
          <Panel title="Price breakdown" description={overridden ? `Package price set. Itemised total ${formatINR(computed)}.` : "Itemised from hotels, transfers and activities."}>
            <ul className="space-y-1.5 text-[13px]">
              {lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-muted-foreground">{l.label}</span>
                  <span className="shrink-0 tabular">{formatINR(l.amount)}</span>
                </li>
              ))}
              {!lines.length ? <li className="text-muted-foreground">No priced items.</li> : null}
            </ul>
            <Button asChild variant="link" className="mt-2 h-auto px-0">
              <Link href={stepHref(trip.id, 9)}>Adjust package price</Link>
            </Button>
          </Panel>
        </div>
        <Panel title="Payments received">
          <PaymentsList tripId={trip.id} payments={trip.payments} />
          <p className="mt-4 text-[12px] text-muted-foreground">Online payments via Razorpay are planned; until then, record payments manually here.</p>
        </Panel>
      </div>
    );
  }

  async function ActivityTab() {
    const log = await tripActivityLog(actor, trip.id, 80);
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Activity" description="Every change to this trip, newest first.">
          <ActivityFeed entries={log} />
        </Panel>
        <div className="space-y-5">
          <Panel title="Published versions" description="What the guest has seen over time.">
            {trip.versions.length ? (
              <ol className="space-y-3">
                {trip.versions.map((v) => (
                  <li key={v.id} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11.5px] font-semibold text-secondary-foreground">v{v.version}</span>
                    <div>
                      <p className="text-[13.5px]">
                        {v.summary}
                        {v.version === trip.publishedVersion ? <span className="ml-1.5 text-[12px] text-ok">· live</span> : null}
                      </p>
                      <p className="text-[12px] text-muted-foreground">{fmtDateTime(v.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">Not sent to the guest yet.</p>
            )}
          </Panel>
          <Panel title="Internal notes">
            <NotesPanel tripId={trip.id} notes={trip.notesList} />
          </Panel>
        </div>
      </div>
    );
  }
}

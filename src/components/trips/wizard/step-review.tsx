"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Mail, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TripStatusBadge } from "@/components/app/badges";
import { ItemIcon } from "@/components/trips/item-icon";
import { fmtDow, fmtRange, fmtShort, fmtTime, nightsBetween, toISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { MEAL_PLAN_SHORT, type MealPlanValue } from "@/lib/labels";
import type { PricedLine } from "@/lib/pricing";
import { sendTripAction, setTripStatusAction, updateTripMetaAction } from "@/server/actions/trips";
import type { TripFull } from "@/server/trips/queries";
import { WizardFooter, stepHref } from "./frame";
import { travellerSummary } from "./step-guest";

function Section({ title, step, tripId, children }: { title: string; step: number; tripId: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <Link href={stepHref(tripId, step)} className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground">
          <Pencil className="size-3" aria-hidden /> Edit
        </Link>
      </div>
      <div className="px-4 py-3 text-[13.5px]">{children}</div>
    </section>
  );
}

export function ReviewStep({
  tripId,
  trip,
  lines,
  computed,
  total,
  issues,
  warnings,
}: {
  tripId: string;
  trip: TripFull;
  lines: PricedLine[];
  computed: number;
  total: number;
  issues: string[];
  warnings: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(trip.title ?? "");
  const [price, setPrice] = useState(trip.priceOverride !== null ? String(trip.priceOverride) : "");
  const [saving, setSaving] = useState(false);
  const nights = nightsBetween(toISO(trip.startDate), toISO(trip.endDate));

  const saveMeta = async () => {
    const r = await updateTripMetaAction(tripId, { title: title || null, priceOverride: price === "" ? null : Number(price), wizardStep: 10 });
    if (!r.ok) toast.error(r.message);
    return r.ok;
  };

  const markReady = async () => {
    setSaving(true);
    try {
      if (!(await saveMeta())) return;
      if (trip.status === "DRAFT") {
        const r = await setTripStatusAction(tripId, "PLANNING");
        if (!r.ok) return toast.error(r.message);
      }
      if (["DRAFT", "PLANNING"].includes(trip.status)) {
        const r = await setTripStatusAction(tripId, "READY");
        if (!r.ok) return toast.error(r.message);
      }
      toast.success("Trip saved and ready to send.");
      router.push(stepHref(tripId, 10));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {issues.length ? (
        <div role="alert" className="mb-4 rounded-xl border border-bad/20 bg-bad-soft px-4 py-3 text-[13.5px] text-bad">
          <p className="font-medium">Before this trip can be sent:</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length ? (
        <div className="mb-4 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-[13.5px]">
          <p className="flex items-center gap-2 font-medium text-warn">
            <AlertTriangle className="size-4" aria-hidden /> Worth checking
          </p>
          <ul className="mt-1 list-disc pl-6 text-foreground/80">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Guest" step={1} tripId={tripId}>
          <p className="font-medium">{trip.primaryGuest?.fullName ?? "—"}</p>
          <p className="text-muted-foreground">{[trip.primaryGuest?.phone, trip.primaryGuest?.email].filter(Boolean).join(" · ") || "No contact details"}</p>
          <p className="mt-1 text-muted-foreground">{travellerSummary(trip.adults, trip.children, trip.infants)}</p>
          {trip.guests.length > 1 ? <p className="mt-1 text-muted-foreground">With {trip.guests.filter((g) => !g.isPrimary).map((g) => g.guest.fullName).join(", ")}</p> : null}
        </Section>
        <Section title="Dates & destinations" step={2} tripId={tripId}>
          <p className="font-medium">
            {fmtRange(trip.startDate, trip.endDate)} · {nights}N / {nights + 1}D
          </p>
          <p className="text-muted-foreground">{trip.destinations.map((d) => `${d.name} (${d.nights ?? 0}N)`).join(" → ") || "No destinations"}</p>
        </Section>
        <Section title="Hotels & rooms" step={4} tripId={tripId}>
          {trip.hotels.length ? (
            <ul className="space-y-1.5">
              {trip.hotels.map((h) => (
                <li key={h.id}>
                  <span className="font-medium">{h.hotel.name}</span>{" "}
                  <span className="text-muted-foreground tabular">
                    {fmtShort(h.checkIn)}–{fmtShort(h.checkOut)}
                  </span>
                  <span className="block text-[12.5px] text-muted-foreground">{h.rooms.map((r) => `${r.quantity} × ${r.roomName} (${MEAL_PLAN_SHORT[r.mealPlan as MealPlanValue]})`).join(", ") || "No rooms"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No hotels</p>
          )}
        </Section>
        <Section title="Transport & activities" step={6} tripId={tripId}>
          <ul className="space-y-1">
            {trip.transports.map((t) => (
              <li key={t.id} className="flex gap-2">
                <ItemIcon type="TRANSPORT" size="sm" className="size-5 border-0 [&_svg]:size-3.5" />
                <span>
                  {fmtDow(t.date)}
                  {t.time ? ` ${fmtTime(t.time)}` : ""} · {t.pickup} → {t.dropoff}
                </span>
              </li>
            ))}
            {trip.activities.map((a) => (
              <li key={a.id} className="flex gap-2">
                <ItemIcon type={a.kind} size="sm" className="size-5 border-0 [&_svg]:size-3.5" />
                <span>
                  {fmtDow(a.date)} · {a.title}
                </span>
              </li>
            ))}
            {!trip.transports.length && !trip.activities.length ? <li className="text-muted-foreground">None added</li> : null}
          </ul>
        </Section>
      </div>

      <section className="mt-4 rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-[13.5px] font-semibold">Itinerary</h2>
          <Link href={stepHref(tripId, 8)} className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground">
            <Pencil className="size-3" aria-hidden /> Edit
          </Link>
        </div>
        <ol className="divide-y">
          {trip.days.map((d) => (
            <li key={d.id} className="flex gap-4 px-4 py-2.5 text-[13.5px]">
              <span className="w-14 shrink-0 font-medium text-muted-foreground">Day {d.dayNumber}</span>
              <span className="min-w-0">
                <span className="font-medium">{d.title ?? fmtDow(d.date)}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">{d.items.map((i) => i.title).join(" · ") || "At leisure"}</span>
              </span>
            </li>
          ))}
          {!trip.days.length ? <li className="px-4 py-3 text-[13.5px] text-muted-foreground">Not built yet.</li> : null}
        </ol>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-2.5 text-[13.5px] font-semibold">Pricing</h2>
          <ul className="divide-y text-[13.5px]">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 px-4 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{l.label}</span>
                  {l.detail ? <span className="block text-[12px] text-muted-foreground">{l.detail}</span> : null}
                </span>
                <span className="shrink-0 tabular">{formatINR(l.amount)}</span>
              </li>
            ))}
            {!lines.length ? <li className="px-4 py-3 text-muted-foreground">No priced items yet.</li> : null}
            <li className="flex justify-between px-4 py-2.5 font-medium">
              <span>Itemised total</span>
              <span className="tabular">{formatINR(computed)}</span>
            </li>
          </ul>
        </div>
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="trip-title">Trip name</Label>
            <Input id="trip-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={trip.destinations.map((d) => d.name).join(" · ") || "e.g. Kashmir honeymoon"} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-price">Package price (₹)</Label>
            <Input id="trip-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder={String(computed)} />
            <p className="text-[12.5px] text-muted-foreground">Leave blank to charge the itemised total. Set a price to quote one all-inclusive amount.</p>
          </div>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="text-[13.5px] text-muted-foreground">Total amount</span>
            <span className="text-[22px] font-semibold tabular">{formatINR(price === "" ? computed : Number(price))}</span>
          </div>
          {price !== "" && Number(price) !== total ? <p className="text-[12px] text-muted-foreground">Saved when you continue.</p> : null}
        </div>
      </section>

      <WizardFooter back={stepHref(tripId, 8)} pending={saving} disabled={issues.length > 0} onContinue={markReady} continueLabel="Save trip & continue" />
    </>
  );
}

export function SendStep({ tripId, trip, url }: { tripId: string; trip: TripFull; url: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(Boolean(trip.primaryGuest?.email));
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ url: string; emailStatus: string; version: number } | null>(null);
  const alreadySent = Boolean(trip.publishedVersion);

  const send = async () => {
    setPending(true);
    const r = await sendTripAction(tripId, { message, email });
    setPending(false);
    if (!r.ok) return toast.error(r.message);
    setResult(r.data);
    toast.success(r.data.emailStatus === "FAILED" ? "Trip published, but the email failed. Share the link instead." : "Itinerary sent to the guest.");
    router.refresh();
  };

  const link = result?.url ?? url;

  if (result) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center animate-fade-in">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <h2 className="mt-4 text-[20px] font-semibold">Sent to {trip.primaryGuest?.fullName}</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Version {result.version} is live on the guest&apos;s trip page.{" "}
          {result.emailStatus === "SENT" ? "The email is on its way." : result.emailStatus === "LOGGED" ? "Email recorded (development mode — not delivered)." : result.emailStatus === "SKIPPED" ? "No email was sent." : "The email could not be delivered."}
        </p>
        <CopyLink url={result.url} />
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={`/app/trips/${tripId}`}>Open trip command center</Link>
          </Button>
          <Button asChild variant="outline">
            <a href={result.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden /> View guest page
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-medium">{trip.primaryGuest?.fullName}</p>
            <TripStatusBadge status={trip.status} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="send-msg">Personal note (optional)</Label>
            <Textarea id="send-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={1000} placeholder="Hi Rahul, here's the plan for your Kashmir trip. Let me know if you'd like any changes!" />
          </div>
          <div className="flex items-start gap-3 rounded-lg border px-3 py-3">
            <Switch id="send-email" checked={email} onCheckedChange={setEmail} disabled={!trip.primaryGuest?.email} />
            <div>
              <Label htmlFor="send-email" className="text-[13.5px]">
                <Mail className="size-3.5" aria-hidden /> Email the guest a link
              </Label>
              <p className="text-[12.5px] text-muted-foreground">{trip.primaryGuest?.email ?? "The primary guest has no email — share the link on WhatsApp instead."}</p>
            </div>
          </div>
          {alreadySent ? (
            <p className="rounded-lg bg-info-soft px-3 py-2 text-[12.5px] text-info">
              Already sent (version {trip.publishedVersion}). Sending again publishes the latest changes as a new version.
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border bg-card p-5 text-[13.5px]">
          <p className="font-medium">What the guest gets</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            {["A private trip page — no login, secure link", "Day-by-day itinerary, hotels and transfers", "Documents you choose to share", "Your agency's contact details"].map((x) => (
              <li key={x} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> {x}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] text-muted-foreground">Later edits stay private until you publish an update from the trip command center.</p>
          {link ? <CopyLink url={link} /> : null}
        </div>
      </div>
      <WizardFooter
        back={stepHref(tripId, 9)}
        pending={pending}
        onContinue={send}
        continueLabel={alreadySent ? "Send update to guest" : "Send to guest"}
        extra={
          <Button asChild variant="ghost">
            <Link href={`/app/trips/${tripId}`}>Not now</Link>
          </Button>
        }
      />
    </>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 flex items-center gap-2 rounded-lg border bg-surface p-1.5 pl-3 text-left">
      <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{url}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            toast.error("Couldn't copy — select the link and copy it manually.");
          }
        }}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}


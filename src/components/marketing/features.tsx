import Image from "next/image";
import type { ReactNode } from "react";
import { BedDouble, Car, CheckCircle2, CreditCard, FileText, GripVertical, MapPin, MessageCircle, MousePointer2, Phone, Plus, Users } from "lucide-react";
import houseboats from "@/assets/landing/houseboats.jpg";
import shikaraDawn from "@/assets/landing/shikara-dawn.jpg";
import { TRIP_TABS } from "@/components/trips/command/tabs-nav";
import { AppWindow, Eyebrow, Heading, Label, Meter, StatusPill, TypeIcon } from "@/components/marketing/ui";
import { PAY, TRIP, TRIP_DATES, TRIP_TRAVELLERS, money } from "@/components/marketing/data";
import { addDays, fmtDow, fmtShort, nightsBetween } from "@/lib/dates";
import { cn } from "@/lib/utils";

function Points({ items }: { items: [string, string][] }) {
  return (
    <ul className="mt-10 space-y-5 border-t border-ivory/8 pt-8" data-stagger>
      {items.map(([t, b]) => (
        <li key={t} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
          <CheckCircle2 className="mt-0.5 size-[17px] text-sand/80" aria-hidden />
          <p className="text-[14.5px] leading-[1.6] text-ivory/60">
            <span className="text-ivory">{t}</span> {b}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ====================================================================== */
/* 01 — Trip Command Center                                               */
/* ====================================================================== */

export function CommandCenter() {
  return (
    <section aria-labelledby="f1-h" className="relative px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end" data-reveal>
          <div>
            <Eyebrow index="04">Trip Command Center</Eyebrow>
            <Heading id="f1-h" className="mt-6" lead="Every trip." serif="One source of truth." />
          </div>
          <p className="max-w-[30rem] text-[16px] leading-[1.7] text-ivory/65 lg:justify-self-end">
            Where the guest is, what happens today, what&apos;s confirmed and what&apos;s still pending — hotels, drivers, payments, documents and the itinerary, on one screen your whole team reads the same way.
          </p>
        </div>
        <div data-reveal="clip" className="mt-16 sm:mt-20">
          <CommandWindow />
        </div>
      </div>
    </section>
  );
}

function Card({ title, icon, children, className, aside }: { title: string; icon: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <div className={cn("panel p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[12px] text-ivory/60">
          <span className="text-sand/80">{icon}</span>
          {title}
        </p>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function CommandWindow() {
  const nights = nightsBetween(TRIP.startDate, TRIP.endDate);
  return (
    <AppWindow crumbs={[TRIP.agency, "Trips", TRIP.code]}>
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 pt-5 @[640px]:px-7 @[640px]:pt-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[12px] text-ivory/55">{TRIP.code}</span>
            <StatusPill>{TRIP.statusLabel}</StatusPill>
          </div>
          <p className="mt-2 text-[24px] font-medium tracking-[-0.02em] text-ivory @[640px]:text-[30px]">{TRIP.title}</p>
        </div>
        <div className="flex items-center gap-2 text-[12px]" aria-hidden>
          <span className="rounded-md border border-ivory/12 px-3 py-1.5 text-ivory/75">Documents</span>
          <span className="rounded-md bg-ivory px-3 py-1.5 font-medium text-ink">Publish update</span>
        </div>
      </div>
      <div className="scrollbar-none mt-5 overflow-x-auto border-b border-ivory/8 px-4 @[640px]:px-7" aria-hidden>
        <ul className="flex min-w-max gap-6 text-[12.5px]">
          {TRIP_TABS.map(([key, label]) => (
            <li key={key} className={cn("relative pb-3", key === "overview" ? "text-ivory after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-sand" : "text-ivory/60")}>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 @[640px]:grid-cols-2 @[640px]:p-7 @[1040px]:grid-cols-3" data-stagger>
        <Card title="Guest" icon={<Users className="size-3.5" />}>
          <p className="text-[15px] text-ivory">{TRIP.guest.name}</p>
          <p className="mt-0.5 text-[12px] text-ivory/60">
            {TRIP.guest.phone} · {TRIP_TRAVELLERS}
          </p>
          <p className="mt-3 text-[11.5px] text-ivory/60">Prefers lake-view rooms · vegetarian ×1</p>
        </Card>

        <Card title="Dates & destination" icon={<MapPin className="size-3.5" />}>
          <p className="text-[15px] text-ivory">
            {TRIP_DATES} <span className="text-ivory/60">· {nights} nights</span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ivory/70">
            {TRIP.destinations.map((d, i) => (
              <span key={d} className="flex items-center gap-1.5">
                {i > 0 ? <span className="text-ivory/55">→</span> : null}
                <span className="rounded border border-ivory/10 px-1.5 py-0.5">{d}</span>
              </span>
            ))}
          </p>
        </Card>

        <Card title="Payments" icon={<CreditCard className="size-3.5" />} aside={<StatusPill tone="warn">Partially paid</StatusPill>}>
          <p className="text-[22px] tracking-[-0.02em] text-ivory">
            {money(PAY.paid)} <span className="text-[13px] text-ivory/60">of {money(PAY.total)}</span>
          </p>
          <div className="mt-2.5">
            <Meter ratio={PAY.paid / PAY.total} />
          </div>
          <p className="mt-2 text-[11.5px] text-ivory/60">{money(PAY.pending)} due before departure</p>
        </Card>

        <Card title="Hotels" icon={<BedDouble className="size-3.5" />} aside={<span className="text-[11px] text-ivory/60">3 / 3 confirmed</span>} className="@[1040px]:row-span-2">
          <ul className="space-y-2.5">
            {TRIP.hotels.map((h, i) => (
              <li key={h.name} className="rounded-md border border-ivory/8 p-3">
                <p className="flex items-center justify-between gap-2 text-[13px] text-ivory">
                  <span className="truncate">{h.name}</span>
                  <StatusPill>{h.status}</StatusPill>
                </p>
                <p className="mt-1 truncate text-[11.5px] text-ivory/60">
                  {h.city} · {h.room} · {h.meal}
                </p>
                <p className="mt-0.5 text-[11.5px] text-ivory/60">
                  {fmtShort(addDays(TRIP.startDate, i * 2))} → {fmtShort(addDays(TRIP.startDate, i * 2 + h.nights))} · {h.nights} nights
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Drivers & transfers" icon={<Car className="size-3.5" />} aside={<span className="text-[11px] text-sand">1 pending</span>}>
          <ul className="space-y-2">
            {TRIP.transport.map((t) => (
              <li key={t.leg} className="flex items-start gap-2.5 text-[12px]">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", t.ok ? "bg-moss" : "bg-sand")} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-ivory/85">{t.leg}</span>
                  <span className={cn("block truncate", t.ok ? "text-ivory/60" : "text-sand")}>{t.driver}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Itinerary" icon={<FileText className="size-3.5" />} aside={<StatusPill tone="info">Version 2 sent</StatusPill>}>
          <ul className="space-y-2">
            {TRIP.day1.slice(0, 3).map((it) => (
              <li key={it.time} className="flex items-center gap-2.5 text-[12px]">
                <span className="w-10 font-mono text-[11px] text-ivory/60">{it.time}</span>
                <TypeIcon type={it.type} className="size-6" />
                <span className="truncate text-ivory/85">{it.title}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Documents" icon={<FileText className="size-3.5" />} className="@[640px]:col-span-2 @[1040px]:col-span-2">
          <ul className="grid grid-cols-1 gap-2 @[480px]:grid-cols-2 @[1040px]:grid-cols-4">
            {TRIP.documents.map((d) => (
              <li key={d} className="flex items-center gap-2 truncate rounded-md border border-ivory/8 px-2.5 py-2 text-[12px] text-ivory/80">
                <FileText className="size-3.5 shrink-0 text-ivory/60" aria-hidden />
                <span className="truncate">{d}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppWindow>
  );
}

/* ====================================================================== */
/* 02 — Itinerary builder                                                 */
/* ====================================================================== */

export function ItineraryBuilder() {
  return (
    <section aria-labelledby="f2-h" className="relative border-t border-ivory/8 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-20">
        <div data-reveal>
          <Eyebrow index="05">Itinerary builder</Eyebrow>
          <Heading id="f2-h" className="mt-6" lead="Build journeys" serif="visually." />
          <p className="mt-7 max-w-[30rem] text-[16px] leading-[1.7] text-ivory/65">
            Days are generated from what you&apos;ve actually booked — real check-in times, real transfers. Drag to reorder, drop in activities, or start from a template and let your bookings replace the placeholders.
          </p>
          <Points
            items={[
              ["Never invents facts.", "Arrivals without flight details are flagged as placeholders, not guessed."],
              ["Bookings stay in sync.", "Move a hotel or a transfer and its itinerary item moves with it."],
              ["Templates in one click.", "Start from Kashmir 6N/7D or Honeymoon and adjust."],
            ]}
          />
        </div>
        <div data-reveal className="[--d:150ms]">
          <BuilderWindow />
        </div>
      </div>
    </section>
  );
}

function BuilderWindow() {
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ n: i + 1, date: addDays(TRIP.startDate, i), place: i < 2 ? "Srinagar" : i < 4 ? "Gulmarg" : i < 6 ? "Pahalgam" : "Departure" }));
  return (
    <AppWindow crumbs={[TRIP.code, "Itinerary"]}>
      <div className="grid grid-cols-1 @[620px]:grid-cols-[150px_minmax(0,1fr)]">
        <ol className="scrollbar-none flex gap-1 overflow-x-auto border-b border-ivory/8 p-2.5 @[620px]:block @[620px]:space-y-0.5 @[620px]:border-r @[620px]:border-b-0" aria-hidden>
          {days.map((d) => (
            <li key={d.n} className={cn("shrink-0 rounded-md px-2.5 py-2", d.n === 1 ? "bg-ivory/[0.06]" : "")}>
              <p className={cn("text-[12px]", d.n === 1 ? "text-ivory" : "text-ivory/55")}>Day {d.n}</p>
              <p className="text-[10.5px] text-ivory/60">
                {fmtShort(d.date)} · {d.place}
              </p>
            </li>
          ))}
        </ol>
        <div className="p-4 @[620px]:p-6" data-reveal="fade">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-medium tracking-[0.16em] text-sand uppercase">Day 1 — Srinagar</p>
            <span className="text-[11px] text-ivory/60">{fmtDow(TRIP.startDate)}</span>
          </div>
          <ol className="mt-4 space-y-2">
            {TRIP.day1.slice(0, 3).map((it) => (
              <BuilderItem key={it.time} time={it.time} type={it.type} title={it.type === "ACTIVITY" ? "Dal Lake Shikara Ride" : it.title} detail={it.detail} />
            ))}
            <li className="drag-slot relative h-2" aria-hidden>
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-sand/70" />
              <span className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rounded-full bg-sand" />
            </li>
            <BuilderItem time="19:00" type="MEAL" title="Dinner" detail={TRIP.day1[3].detail} />
          </ol>

          <div className="relative mt-3">
            <div className="drag-card relative z-10 flex items-center gap-3 rounded-lg border border-sand/40 bg-[#1a1c18] px-3 py-2.5 [--drag-from:72px]">
              <GripVertical className="size-4 text-ivory/60" aria-hidden />
              <span className="w-11 font-mono text-[11.5px] text-sand">16:30</span>
              <TypeIcon type="SIGHTSEEING" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-ivory">Mughal gardens</span>
                <span className="block truncate text-[11.5px] text-ivory/60">Nishat & Shalimar Bagh</span>
              </span>
              <MousePointer2 className="absolute -right-1 -bottom-3 size-5 fill-ivory text-ink" aria-hidden />
            </div>
          </div>

          <p className="mt-6 flex items-center gap-2 rounded-lg border border-dashed border-ivory/12 px-3 py-3 text-[12px] text-ivory/60">
            <Plus className="size-3.5" aria-hidden /> Add hotel, transfer, activity or note
          </p>
        </div>
      </div>
    </AppWindow>
  );
}

function BuilderItem({ time, type, title, detail }: { time: string; type: string; title: string; detail: string }) {
  return (
    <li className="group flex items-center gap-3 rounded-lg border border-ivory/8 bg-ivory/[0.015] px-3 py-2.5 transition-colors duration-300 hover:border-ivory/20">
      <GripVertical className="size-4 text-ivory/55 transition-colors group-hover:text-ivory/60" aria-hidden />
      <span className="w-11 font-mono text-[11.5px] text-ivory/55">{time}</span>
      <TypeIcon type={type} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-ivory/90">{title}</span>
        <span className="block truncate text-[11.5px] text-ivory/60">{detail}</span>
      </span>
    </li>
  );
}

/* ====================================================================== */
/* 03 — Guest experience                                                  */
/* ====================================================================== */

export function GuestExperience() {
  return (
    <section aria-labelledby="f3-h" className="relative overflow-hidden border-t border-ivory/8 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center lg:gap-20">
        {/* Visual: editorial photograph + phone */}
        <div className="relative lg:order-1">
          <div className="relative aspect-[3/4] overflow-hidden rounded-[22px] sm:aspect-[5/4]" data-reveal="clip">
            <div className="scroll-drift absolute inset-0">
              <Image src={shikaraDawn} alt="" placeholder="blur" fill sizes="(min-width: 1024px) 760px, 100vw" className="object-cover [filter:saturate(0.65)_brightness(0.62)]" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-ink/30" aria-hidden />
            <p className="absolute bottom-6 left-6 hidden max-w-[16rem] text-[12px] leading-relaxed text-ivory/60 sm:block">
              <span className="serif block text-[22px] leading-tight text-ivory/90 italic">“Our whole trip, in one link.”</span>
              What your guest should feel, every time.
            </p>
          </div>
          <div className="absolute inset-0 grid place-items-center sm:inset-auto sm:top-1/2 sm:right-8 sm:-translate-y-1/2 lg:-right-10">
            <div data-reveal className="max-sm:scale-[0.8] [--d:300ms]">
              <Phone_ />
            </div>
          </div>
        </div>

        <div data-reveal className="lg:order-2">
          <Eyebrow index="06">Guest experience</Eyebrow>
          <Heading id="f3-h" className="mt-6" lead="Your work." serif="Beautifully delivered." />
          <p className="mt-7 max-w-[30rem] text-[16px] leading-[1.7] text-ivory/65">
            Every guest gets a private trip page — overview, itinerary, hotels, documents and payments — that feels closer to a luxury travel app than a PDF in a chat.
          </p>
          <Points
            items={[
              ["No app, no login.", "A secure private link that works on any phone."],
              ["Always current.", "The guest sees the latest version you've published — never a half-finished edit."],
              ["Private by design.", "Rates, internal notes and ID numbers never reach the guest page."],
            ]}
          />
        </div>
      </div>
    </section>
  );
}

/** Guest trip page inside a phone frame. */
function Phone_() {
  return (
    <div className="w-[272px] rounded-[44px] border border-ivory/15 bg-[#050605] p-2.5 shadow-[0_50px_90px_-30px_rgb(0_0_0/0.95),0_0_0_1px_rgb(0_0_0/0.6)]" role="img" aria-label="A guest's trip page on a phone: trip overview, today's itinerary, hotel, documents and payment status">
      <div className="relative h-[540px] overflow-hidden rounded-[35px] bg-[#f4efe5] text-[#191a16]">
        <div className="relative h-[200px]">
          <Image src={houseboats} alt="" placeholder="blur" fill sizes="272px" className="object-cover [filter:saturate(0.8)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/70" />
          <div className="absolute inset-x-0 top-0 flex justify-center pt-2">
            <span className="h-[22px] w-[84px] rounded-full bg-black" />
          </div>
          <div className="absolute inset-x-4 bottom-4 text-[#f4efe5]">
            <p className="text-[8.5px] tracking-[0.22em] uppercase opacity-80">{TRIP.agency}</p>
            <p className="serif mt-1 text-[26px] leading-none">{TRIP.title}</p>
            <p className="mt-1.5 text-[10px] opacity-85">
              {TRIP_DATES} · {TRIP_TRAVELLERS}
            </p>
          </div>
        </div>
        <div className="flex gap-3.5 overflow-hidden border-b border-black/10 px-4 pt-3 text-[10px]">
          {["Overview", "Itinerary", "Hotels", "Documents", "Payments"].map((t, i) => (
            <span key={t} className={cn("shrink-0 pb-2", i === 1 ? "border-b border-black font-medium" : "text-black/60")}>
              {t}
            </span>
          ))}
        </div>
        <div className="space-y-3 px-4 py-3">
          <div>
            <p className="text-[8.5px] font-medium tracking-[0.16em] text-black/60 uppercase">Day 1 · {fmtDow(TRIP.startDate)}</p>
            <ul className="mt-2 space-y-2">
              {TRIP.day1.map((it) => (
                <li key={it.time} className="flex items-center gap-2.5">
                  <span className="w-8 font-mono text-[9px] text-black/60">{it.time}</span>
                  <span className="text-[11px]">{it.title}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-black/[0.05] p-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-black/10">
              <BedDouble className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium">Blanco Hotel</p>
              <p className="text-[9.5px] text-black/65">Premium, lake view · 2 nights</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-black/[0.05] p-2.5 text-[10px]">
            <span className="flex items-center gap-1.5">
              <FileText className="size-3" aria-hidden /> Itinerary · Vouchers
            </span>
            <span className="text-black/60">PDF</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
            <span className="flex items-center justify-center gap-1.5 rounded-full bg-[#191a16] py-2 text-[#f4efe5]">
              <MessageCircle className="size-3" aria-hidden /> WhatsApp
            </span>
            <span className="flex items-center justify-center gap-1.5 rounded-full border border-black/15 py-2">
              <Phone className="size-3" aria-hidden /> Call agent
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* 04 — One trip, three views                                             */
/* ====================================================================== */

const VIEWS = [
  {
    role: "Super Admin",
    nav: ["Agencies", "Hotels", "Rates", "Reports", "Audit log"],
    sees: "The platform: agencies, the hotel catalogue, who gets which rate, and every change.",
    body: (
      <>
        <Label>Blanco Hotel · Premium</Label>
        <div className="mt-2 space-y-1.5 text-[12px]">
          <p className="flex justify-between">
            <span className="text-ivory/60">Base rate</span>
            <span className="text-ivory/90 tabular">₹11,500</span>
          </p>
          <p className="flex justify-between">
            <span className="text-ivory/60">ABC Travels</span>
            <span className="text-ivory/90 tabular">₹10,200</span>
          </p>
          <p className="flex justify-between">
            <span className="text-ivory/60">Kashmir Holidays</span>
            <span className="text-ivory/90 tabular">₹10,800</span>
          </p>
        </div>
        <p className="mt-4 border-t border-ivory/8 pt-3 text-[11.5px] text-ivory/60">Audit · ABC Travels published v2 of {TRIP.code}</p>
      </>
    ),
  },
  {
    role: "Agent",
    nav: ["Trips", "Guests", "Itinerary", "Payments"],
    sees: "Their own agency only — trips, guests and their negotiated rates. Never anyone else's.",
    body: (
      <>
        <Label>{TRIP.code} · {TRIP.guest.name}</Label>
        <div className="mt-2 space-y-1.5 text-[12px]">
          <p className="flex justify-between">
            <span className="text-ivory/60">Blanco Hotel · your rate</span>
            <span className="text-ivory/90 tabular">₹10,200</span>
          </p>
          <p className="flex justify-between">
            <span className="text-ivory/60">Received</span>
            <span className="text-ivory/90 tabular">
              {money(PAY.paid)} / {money(PAY.total)}
            </span>
          </p>
          <p className="flex justify-between">
            <span className="text-ivory/60">Status</span>
            <span className="text-[#9cc3a5]">{TRIP.statusLabel}</span>
          </p>
        </div>
        <p className="mt-4 border-t border-ivory/8 pt-3 text-[11.5px] text-ivory/60">Draft changes stay private until published</p>
      </>
    ),
  },
  {
    role: "Guest",
    nav: ["Trip", "Hotels", "Documents", "Itinerary"],
    sees: "The published trip — beautifully. No prices, notes or other guests' details.",
    body: (
      <>
        <Label>{TRIP.title}</Label>
        <div className="mt-2 space-y-1.5 text-[12px]">
          <p className="flex justify-between">
            <span className="text-ivory/60">Blanco Hotel</span>
            <span className="text-ivory/90">Premium, lake view</span>
          </p>
          <p className="flex justify-between">
            <span className="text-ivory/60">Day 1 · 14:00</span>
            <span className="text-ivory/90">Shikara ride</span>
          </p>
          <p className="flex justify-between">
            <span className="text-ivory/60">Documents</span>
            <span className="text-ivory/90">Itinerary, vouchers</span>
          </p>
        </div>
        <p className="mt-4 border-t border-ivory/8 pt-3 text-[11.5px] text-ivory/60">Showing version 2 · published</p>
      </>
    ),
  },
];

export function ThreeViews() {
  return (
    <section aria-labelledby="f4-h" className="relative border-t border-ivory/8 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1320px]">
        <div className="mx-auto max-w-[760px] text-center" data-reveal>
          <Eyebrow index="07" className="justify-center">
            Roles
          </Eyebrow>
          <h2 id="f4-h" className="display mt-6 text-[34px] text-ivory sm:text-[48px] lg:text-[58px]">
            <span className="block">One trip.</span>
            <span className="serif block text-[1.12em] leading-[0.98]">Three views.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-[34rem] text-[16px] leading-[1.7] text-ivory/65">
            The platform, the agency and the traveller all look at the same underlying record — each sees exactly what they should, and nothing more.
          </p>
        </div>

        <div className="relative mt-16 sm:mt-24">
          <ul className="grid grid-cols-1 gap-5 lg:grid-cols-3" data-stagger>
            {VIEWS.map((v) => (
              <li key={v.role} className="flex flex-col">
                <div className="window flex-1">
                  <div className="flex items-center justify-between border-b border-ivory/8 px-4 py-3">
                    <p className="text-[13px] text-ivory">{v.role}</p>
                    <span className="font-mono text-[10.5px] text-ivory/60">{TRIP.code}</span>
                  </div>
                  <div className="grid grid-cols-[104px_minmax(0,1fr)]">
                    <ul className="space-y-0.5 border-r border-ivory/8 p-2 text-[11.5px] text-ivory/60" aria-label={`${v.role} navigation`}>
                      {v.nav.map((n, i) => (
                        <li key={n} className={cn("rounded px-2 py-1.5", i === 0 && "bg-ivory/[0.06] text-ivory")}>
                          {n}
                        </li>
                      ))}
                    </ul>
                    <div className="p-4">{v.body}</div>
                  </div>
                </div>
                {/* Connector to the shared record */}
                <span className="mx-auto h-10 w-px bg-gradient-to-b from-ivory/20 to-sand/60" aria-hidden />
                <p className="text-center text-[13px] leading-relaxed text-ivory/60">{v.sees}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex items-center gap-4" aria-hidden>
            <span className="rule-fade flex-1" />
            <span className="rounded-full border border-sand/40 bg-ink px-4 py-1.5 font-mono text-[11.5px] text-sand">{TRIP.code} · one record</span>
            <span className="rule-fade flex-1" />
          </div>
        </div>
      </div>
    </section>
  );
}

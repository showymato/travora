import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BedDouble, CalendarDays, Car, Download, FileText, Mail, MapPin, MessageCircle, Phone, Users } from "lucide-react";
import { getPublicTrip } from "@/server/trips/publish";
import { rateLimit } from "@/server/rate-limit";
import { ItemIcon } from "@/components/trips/item-icon";
import { Stars } from "@/components/app/visuals";
import { HotelCover } from "@/components/app/visuals";
import { fmtDate, fmtDateTime, fmtDow, fmtDuration, fmtLong, fmtShort, fmtTime, todayISO } from "@/lib/dates";
import { DOCUMENT_KIND_LABEL, MEAL_PLAN_LABEL, TRANSPORT_KIND_LABEL, type DocumentKindValue, type MealPlanValue, type TransportKindValue } from "@/lib/labels";
import { travellerSummary } from "@/lib/plan";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Your trip", robots: { index: false, follow: false } };

export default async function GuestTripPage({ params }: PageProps<"/trip/[token]">) {
  const { token } = await params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  // Throttle token guessing; real tokens are 256-bit random so this is defence in depth.
  const rl = await rateLimit(`guestpage:${ip}`, 300, 60 * 10);
  if (!rl.allowed) notFound();
  const data = await getPublicTrip(token);
  if (!data) notFound();
  const { snapshot: s, documents, updatedAt } = data;
  const today = todayISO();
  const phone = s.agency.phone?.replace(/[^\d+]/g, "");
  const whatsapp = phone ? `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(`Hi, this is about my trip ${s.trip.code}.`)}` : null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="relative overflow-hidden bg-[oklch(0.24_0.06_268)] text-white">
        <div className="bg-dots absolute inset-0 opacity-25 [--foreground:white]" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-5 pt-8 pb-10 sm:px-8 sm:pt-12 sm:pb-14">
          <p className="text-[12.5px] font-medium tracking-[0.14em] text-white/70 uppercase">{s.agency.name}</p>
          <h1 className="mt-4 text-[30px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[40px]">{s.trip.title}</h1>
          <p className="mt-2 text-[15px] text-white/80">Prepared for {s.guests.find((g) => g.primary)?.name ?? s.guests[0]?.name ?? "you"}</p>
          <dl className="mt-7 grid grid-cols-2 gap-4 text-[13.5px] sm:grid-cols-3">
            <div>
              <dt className="flex items-center gap-1.5 text-white/60">
                <CalendarDays className="size-3.5" aria-hidden /> Dates
              </dt>
              <dd className="mt-0.5 font-medium">{s.trip.startDate && s.trip.endDate ? `${fmtShort(s.trip.startDate)} – ${fmtDate(s.trip.endDate)}` : "—"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-white/60">
                <Users className="size-3.5" aria-hidden /> Travellers
              </dt>
              <dd className="mt-0.5 font-medium">{travellerSummary(s.trip.travelers.adults, s.trip.travelers.children, s.trip.travelers.infants)}</dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="flex items-center gap-1.5 text-white/60">
                <MapPin className="size-3.5" aria-hidden /> Route
              </dt>
              <dd className="mt-0.5 font-medium">{s.trip.destinations.join(" → ") || "—"}</dd>
            </div>
          </dl>
        </div>
      </header>

      <nav aria-label="Trip sections" className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <ul className="scrollbar-none mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 sm:px-6">
          {[
            ["itinerary", "Itinerary"],
            ["hotels", "Hotels"],
            ["transport", "Transfers"],
            ["documents", "Documents"],
            ["contact", "Contact"],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="flex h-11 items-center px-3 text-[13.5px] font-medium whitespace-nowrap text-muted-foreground hover:text-foreground">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <section id="itinerary" aria-labelledby="h-itin" className="scroll-mt-16">
          <h2 id="h-itin" className="text-[20px] font-semibold tracking-[-0.01em]">
            Day by day
          </h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {s.trip.nights} nights · {s.trip.nights + 1} days. Times are local.
          </p>
          <ol className="mt-6 space-y-5">
            {s.days.map((d) => {
              const isToday = d.date === today;
              return (
                <li key={d.dayNumber} id={`day-${d.dayNumber}`} className={cn("rounded-2xl border bg-card", isToday && "border-teal/40 ring-2 ring-teal/15")}>
                  <div className="flex items-baseline gap-3 border-b px-5 py-4">
                    <span className="text-[12px] font-semibold tracking-wider text-primary uppercase">Day {d.dayNumber}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[16px] font-semibold">{d.title ?? fmtDow(d.date)}</h3>
                      <p className="text-[12.5px] text-muted-foreground">
                        {fmtLong(d.date)}
                        {isToday ? <span className="ml-2 font-medium text-teal">Today</span> : null}
                      </p>
                    </div>
                  </div>
                  {d.summary ? <p className="px-5 pt-3 text-[14px] text-muted-foreground">{d.summary}</p> : null}
                  {d.items.length ? (
                    <ol className="px-3 py-3 sm:px-4">
                      {d.items.map((i, idx) => (
                        <li key={idx} className="flex gap-3 rounded-lg px-2 py-2.5">
                          <span className="w-[62px] shrink-0 pt-1 text-right text-[12.5px] font-medium text-muted-foreground tabular">{i.time ? fmtTime(i.time) : ""}</span>
                          <ItemIcon type={i.type} size="sm" />
                          <div className="min-w-0 pt-0.5">
                            <p className="text-[14.5px] font-medium">{i.title}</p>
                            {i.location || i.durationMins ? <p className="text-[12.5px] text-muted-foreground">{[i.location, fmtDuration(i.durationMins)].filter(Boolean).join(" · ")}</p> : null}
                            {i.description ? <p className="mt-1 text-[13.5px] whitespace-pre-line text-foreground/80">{i.description}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="px-5 py-4 text-[14px] text-muted-foreground">At leisure.</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section id="hotels" aria-labelledby="h-hotels" className="mt-12 scroll-mt-16">
          <h2 id="h-hotels" className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.01em]">
            <BedDouble className="size-5 text-muted-foreground" aria-hidden /> Where you&apos;re staying
          </h2>
          {s.hotels.length ? (
            <ul className="mt-5 space-y-4">
              {s.hotels.map((hotel, i) => (
                <li key={i} className="overflow-hidden rounded-2xl border bg-card sm:flex">
                  <div className="h-36 sm:h-auto sm:w-44 sm:shrink-0">
                    <HotelCover name={hotel.name} rounded={false} />
                  </div>
                  <div className="flex-1 p-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-[16px] font-semibold">{hotel.name}</h3>
                      <Stars category={hotel.category} />
                    </div>
                    <p className="text-[13px] text-muted-foreground">{hotel.address ?? hotel.location}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-[13.5px]">
                      <div>
                        <dt className="text-[12px] text-muted-foreground">Check-in</dt>
                        <dd className="font-medium">
                          {fmtDow(hotel.checkIn)}, {fmtTime(hotel.checkInTime)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[12px] text-muted-foreground">Check-out</dt>
                        <dd className="font-medium">
                          {fmtDow(hotel.checkOut)}, {fmtTime(hotel.checkOutTime)}
                        </dd>
                      </div>
                    </dl>
                    {hotel.rooms.length ? <p className="mt-3 text-[13.5px]">{hotel.rooms.map((r) => `${r.quantity} × ${r.name} · ${MEAL_PLAN_LABEL[r.mealPlan as MealPlanValue]}`).join("; ")}</p> : null}
                    <p className="mt-2 text-[12.5px] text-muted-foreground">
                      {hotel.confirmed ? `Booking confirmed${hotel.confirmationNumber ? ` · Ref ${hotel.confirmationNumber}` : ""}` : "Booking confirmation in progress"}
                      {hotel.phone ? ` · ${hotel.phone}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">Accommodation details will appear here.</p>
          )}
        </section>

        <section id="transport" aria-labelledby="h-transport" className="mt-12 scroll-mt-16">
          <h2 id="h-transport" className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.01em]">
            <Car className="size-5 text-muted-foreground" aria-hidden /> Transfers
          </h2>
          {s.transports.length ? (
            <ul className="mt-5 space-y-3">
              {s.transports.map((t, i) => (
                <li key={i} className="rounded-2xl border bg-card p-5">
                  <p className="text-[12.5px] text-muted-foreground">
                    {fmtDow(t.date)}
                    {t.time ? ` · ${fmtTime(t.time)}` : ""} · {TRANSPORT_KIND_LABEL[t.kind as TransportKindValue]}
                  </p>
                  <p className="mt-1 text-[15px] font-medium">
                    {t.pickup} → {t.dropoff}
                  </p>
                  {t.driverName || t.vehicle ? (
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
                      {t.vehicle || t.vehicleNumber ? <span>{[t.vehicle, t.vehicleNumber].filter(Boolean).join(" · ")}</span> : null}
                      {t.driverName ? (
                        <span>
                          Driver: {t.driverName}
                          {t.driverPhone ? (
                            <>
                              {" · "}
                              <a href={`tel:${t.driverPhone.replace(/\s/g, "")}`} className="font-medium text-primary underline-offset-2 hover:underline">
                                {t.driverPhone}
                              </a>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-2 text-[13px] text-muted-foreground">Driver details will be shared before pickup.</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">No transfers are booked.</p>
          )}
        </section>

        <section id="documents" aria-labelledby="h-docs" className="mt-12 scroll-mt-16">
          <h2 id="h-docs" className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.01em]">
            <FileText className="size-5 text-muted-foreground" aria-hidden /> Documents
          </h2>
          {documents.length ? (
            <ul className="mt-5 divide-y rounded-2xl border bg-card">
              {documents.map((d) => (
                <li key={d.id}>
                  <a href={`/api/trip/${token}/documents/${d.id}?inline=1`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-5 py-4 hover:bg-muted/50">
                    <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{d.title}</span>
                      <span className="block text-[12.5px] text-muted-foreground">{DOCUMENT_KIND_LABEL[d.kind as DocumentKindValue]} · PDF</span>
                    </span>
                    <Download className="size-4 text-muted-foreground" aria-label="Open" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">Your travel documents will appear here once they&apos;re ready.</p>
          )}
        </section>

        <section id="contact" aria-labelledby="h-contact" className="mt-12 scroll-mt-16 rounded-2xl border bg-card p-6">
          <h2 id="h-contact" className="text-[18px] font-semibold">Questions? We&apos;re here.</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {s.agent.name ? `${s.agent.name} at ` : ""}
            {s.agency.name}
            {s.agency.address ? ` · ${s.agency.address}` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {phone ? (
              <a href={`tel:${phone}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[14px] font-medium text-primary-foreground">
                <Phone className="size-4" aria-hidden /> Call {s.agency.phone}
              </a>
            ) : null}
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-[14px] font-medium">
                <MessageCircle className="size-4" aria-hidden /> WhatsApp
              </a>
            ) : null}
            {s.agency.email ? (
              <a href={`mailto:${s.agency.email}?subject=${encodeURIComponent(`Trip ${s.trip.code}`)}`} className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-[14px] font-medium">
                <Mail className="size-4" aria-hidden /> Email
              </a>
            ) : null}
          </div>
        </section>

        <footer className="mt-10 text-center text-[12px] text-muted-foreground">
          Trip {s.trip.code} · Updated {fmtDateTime(updatedAt)} · This page always shows the latest version.
          <br />
          Powered by TRAVORA
        </footer>
      </main>
    </div>
  );
}

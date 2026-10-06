import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, FileLock2, History, KeyRound, Lock, Map as MapIcon, ServerCog, Users } from "lucide-react";
import nightMountains from "@/assets/landing/night-mountains.jpg";
import { Eyebrow, Heading } from "@/components/marketing/ui";
import { Wordmark } from "@/components/marketing/wordmark";
import { PLANS } from "@/lib/plans";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

export const CONTACT = "mailto:hello@travora.example?subject=TRAVORA%20workspace";

/* ====================================================================== */
/* Security / multi-tenancy                                               */
/* ====================================================================== */

// Agency names match the dev seed; records are fictional.
const AGENCIES = [
  { name: "ABC Travels", city: "New Delhi", trip: "TRV-10291 · Kashmir, slowly", guest: "Rahul Sharma +3", doc: "Invoice INV-2026-0418" },
  { name: "Kashmir Holidays", city: "Srinagar", trip: "TRV-20114 · Gurez valley", guest: "Ananya Rao +1", doc: "Voucher · Pine Retreat" },
  { name: "Paradise Tours", city: "Mumbai", trip: "TRV-30027 · Ladakh by road", guest: "Kabir Mehta +2", doc: "Itinerary · v1" },
];

const GUARANTEES = [
  [ServerCog, "Isolation enforced on the server", "Every query is scoped to the signed-in agency — never to an id the browser sends."],
  [KeyRound, "Rates stay yours", "Negotiated hotel rates are visible only to the agency they belong to."],
  [FileLock2, "Private guest documents", "IDs and PDFs live in private storage, streamed only to authorised users, and every view is logged."],
  [History, "A complete audit trail", "Who changed what, and when — per trip, per agency and platform-wide."],
] as const;

export function Security() {
  return (
    <section id="security" aria-labelledby="security-h" className="relative scroll-mt-16 border-t border-ivory/8 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end" data-reveal>
          <div>
            <Eyebrow index="08">Security</Eyebrow>
            <Heading id="security-h" className="mt-6" lead="Every agency gets" serif="a secure private workspace." />
          </div>
          <p className="max-w-[30rem] text-[16px] leading-[1.7] text-ivory/65 lg:justify-self-end">
            Your trips, guests, rates and documents belong to your agency alone. Other agencies on TRAVORA can&apos;t see them — not in search, not in reports, not by guessing a link.
          </p>
        </div>

        <div className="relative mt-16 sm:mt-24" data-reveal>
          {/* Platform rail */}
          <div className="hidden items-center gap-4 md:flex" aria-hidden>
            <span className="rule-fade flex-1" />
            <span className="text-[10.5px] tracking-[0.2em] text-ivory/60 uppercase">TRAVORA platform</span>
            <span className="rule-fade flex-1" />
          </div>
          <ul className="mt-0 grid grid-cols-1 gap-4 md:mt-8 md:grid-cols-3 md:gap-0" data-stagger>
            {AGENCIES.map((a, i) => (
              <li key={a.name} className={cn("relative md:px-5", i > 0 && "md:border-l md:border-dashed md:border-ivory/12")}>
                {i > 0 ? (
                  <span className="absolute top-1/2 -left-3 z-10 hidden size-6 -translate-y-1/2 place-items-center rounded-full border border-ivory/15 bg-ink text-ivory/60 md:grid" aria-hidden>
                    <Lock className="size-3" />
                  </span>
                ) : null}
                <div className="window">
                  <div className="flex items-center justify-between border-b border-ivory/8 px-4 py-3.5">
                    <div>
                      <p className="text-[14px] text-ivory">{a.name}</p>
                      <p className="text-[11.5px] text-ivory/60">{a.city} · private workspace</p>
                    </div>
                    <Lock className="size-3.5 text-sand" aria-label="Isolated" />
                  </div>
                  <dl className="divide-y divide-ivory/6 px-4 text-[12.5px]">
                    {[
                      [MapIcon, "Trips", a.trip],
                      [Users, "Guests", a.guest],
                      [FileLock2, "Documents", a.doc],
                    ].map(([Icon, k, v]) => {
                      const I = Icon as typeof MapIcon;
                      return (
                        <div key={String(k)} className="flex items-center gap-3 py-3">
                          <I className="size-3.5 shrink-0 text-ivory/60" aria-hidden />
                          <dt className="w-20 shrink-0 text-ivory/60">{String(k)}</dt>
                          <dd className="min-w-0 truncate text-ivory/85">{String(v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-[12px] text-ivory/60">No shared rows. No shared rates. No shared links.</p>
        </div>

        <ul className="mt-20 grid grid-cols-1 gap-x-10 gap-y-10 border-t border-ivory/8 pt-12 sm:grid-cols-2 lg:grid-cols-4" data-stagger>
          {GUARANTEES.map(([Icon, t, b]) => (
            <li key={t}>
              <Icon className="size-[18px] text-sand" aria-hidden />
              <p className="mt-4 text-[15px] text-ivory">{t}</p>
              <p className="mt-2 text-[13.5px] leading-[1.65] text-ivory/55">{b}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ====================================================================== */
/* Pricing — straight from src/lib/plans.ts                               */
/* ====================================================================== */

export function Pricing() {
  const tiers = PLANS.filter((p) => p.code !== "ENTERPRISE");
  const enterprise = PLANS.find((p) => p.code === "ENTERPRISE");
  return (
    <section id="pricing" aria-labelledby="pricing-h" className="relative scroll-mt-16 border-t border-ivory/8 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end" data-reveal>
          <div>
            <Eyebrow index="09">Pricing</Eyebrow>
            <Heading id="pricing-h" className="mt-6" lead="Simple." serif="Transparent pricing." />
          </div>
          <p className="max-w-[30rem] text-[16px] leading-[1.7] text-ivory/65 lg:justify-self-end">Per agency, billed monthly, excluding GST. A 14-day trial is available on every plan.</p>
        </div>

        <ul className="mt-16 grid grid-cols-1 gap-4 sm:mt-20 lg:grid-cols-3" data-stagger>
          {tiers.map((p) => {
            const featured = p.code === "PROFESSIONAL";
            return (
              <li
                key={p.code}
                className={cn(
                  "group relative flex flex-col rounded-[18px] border p-7 transition-[border-color,translate,background-color] duration-500 hover:-translate-y-1 sm:p-8",
                  featured ? "border-sand/35 bg-[linear-gradient(180deg,rgb(205_186_148/0.07),transparent_60%)]" : "border-ivory/10 bg-ivory/[0.015] hover:border-ivory/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-medium tracking-[0.2em] text-ivory/80 uppercase">{p.name}</h3>
                  {featured ? <span className="text-[11px] text-sand">For growing teams</span> : null}
                </div>
                <p className="mt-8 flex items-baseline gap-1.5">
                  <span className="serif text-[52px] leading-none text-ivory tabular">{formatINR(p.priceMonthly)}</span>
                  <span className="text-[13px] text-ivory/60">/ month</span>
                </p>
                <p className="mt-3 text-[13px] text-ivory/55">
                  Up to {p.maxUsers} users · {p.maxTripsMonthly ? `${p.maxTripsMonthly} trips a month` : "Unlimited trips"}
                </p>
                <ul className="mt-8 flex-1 space-y-3 border-t border-ivory/8 pt-6 text-[14px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-3 text-ivory/80">
                      <Check className="mt-0.5 size-4 shrink-0 text-sand/80" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="#cta" className={cn("mt-9", featured ? "btn-ivory" : "btn-line")} aria-label={`Get started with ${p.name}`}>
                  Get started
                </a>
              </li>
            );
          })}
        </ul>

        {enterprise ? (
          <div className="mt-4 flex flex-col gap-5 rounded-[18px] border border-ivory/10 px-7 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8" data-reveal>
            <div>
              <h3 className="text-[12px] font-medium tracking-[0.2em] text-ivory/80 uppercase">{enterprise.name}</h3>
              <p className="mt-2 text-[14px] text-ivory/60">
                {formatINR(enterprise.priceMonthly)} / month · up to {enterprise.maxUsers} users · {enterprise.features.slice(1).join(" · ")}
              </p>
            </div>
            <a href={CONTACT} className="link-arrow inline-flex shrink-0 items-center gap-2 text-[14px] text-ivory hover:text-sand">
              Talk to us <ArrowRight className="arrow size-4" aria-hidden />
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ====================================================================== */
/* Resources — questions                                                  */
/* ====================================================================== */

const FAQ = [
  ["Is TRAVORA a booking website for travellers?", "No. TRAVORA is software for travel agencies. Your guests never browse inventory; they receive a private trip page from you."],
  ["Can other agencies see my guests or rates?", "Never. Each agency has an isolated workspace, enforced on the server for every request. Negotiated hotel rates are visible only to the agency they belong to."],
  ["Do my guests need an app or an account?", "No. Each trip gets a secure private link. It works on any phone and always shows the latest version you've published."],
  ["What happens when I change the itinerary after sending it?", "Your edits stay private until you publish an update. The guest page then switches to the new version, and you can email the guest that it changed."],
  ["Can I take online payments?", "Payments are recorded manually today, with totals and receipts calculated for you. Online collection via Razorpay is on the roadmap."],
  ["How do we get started?", "Your TRAVORA administrator creates your agency workspace, assigns hotels and sends your login — then you can build and send your first trip."],
];

export function Questions() {
  return (
    <section id="resources" aria-labelledby="faq-h" className="relative scroll-mt-16 border-t border-ivory/8 px-4 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div data-reveal>
          <Eyebrow index="10">Resources</Eyebrow>
          <Heading id="faq-h" className="mt-6" lead="Questions," serif="answered." />
          <p className="mt-6 max-w-[24rem] text-[15px] leading-[1.7] text-ivory/60">
            Something else on your mind?{" "}
            <a href={CONTACT} className="text-ivory underline decoration-ivory/30 underline-offset-4 hover:decoration-sand">
              Write to us
            </a>
            .
          </p>
        </div>
        <div className="border-t border-ivory/10" data-reveal>
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-ivory/10">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[16px] text-ivory/90 transition-colors hover:text-ivory sm:text-[17px]">
                {q}
                <span className="relative size-4 shrink-0 text-ivory/60" aria-hidden>
                  <span className="absolute top-1/2 left-0 h-px w-4 bg-current" />
                  <span className="absolute top-0 left-1/2 h-4 w-px bg-current transition-transform duration-300 group-open:scale-y-0" />
                </span>
              </summary>
              <p className="max-w-[40rem] pb-7 text-[15px] leading-[1.7] text-ivory/60">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ====================================================================== */
/* Final CTA                                                              */
/* ====================================================================== */

export function FinalCta() {
  return (
    <section id="cta" aria-labelledby="cta-h" className="relative isolate flex min-h-[100svh] scroll-mt-0 items-center overflow-hidden px-4 py-32 sm:px-8">
      <div className="absolute inset-0 -z-10">
        <div className="scroll-drift absolute inset-0">
          <Image src={nightMountains} alt="" placeholder="blur" fill sizes="100vw" className="object-cover [filter:saturate(0.7)_brightness(0.7)]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/30 to-ink" />
        <div className="vignette absolute inset-0" />
      </div>
      <div className="mx-auto max-w-[900px] text-center" data-reveal>
        <p className="eyebrow">Everything behind every great journey.</p>
        <h2 id="cta-h" className="display mt-7 text-[42px] text-ivory sm:text-[64px] lg:text-[84px]">
          <span className="block">Your next trip</span>
          <span className="serif block text-[1.12em] leading-[0.98]">should run differently.</span>
        </h2>
        <p className="mx-auto mt-7 max-w-[30rem] text-[16px] leading-[1.7] text-ivory/70">
          Tell us about your agency and we&apos;ll set up your workspace — hotels assigned, login sent. Already have one? Sign in.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={CONTACT} className="btn-ivory">
            Start with TRAVORA <ArrowRight className="arrow size-4" aria-hidden />
          </a>
          <Link href="/login" className="btn-line">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ====================================================================== */
/* Footer                                                                 */
/* ====================================================================== */

const FOOTER: [string, [string, string][]][] = [
  [
    "Product",
    [
      ["Features", "#product"],
      ["How it works", "#how-it-works"],
      ["Pricing", "#pricing"],
      ["Security", "#security"],
    ],
  ],
  [
    "Resources",
    [
      ["Questions", "#resources"],
      ["Sign in", "/login"],
    ],
  ],
  ["Company", [["Contact", CONTACT]]],
];

export function Footer() {
  return (
    <footer className="border-t border-ivory/8 px-4 pt-20 pb-10 sm:px-8">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))]">
          <div>
            <Wordmark />
            <p className="serif mt-5 max-w-[18rem] text-[22px] leading-snug text-ivory/80">The operating system for travel agencies.</p>
          </div>
          {FOOTER.map(([title, links]) => (
            <nav key={title} aria-label={title}>
              <p className="text-[11px] tracking-[0.2em] text-ivory/60 uppercase">{title}</p>
              <ul className="mt-5 space-y-3 text-[14px]">
                {links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("/") ? (
                      <Link href={href} className="text-ivory/70 transition-colors hover:text-ivory">
                        {label}
                      </Link>
                    ) : (
                      <a href={href} className="text-ivory/70 transition-colors hover:text-ivory">
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-20 flex flex-col gap-3 border-t border-ivory/8 pt-6 text-[12px] text-ivory/60 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} TRAVORA. All rights reserved.</p>
          <p>
            Photography via Unsplash — Muazam Mohi ud din, Isa, Marek Piwnicki.
          </p>
        </div>
      </div>
    </footer>
  );
}

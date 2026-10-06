import Image from "next/image";
import { ArrowRight, Share2 } from "lucide-react";
import heroImage from "@/assets/landing/hero-dal-lake.jpg";
import { NAV } from "@/components/shell/nav";
import { TRIP_TABS } from "@/components/trips/command/tabs-nav";
import { AppWindow, Label, Meter, StatusPill, TypeIcon } from "@/components/marketing/ui";
import { CHECKLIST, PAY, TRIP, TRIP_DATES, TRIP_ROUTE, TRIP_TRAVELLERS, money } from "@/components/marketing/data";
import { fmtDow } from "@/lib/dates";
import { cn } from "@/lib/utils";

// Real product facts, not vanity numbers.
const FACTS = [
  ["10", "steps", "From enquiry to a sent itinerary"],
  ["3", "views", "Admin, agent and guest — one trip"],
  ["1", "link", "A private guest page. No app, no login."],
] as const;

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-h" className="relative pb-24 sm:pb-36">
      {/* Environment */}
      <div className="absolute inset-x-0 top-0 h-[112svh] min-h-[860px] overflow-hidden sm:h-[124svh] sm:min-h-[1000px]">
        <div className="hero-parallax absolute inset-0 origin-top">
          <Image
            src={heroImage}
            alt="A shikara crossing Dal Lake at dusk below Hari Parbat, Srinagar"
            fill
            preload
            placeholder="blur"
            sizes="100vw"
            className="load-image object-cover object-[70%_60%] [filter:saturate(0.78)_brightness(0.92)_contrast(1.04)] sm:object-[60%_60%]"
          />
        </div>
        {/* Grade: cool the orange, darken for type, fade into the page. */}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(11_12_11/0.82)_0%,rgb(11_12_11/0.45)_36%,rgb(11_12_11/0)_62%)] max-lg:bg-[linear-gradient(180deg,rgb(11_12_11/0.4)_0%,rgb(11_12_11/0.12)_25%,rgb(11_12_11/0.7)_60%)]" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-b from-transparent via-ink/80 to-ink" aria-hidden />
        <div className="vignette absolute inset-0" aria-hidden />
        <p className="load-fade absolute top-[clamp(120px,22vh,210px)] right-4 hidden text-[10.5px] tracking-[0.2em] text-ivory/60 uppercase [--d:1600ms] sm:right-8 lg:block">Dal Lake, Srinagar · 34.09° N</p>
      </div>

      {/* Copy */}
      <div className="relative mx-auto max-w-[1384px] px-4 pt-[clamp(120px,22vh,210px)] sm:px-8">
        <div>
          <p className="eyebrow load-up [--d:150ms]">Travel operations, finally organized.</p>
          <h1 id="hero-h" className="display load-up mt-6 text-[42px] text-ivory [--d:280ms] sm:text-[64px] lg:text-[76px]">
            <span className="block">The Operating System</span>
            <span className="block">
              <span className="text-ivory/80">for </span>
              <span className="serif text-[1.16em] leading-[0.95]">Travel Agencies.</span>
            </span>
          </h1>
          <p className="load-up mt-7 max-w-[30rem] text-[16.5px] leading-[1.6] text-ivory/75 [--d:420ms] sm:text-[18px]">
            Plan trips. Coordinate suppliers. Manage guests. Get paid. Everything your agency needs to run every journey.
          </p>
          <div className="load-up mt-9 flex flex-col gap-3 [--d:540ms] sm:flex-row sm:items-center">
            <a href="#cta" className="btn-ivory">
              Start building trips <ArrowRight className="arrow size-4" aria-hidden />
            </a>
            <a href="#how-it-works" className="btn-line">
              See how it works
            </a>
          </div>
          <dl className="mt-14 grid max-w-[560px] grid-cols-3 gap-4 border-t border-ivory/10 pt-6 sm:gap-8">
            {FACTS.map(([n, unit, body], i) => (
              <div key={unit} className="load-up" style={{ "--d": `${760 + i * 90}ms` } as React.CSSProperties}>
                <dt className="sr-only">{`${n} ${unit}`}</dt>
                <dd>
                  <p className="text-[26px] leading-none tracking-[-0.03em] text-ivory sm:text-[30px]" aria-hidden>
                    {n}
                    <span className="serif ml-1.5 text-[0.72em] text-sand">{unit}</span>
                  </p>
                  <p className="mt-2 text-[12px] leading-snug text-ivory/60 sm:text-[12.5px]">{body}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Product */}
      <div className="relative mx-auto mt-16 max-w-[1304px] px-4 sm:mt-24 sm:px-8">
        <div className="load-rise [--d:700ms]">
          <div className="scroll-settle origin-top">
            <HeroWindow />
          </div>
        </div>
        <p className="mt-4 text-center text-[11.5px] text-ivory/60">Trip Command Center · illustrative trip, fictional guest</p>
      </div>
    </section>
  );
}

function HeroWindow() {
  const pending = PAY.total - PAY.paid;
  return (
    <AppWindow crumbs={[TRIP.agency, "Trips", TRIP.code]}>
      <div className="grid grid-cols-1 @[900px]:grid-cols-[188px_minmax(0,1fr)]">
        {/* Real agent navigation */}
        <aside className="hidden border-r border-ivory/8 p-3 @[900px]:block" aria-hidden>
          <ul className="space-y-0.5 text-[12.5px]">
            {NAV.agent.slice(0, 8).map((n) => (
              <li key={n.href} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5", n.label === "Trips" ? "bg-ivory/[0.06] text-ivory" : "text-ivory/60")}>
                <n.icon className="size-3.5" />
                {n.label}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-lg border border-ivory/8 p-3">
            <Label>Today</Label>
            <p className="mt-2 text-[12px] text-ivory/80">3 arrivals · 2 check-ins</p>
            <p className="mt-0.5 text-[11.5px] text-ivory/60">1 driver to assign</p>
          </div>
        </aside>

        <div className="min-w-0">
          {/* Header */}
          <div className="flex flex-wrap items-start gap-4 px-4 pt-5 @[600px]:px-6">
            <div className="min-w-0 flex-1 load-fade [--d:1100ms]">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11.5px] text-ivory/55">{TRIP.code}</span>
                <StatusPill>{TRIP.statusLabel}</StatusPill>
              </div>
              <p className="mt-2 text-[21px] font-medium tracking-[-0.02em] text-ivory @[600px]:text-[24px]">{TRIP.guest.name}</p>
              <p className="mt-1 text-[12.5px] text-ivory/60">
                {TRIP_DATES} <span className="px-1 text-ivory/55">·</span> {TRIP_ROUTE} <span className="px-1 text-ivory/55">·</span> {TRIP_TRAVELLERS}
              </p>
            </div>
            <div className="hidden items-center gap-2 @[600px]:flex load-fade [--d:1200ms]" aria-hidden>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ivory/12 px-3 text-[12px] text-ivory/75">
                <Share2 className="size-3.5" /> Trip page
              </span>
              <span className="inline-flex h-8 items-center rounded-md bg-ivory px-3 text-[12px] font-medium text-ink">Publish update</span>
            </div>
          </div>
          <div className="scrollbar-none mt-4 overflow-x-auto border-b border-ivory/8 px-4 @[600px]:px-6" aria-hidden>
            <ul className="flex min-w-max gap-5 text-[12.5px]">
              {TRIP_TABS.map(([key, label]) => (
                <li key={key} className={cn("relative pb-2.5", key === "overview" ? "text-ivory after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-sand" : "text-ivory/60")}>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 gap-4 p-4 @[700px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] @[600px]:p-6">
            <div className="panel p-4">
              <div className="flex items-baseline justify-between gap-3">
                <Label>Day 01 — Arrival in Srinagar</Label>
                <span className="shrink-0 text-[11px] text-ivory/60">{fmtDow(TRIP.startDate)}</span>
              </div>
              <ol className="relative mt-4 space-y-3.5 before:absolute before:top-3 before:bottom-3 before:left-[62px] before:w-px before:bg-ivory/8">
                {TRIP.day1.map((it, i) => (
                  <li key={it.time} className="load-fade relative flex items-center gap-3" style={{ "--d": `${1300 + i * 110}ms` } as React.CSSProperties}>
                    <span className="w-11 shrink-0 text-right font-mono text-[11.5px] text-ivory/55 tabular">{it.time}</span>
                    <TypeIcon type={it.type} className="relative bg-[#121411]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-ivory/90">{it.title}</span>
                      <span className="block truncate text-[11.5px] text-ivory/60">{it.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 flex items-center justify-between border-t border-ivory/8 pt-3.5 text-[11.5px] text-ivory/60">
                <span>Next · Day 02 — Mughal gardens, old city</span>
                <span className="text-ivory/60">3 items</span>
              </p>
            </div>
            <div className="space-y-4">
              <div className="panel p-4 load-fade [--d:1500ms]">
                <Label>Confirmed vs pending</Label>
                <ul className="mt-3 space-y-3">
                  {CHECKLIST.map((c) => (
                    <li key={c.label}>
                      <p className="flex items-center justify-between text-[12.5px]">
                        <span className="text-ivory/80">{c.label}</span>
                        <span className="tabular text-ivory/60">{c.value}</span>
                      </p>
                      <span className="mt-1.5 block">
                        <Meter ratio={c.ratio} tone={c.ratio === 1 ? "moss" : "sand"} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel p-4 load-fade [--d:1650ms]">
                <Label>Needs attention</Label>
                <p className="mt-2.5 text-[12.5px] text-ivory/85">Driver not assigned</p>
                <p className="text-[11.5px] text-ivory/60">Gulmarg → Pahalgam · Day 5</p>
                <p className="mt-2.5 text-[12.5px] text-ivory/85">Balance due {money(pending)}</p>
                <p className="text-[11.5px] text-ivory/60">Before departure</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

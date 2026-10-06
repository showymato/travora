import type { CSSProperties } from "react";
import { BedDouble, CreditCard, FileText, Handshake, MessageSquare, Route, Users, type LucideIcon } from "lucide-react";
import { Eyebrow, Heading } from "@/components/marketing/ui";
import { Wordmark } from "@/components/marketing/wordmark";

const NODES: [string, string, LucideIcon][] = [
  ["Guests", "Profiles, IDs, preferences, history", Users],
  ["Hotels", "Your catalogue at your negotiated rates", BedDouble],
  ["Suppliers", "Drivers, transfers and activities", Handshake],
  ["Itinerary", "Built from real bookings, day by day", Route],
  ["Payments", "Advances, balances, receipts", CreditCard],
  ["Documents", "Itineraries, vouchers, invoices", FileText],
  ["Communications", "Guest emails and the live trip page", MessageSquare],
];

// Points on an ellipse around the centre, starting at the top.
const POINTS = NODES.map((_, i) => {
  const a = (-90 + (i * 360) / NODES.length) * (Math.PI / 180);
  return { x: 50 + 41 * Math.cos(a), y: 50 + 40 * Math.sin(a) };
});

export function SystemMap() {
  return (
    <section id="product" aria-labelledby="solution-h" className="relative scroll-mt-20 overflow-hidden px-4 py-20 sm:px-8 sm:py-24">
      <div className="grid-fine pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_55%_at_50%_55%,black,transparent)]" aria-hidden />
      <div className="relative mx-auto max-w-[1320px]">
        <div className="mx-auto max-w-[760px] text-center" data-reveal>
          <Eyebrow index="02" className="justify-center">
            The solution
          </Eyebrow>
          <Heading id="solution-h" className="mt-6" lead="Everything around the trip." serif="Finally connected." />
          <p className="mx-auto mt-7 max-w-[34rem] text-[16px] leading-[1.7] text-ivory/65">
            Guests, hotels, suppliers, payments, documents and more — all in one workspace, built for travel agencies. Enter something once and it flows everywhere it&apos;s needed.
          </p>
        </div>

        {/* Desktop: radial architecture */}
        <div data-reveal="fade" className="relative mx-auto mt-20 hidden aspect-[16/9] max-w-[1100px] md:block">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
            <ellipse cx="50" cy="50" rx="41" ry="40" fill="none" stroke="rgb(244 239 229 / 0.06)" vectorEffect="non-scaling-stroke" />
            <ellipse cx="50" cy="50" rx="22" ry="21" fill="none" stroke="rgb(244 239 229 / 0.05)" vectorEffect="non-scaling-stroke" />
            {POINTS.map((p, i) => (
              <g key={i}>
                <line x1="50" y1="50" x2={p.x} y2={p.y} stroke="rgb(244 239 229 / 0.1)" vectorEffect="non-scaling-stroke" />
                <line x1="50" y1="50" x2={p.x} y2={p.y} stroke="rgb(205 186 148 / 0.55)" vectorEffect="non-scaling-stroke" className="flow-line" style={{ animationDelay: `${i * -0.4}s` }} />
              </g>
            ))}
          </svg>
          <div className="absolute top-1/2 left-1/2 grid size-[168px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-ivory/12 bg-[radial-gradient(circle_at_50%_35%,#1b1d19,#0d0f0c)] shadow-[0_0_0_10px_rgb(244_239_229/0.02),0_30px_60px_-20px_rgb(0_0_0/0.9)]">
            <div className="text-center">
              <Wordmark className="flex-col gap-2" />
              <p className="mt-2 text-[10.5px] tracking-[0.16em] text-ivory/60 uppercase">One trip record</p>
            </div>
          </div>
          <ul data-stagger>
            {NODES.map(([name, body, Icon], i) => (
              <li
                key={name}
                className="absolute w-[200px] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${POINTS[i].x}%`, top: `${POINTS[i].y}%` } as CSSProperties}
              >
                <div className="rounded-xl border border-ivory/10 bg-ink-3/95 px-4 py-3 shadow-[0_20px_40px_-24px_rgb(0_0_0/0.9)] backdrop-blur transition-colors duration-500 hover:border-sand/35">
                  <p className="flex items-center gap-2 text-[13.5px] text-ivory">
                    <Icon className="size-3.5 text-sand" aria-hidden />
                    {name}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-snug text-ivory/55">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile: a spine with branches */}
        <div className="relative mx-auto mt-14 max-w-md md:hidden">
          <div className="mx-auto grid size-28 place-items-center rounded-full border border-ivory/12 bg-ink-3">
            <Wordmark className="flex-col gap-1.5" />
          </div>
          <ul data-stagger className="relative mt-6 space-y-3 before:absolute before:top-0 before:bottom-6 before:left-5 before:w-px before:bg-ivory/10">
            {NODES.map(([name, body, Icon]) => (
              <li key={name} className="relative flex items-start gap-4 pl-0">
                <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-ivory/12 bg-ink">
                  <Icon className="size-4 text-sand" aria-hidden />
                </span>
                <span className="pt-1">
                  <span className="block text-[14.5px] text-ivory">{name}</span>
                  <span className="block text-[12.5px] text-ivory/55">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

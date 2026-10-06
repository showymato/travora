"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, Check, FileText, Link2, Mail } from "lucide-react";
import { Eyebrow, Heading, Label, Meter, StatusPill, TypeIcon } from "@/components/marketing/ui";
import { cn } from "@/lib/utils";

const STAGES: { title: string; body: string; preview: ReactNode }[] = [
  {
    title: "Lead capture",
    body: "An enquiry becomes a guest record in the first step of a trip — contact, preferences and travellers, captured once.",
    preview: <LeadPreview />,
  },
  {
    title: "Trip creation",
    body: "A ten-step wizard that saves as you go. Dates flow into stays, stays into rooms, rooms into the itinerary.",
    preview: <WizardPreview />,
  },
  {
    title: "Itinerary builder",
    body: "Days are generated from real hotels, transfers and activities. Templates fill the gaps; you drag to refine.",
    preview: <DayPreview />,
  },
  {
    title: "Supplier coordination",
    body: "Every hotel, driver and activity shows what's confirmed and what's still pending — before the guest asks.",
    preview: <SupplierPreview />,
  },
  {
    title: "Payment tracking",
    body: "Record advances and balances. Totals, pending amounts and receipts update themselves.",
    preview: <PaymentPreview />,
  },
  {
    title: "Document generation",
    body: "Itineraries, vouchers, invoices and receipts — generated as branded PDFs from the same trip.",
    preview: <DocsPreview />,
  },
  {
    title: "Guest experience",
    body: "Send a private trip page. Later edits stay private until you publish an update, and the guest can be emailed.",
    preview: <GuestPreview />,
  },
  {
    title: "Departure & follow-up",
    body: "“Starts tomorrow” alerts, reminders and status roll-over run every day, so nothing waits on memory.",
    preview: <DeparturePreview />,
  },
];

export function Lifecycle() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  // Desktop: the active stage follows scroll position through a sticky panel.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      setProgress(p);
      setActive(Math.min(STAGES.length - 1, Math.floor(p * STAGES.length)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const goTo = (i: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + ((i + 0.5) / STAGES.length) * span, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section id="how-it-works" aria-labelledby="lifecycle-h" className="relative scroll-mt-16 border-t border-ivory/8">
      {/* ≥ lg: sticky horizontal lifecycle */}
      <div ref={sectionRef} className="relative hidden h-[460vh] lg:block">
        <div className="sticky top-0 flex h-screen min-h-[640px] flex-col justify-center px-8">
          <div className="mx-auto w-full max-w-[1320px]">
            <div className="flex items-end justify-between gap-10">
              <div>
                <Eyebrow index="03">How it works</Eyebrow>
                <Heading id="lifecycle-h" className="mt-5" lead="From lead" serif="to departure." />
              </div>
              <p className="pb-2 font-mono text-[12px] text-ivory/60 tabular" aria-live="polite">
                <span className="text-ivory">{String(active + 1).padStart(2, "0")}</span> / {String(STAGES.length).padStart(2, "0")}
              </p>
            </div>

            <ol className="relative mt-14 grid grid-cols-8">
              <span className="absolute top-[7px] right-[6.25%] left-[6.25%] h-px bg-ivory/10" aria-hidden />
              <span
                className="absolute top-[7px] left-[6.25%] h-px bg-sand/70 transition-[width] duration-300"
                style={{ width: `${Math.min(1, progress * (STAGES.length / (STAGES.length - 1))) * 87.5}%` }}
                aria-hidden
              />
              {STAGES.map((s, i) => (
                <li key={s.title} data-active={i === active} data-done={i < active} className="relative">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === active ? "step" : undefined}
                    className="group flex w-full flex-col items-center gap-4 rounded-md text-center"
                  >
                    <span className="stage-dot size-[15px] rounded-full border border-ivory/25 bg-ink" aria-hidden />
                    <span className={cn("px-1 text-[12.5px] leading-snug transition-colors duration-500", i === active ? "text-ivory" : "text-ivory/60 group-hover:text-ivory/75")}>
                      <span className="block font-mono text-[10.5px] text-ivory/60">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="relative mt-14 h-[300px]">
              {STAGES.map((s, i) => (
                <div
                  key={s.title}
                  aria-hidden={i !== active}
                  className={cn("stage-preview absolute inset-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-16", i === active ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0")}
                >
                  <div>
                    <h3 className="serif text-[40px] leading-none text-ivory">{s.title}</h3>
                    <p className="mt-5 max-w-[26rem] text-[15.5px] leading-[1.7] text-ivory/65">{s.body}</p>
                  </div>
                  <div className="window p-5">{s.preview}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* < lg: vertical lifecycle */}
      <div className="px-4 py-20 sm:px-8 sm:py-24 lg:hidden">
        <div data-reveal>
          <Eyebrow index="03">How it works</Eyebrow>
          <Heading id="lifecycle-h-m" className="mt-5" lead="From lead" serif="to departure." />
        </div>
        <ol className="relative mt-14 space-y-12 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-ivory/10">
          {STAGES.map((s, i) => (
            <li key={s.title} data-reveal className="relative pl-10">
              <span className="absolute top-1.5 left-0 size-[15px] rounded-full border border-sand/60 bg-ink" aria-hidden />
              <p className="font-mono text-[11px] text-ivory/60">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="serif mt-1 text-[30px] leading-none text-ivory">{s.title}</h3>
              <p className="mt-3 text-[14.5px] leading-[1.65] text-ivory/65">{s.body}</p>
              <div className="window mt-5 p-4" aria-hidden>
                {s.preview}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Stage previews (decorative; the stage text carries the meaning) ---------- */

function Row({ k, v, tone }: { k: string; v: string; tone?: "ok" | "warn" }) {
  return (
    <p className="flex items-center justify-between gap-3 border-b border-ivory/6 py-2 text-[12.5px] last:border-0">
      <span className="truncate text-ivory/75">{k}</span>
      {tone ? <StatusPill tone={tone}>{v}</StatusPill> : <span className="shrink-0 text-ivory/55">{v}</span>}
    </p>
  );
}

function LeadPreview() {
  return (
    <div>
      <Label>New trip · Step 1 — Guest</Label>
      <div className="mt-3 grid grid-cols-2 gap-2.5 text-[12px]">
        {[
          ["Guest", "Priya Nair"],
          ["Phone", "+91 98•• ••• 532"],
          ["Travellers", "2 Adults"],
          ["Interest", "Kashmir · October"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-ivory/10 px-2.5 py-2">
            <p className="text-[10.5px] text-ivory/60">{k}</p>
            <p className="mt-0.5 truncate text-ivory/90">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] text-ivory/60">Returning guest? Their history and preferences load automatically.</p>
    </div>
  );
}

function WizardPreview() {
  const steps = ["Guest", "Dates", "Destinations", "Hotels", "Rooms", "Transport", "Activities", "Itinerary", "Review", "Send"];
  return (
    <div>
      <Label>Trip wizard · draft saved</Label>
      <ol className="mt-3 grid grid-cols-5 gap-1.5">
        {steps.map((s, i) => (
          <li key={s} className={cn("rounded-md border px-2 py-1.5 text-[11px]", i < 3 ? "border-moss/30 text-[#9cc3a5]" : i === 3 ? "border-sand/50 text-sand" : "border-ivory/8 text-ivory/60")}>
            <span className="block font-mono text-[9.5px] opacity-70">{String(i + 1).padStart(2, "0")}</span>
            <span className="block truncate">{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11.5px] text-ivory/60">Close the browser mid-way and pick up exactly where you left off.</p>
    </div>
  );
}

function DayPreview() {
  return (
    <div>
      <Label>Day 03 — Gulmarg</Label>
      <ul className="mt-3 space-y-2">
        {[
          ["09:00", "TRANSPORT", "Srinagar → Gulmarg", "Bashir A. · Innova"],
          ["12:00", "HOTEL_CHECK_IN", "Check-in · Royal Kashmir", "Deluxe Mountain View · MAP"],
          ["14:30", "ACTIVITY", "Gondola, Phase 1", "Tickets booked"],
        ].map(([t, type, a, b]) => (
          <li key={t} className="flex items-center gap-3 rounded-md border border-ivory/8 px-2.5 py-2">
            <span className="w-10 font-mono text-[11px] text-ivory/60">{t}</span>
            <TypeIcon type={type} />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] text-ivory/90">{a}</span>
              <span className="block truncate text-[11px] text-ivory/60">{b}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SupplierPreview() {
  return (
    <div>
      <Label>Suppliers · TRV-10291</Label>
      <div className="mt-2">
        <Row k="Blanco Hotel · 2 rooms" v="Confirmed" tone="ok" />
        <Row k="Royal Kashmir · 2 rooms" v="Confirmed" tone="ok" />
        <Row k="Airport transfer · Bashir A." v="Confirmed" tone="ok" />
        <Row k="Gulmarg → Pahalgam transfer" v="Driver pending" tone="warn" />
      </div>
    </div>
  );
}

function PaymentPreview() {
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <Label>Payments</Label>
          <p className="mt-2 text-[26px] tracking-[-0.02em] text-ivory">
            ₹1.2L <span className="text-[14px] text-ivory/60">of ₹1.6L</span>
          </p>
        </div>
        <StatusPill tone="warn">Partially paid</StatusPill>
      </div>
      <div className="mt-3">
        <Meter ratio={0.75} />
      </div>
      <div className="mt-3">
        <Row k="Advance · UPI · 22 Sep" v="₹80,000" />
        <Row k="Second instalment · Bank · 1 Oct" v="₹40,000" />
      </div>
    </div>
  );
}

function DocsPreview() {
  return (
    <div>
      <Label>Documents</Label>
      <ul className="mt-3 grid grid-cols-2 gap-2.5">
        {["Itinerary · v2", "Hotel vouchers · 3", "Invoice INV-2026-0418", "Payment receipt"].map((d) => (
          <li key={d} className="flex items-center gap-2.5 rounded-md border border-ivory/8 px-2.5 py-2.5 text-[12px] text-ivory/85">
            <FileText className="size-3.5 shrink-0 text-sand" />
            <span className="truncate">{d}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] text-ivory/60">Branded with your agency&apos;s details. Invoices split out 5% GST.</p>
    </div>
  );
}

function GuestPreview() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>Guest trip page</Label>
        <StatusPill tone="info">Version 2 published</StatusPill>
      </div>
      <p className="mt-3 flex items-center gap-2 rounded-md border border-ivory/10 px-3 py-2 font-mono text-[11.5px] text-ivory/70">
        <Link2 className="size-3.5 shrink-0 text-ivory/60" /> /trip/••••••••••••••••
      </p>
      <p className="mt-3 flex items-center justify-between text-[12.5px] text-ivory/75">
        <span className="flex items-center gap-2">
          <Mail className="size-3.5 text-ivory/60" /> Email the guest about this update
        </span>
        <span className="relative h-4 w-7 rounded-full bg-sand/80">
          <span className="absolute top-0.5 right-0.5 size-3 rounded-full bg-ink" />
        </span>
      </p>
    </div>
  );
}

function DeparturePreview() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3 rounded-md border border-ivory/8 px-3 py-2.5">
        <Bell className="mt-0.5 size-3.5 text-sand" />
        <div>
          <p className="text-[12.5px] text-ivory/90">TRV-10291 starts tomorrow</p>
          <p className="text-[11px] text-ivory/60">Guest reminder email queued · 4 travellers</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-ivory/60">
        <StatusPill>Confirmed</StatusPill>
        <span aria-hidden>→</span>
        <StatusPill tone="info">Ongoing</StatusPill>
        <span aria-hidden>→</span>
        <StatusPill tone="idle">Completed</StatusPill>
      </div>
      <p className="flex items-center gap-2 text-[11.5px] text-ivory/60">
        <Check className="size-3.5 text-moss" /> Status rolls over automatically every day
      </p>
    </div>
  );
}

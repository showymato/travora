import type { CSSProperties, ReactNode } from "react";
import { ArrowDown, ArrowRight, Check, CheckCheck, Clock3, FileText, PhoneMissed } from "lucide-react";
import { Eyebrow, Heading, Label } from "@/components/marketing/ui";
import { PAY, TRIP, TRIP_TRAVELLERS, money } from "@/components/marketing/data";
import { cn } from "@/lib/utils";

type Pos = { x: string; y: string; r: string; d: number; w: string };

/** A fragment sits in normal flow on small screens and is scattered on large ones. */
function Fragment({ pos, children, className }: { pos: Pos; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("fragment w-full xl:absolute xl:top-[var(--y)] xl:left-[var(--x)] xl:w-[var(--w)]", className)}
      style={{ "--x": pos.x, "--y": pos.y, "--r": pos.r, "--d": `${pos.d}ms`, "--w": pos.w } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function Problem() {
  return (
    <section aria-labelledby="problem-h" className="relative px-4 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end">
          <div data-reveal>
            <Eyebrow index="01">The problem</Eyebrow>
            <Heading id="problem-h" className="mt-6" lead="Most agencies run on" serif="WhatsApp, Excel and memory." />
          </div>
          <p data-reveal className="max-w-[30rem] text-[16px] leading-[1.7] text-ivory/65 [--d:120ms] lg:justify-self-end">
            A single trip lives in seven places: the enquiry in chat, rates in a spreadsheet, the itinerary in Word, vouchers as PDFs, the driver&apos;s number on a sticky note — and the calendar in someone&apos;s head. Every change is re-typed. Every handover risks a missed pickup.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 items-center gap-10 sm:mt-24 xl:grid-cols-[minmax(0,1.45fr)_auto_minmax(0,1fr)] xl:gap-8">
          {/* Chaos */}
          <div data-chaos className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 xl:block xl:h-[600px]" aria-label="Fragments of a trip spread across chat, spreadsheets, PDFs, email, calls and notes" role="img">
            <Fragment pos={{ x: "0%", y: "2%", r: "-2.5deg", d: 0, w: "300px" }}>
              <WhatsApp />
            </Fragment>
            <Fragment pos={{ x: "41%", y: "0%", r: "1.5deg", d: 80, w: "370px" }}>
              <Sheet />
            </Fragment>
            <Fragment pos={{ x: "52%", y: "44%", r: "-1deg", d: 160, w: "300px" }}>
              <Email />
            </Fragment>
            <Fragment pos={{ x: "3%", y: "56%", r: "2deg", d: 240, w: "250px" }}>
              <Pdf />
            </Fragment>
            <Fragment pos={{ x: "33%", y: "74%", r: "-3deg", d: 320, w: "220px" }}>
              <Voucher />
            </Fragment>
            <Fragment pos={{ x: "29%", y: "38%", r: "0deg", d: 400, w: "220px" }}>
              <MissedCall />
            </Fragment>
            <Fragment pos={{ x: "71%", y: "80%", r: "4deg", d: 480, w: "200px" }} className="sm:col-span-2 sm:max-w-[260px] xl:max-w-none">
              <StickyNote />
            </Fragment>
          </div>

          {/* Transition */}
          <div data-reveal className="flex flex-col items-center gap-3 text-ivory/60 [--d:500ms]" aria-hidden>
            <span className="serif text-[22px] text-sand italic">becomes</span>
            <span className="grid size-11 place-items-center rounded-full border border-ivory/15">
              <ArrowRight className="hidden size-4 xl:block" />
              <ArrowDown className="size-4 xl:hidden" />
            </span>
          </div>

          {/* Order */}
          <div data-reveal className="[--d:650ms]">
            <Record />
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatsApp() {
  const msgs: [string, boolean, string][] = [
    ["Sir kal 9:30 pickup confirm hai? Flight 6E-2134", false, "21:42"],
    ["Haan, 4 pax. Blanco Hotel drop", true, "21:44"],
    ["Gulmarg ke baad wali gaadi kaun dega??", false, "21:47"],
  ];
  return (
    <div className="paper-dark overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-ivory/8 px-3.5 py-2.5">
        <span className="grid size-7 place-items-center rounded-full bg-ivory/10 text-[10px] font-semibold text-ivory/80">BA</span>
        <div>
          <p className="text-[12.5px] text-ivory/90">Bashir — Driver</p>
          <p className="text-[10.5px] text-ivory/60">last seen today at 21:47</p>
        </div>
      </div>
      <div className="space-y-2 px-3 py-3">
        {msgs.map(([m, mine, t]) => (
          <p key={m} className={cn("max-w-[86%] rounded-lg px-2.5 py-1.5 text-[12px] leading-snug", mine ? "ml-auto bg-ivory/[0.09] text-ivory/90" : "bg-ivory/[0.04] text-ivory/80")}>
            {m}
            <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[9.5px] text-ivory/60">
              {t}
              {mine ? <CheckCheck className="size-3" aria-hidden /> : null}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

function Sheet() {
  const rows = [
    ["Sharma ×4", "Blanco", "10/10", "11500", "?"],
    ["Mehta ×2", "Hotel Grand", "12/10", "5200", "25000"],
    ["Sharma ×4", "Royal Kash.", "12/10", "#REF!", "—"],
    ["Iyer ×3", "Mountain Vw", "14/10", "6500", "pending"],
  ];
  return (
    <div className="paper overflow-hidden text-[11px]">
      <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.04] px-2.5 py-1.5">
        <span className="font-medium">Bookings_OCT_final_v4.xlsx</span>
        <span className="text-black/60">Sheet 3</span>
      </div>
      <table className="w-full table-fixed font-mono text-[10.5px]">
        <thead>
          <tr className="text-black/65">
            {["Guest", "Hotel", "In", "Rate", "Paid"].map((h) => (
              <th key={h} className="border-r border-b border-black/10 px-1.5 py-1 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={cn("truncate border-r border-b border-black/10 px-1.5 py-1", c === "#REF!" && "bg-black/10 font-semibold", c === "?" && "outline outline-1 -outline-offset-1 outline-black/60")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Email() {
  return (
    <div className="paper-dark p-3.5">
      <p className="text-[10.5px] text-ivory/60">reservations@ · 18:06</p>
      <p className="mt-1 text-[12.5px] font-medium text-ivory/90">Re: Fwd: Re: Room block 12–14 Oct</p>
      <p className="mt-1.5 text-[12px] leading-snug text-ivory/60">Please reconfirm the 2 rooms by 5 PM tomorrow, otherwise the block will be released. Rate as discussed on call.</p>
    </div>
  );
}

function Pdf() {
  return (
    <div className="paper p-3.5">
      <p className="flex items-center gap-2 text-[11px] font-medium">
        <FileText className="size-3.5" aria-hidden /> Itinerary_Sharma_FINAL (2).pdf
      </p>
      <div className="mt-3 space-y-1.5" aria-hidden>
        <span className="block h-1.5 w-3/4 rounded bg-black/15" />
        <span className="block h-1.5 w-full rounded bg-black/10" />
        <span className="block h-1.5 w-5/6 rounded bg-black/10" />
      </div>
      <p className="mt-3 text-[11px]">
        <span className="line-through decoration-black/60">Day 5 — Sonamarg</span>
        <span className="serif ml-1.5 text-[14px] italic">Pahalgam?</span>
      </p>
      <p className="mt-2 text-right text-[10px] text-black/60">Page 2 / 6</p>
    </div>
  );
}

function Voucher() {
  return (
    <div className="paper relative overflow-hidden border border-dashed border-black/25 p-3.5">
      <p className="text-[10px] tracking-[0.18em] text-black/60 uppercase">Hotel confirmation</p>
      <p className="mt-1 text-[12.5px] font-medium">Royal Kashmir, Gulmarg</p>
      <p className="text-[11px] text-black/60">2 rooms · 12–14 Oct · MAP</p>
      <span className="absolute right-3 bottom-3 rotate-[-10deg] rounded border-2 border-black/55 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-black/60">TENTATIVE</span>
    </div>
  );
}

function MissedCall() {
  return (
    <div className="paper-dark flex items-center gap-3 px-3.5 py-3">
      <span className="grid size-8 place-items-center rounded-full bg-terra/15 text-terra">
        <PhoneMissed className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12.5px] text-ivory/90">Royal Kashmir (3)</p>
        <p className="flex items-center gap-1 text-[10.5px] text-ivory/60">
          <Clock3 className="size-3" aria-hidden /> Missed call · 10:14
        </p>
      </div>
    </div>
  );
}

function StickyNote() {
  return (
    <div className="rounded-[3px] bg-[#d9cdb0] px-3.5 py-3 text-[#2a2619] shadow-[0_20px_30px_-16px_rgb(0_0_0/0.9)]">
      <p className="serif text-[17px] leading-tight italic">Bashir — 94190 5••••</p>
      <p className="serif text-[15px] leading-tight italic opacity-80">Pahalgam day 5 ?? ask Irfan</p>
    </div>
  );
}

function Record() {
  const rows: [string, string, boolean][] = [
    ["Guest", `${TRIP.guest.name} · ${TRIP_TRAVELLERS}`, true],
    ["Hotels", "3 of 3 confirmed", true],
    ["Transport", "2 of 3 drivers assigned", false],
    ["Itinerary", "Version 2 · sent to guest", true],
    ["Payments", `${money(PAY.paid)} of ${money(PAY.total)}`, false],
    ["Documents", "Itinerary, vouchers, invoice", true],
  ];
  return (
    <div className="window">
      <div className="flex items-center justify-between border-b border-ivory/8 px-5 py-4">
        <div>
          <Label>One record</Label>
          <p className="mt-1 text-[15px] text-ivory">
            <span className="font-mono text-[12.5px] text-ivory/55">{TRIP.code}</span> · {TRIP.title}
          </p>
        </div>
        <span className="text-[11px] text-ivory/60">Updated just now</span>
      </div>
      <ul className="divide-y divide-ivory/8" data-stagger>
        {rows.map(([k, v, ok]) => (
          <li key={k} className="flex items-center gap-3 px-5 py-3.5">
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", ok ? "bg-moss/15 text-[#9cc3a5]" : "border border-sand/40")}>
              {ok ? <Check className="size-3" aria-hidden /> : <span className="size-1.5 rounded-full bg-sand" aria-hidden />}
            </span>
            <span className="w-24 shrink-0 text-[12.5px] text-ivory/60">{k}</span>
            <span className="min-w-0 truncate text-[13px] text-ivory/90">{v}</span>
            <span className="sr-only">{ok ? "(done)" : "(pending)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

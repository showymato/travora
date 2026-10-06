import "server-only";
import path from "node:path";
import type { Styles } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { fmtDate, fmtDow, fmtDuration, fmtTime, nightsBetween, toISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import {
  HOTEL_CATEGORY_LABEL,
  ID_TYPE_LABEL,
  ITEM_TYPE_LABEL,
  MEAL_PLAN_LABEL,
  PAYMENT_METHOD_LABEL,
  TRANSPORT_KIND_LABEL,
  type HotelCategoryValue,
  type IdTypeValue,
  type ItemTypeValue,
  type MealPlanValue,
  type PaymentMethodValue,
  type TransportKindValue,
} from "@/lib/labels";
import type { PricedLine } from "@/lib/pricing";
import type { TripFull } from "../trips/queries";

// @react-pdf is ESM-only; load it lazily so CommonJS callers (seed, tests) work too.
type ReactPdf = typeof import("@react-pdf/renderer");
let P: ReactPdf;
let registered = false;
function registerFonts() {
  if (registered) return;
  const { Font } = P;
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), "assets", "fonts");
  Font.register({
    family: "Geist",
    fonts: [
      { src: path.join(dir, "Geist-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Geist-Medium.ttf"), fontWeight: 500 },
      { src: path.join(dir, "Geist-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

const styles = <T extends Styles>(t: T) => t;

const INK = "#141a2e";
const MUTED = "#5f6678";
const LINE = "#e3e5ec";
const BRAND = "#232c63";
const SOFT = "#f4f5f8";

const s = styles({
  page: { fontFamily: "Geist", fontSize: 9.5, color: INK, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 14, marginBottom: 18 },
  agency: { fontSize: 13, fontWeight: 600, color: BRAND },
  agencyMeta: { color: MUTED, fontSize: 8.5, marginTop: 3 },
  docKind: { fontSize: 8, letterSpacing: 1.2, color: MUTED, textAlign: "right" },
  docTitle: { fontSize: 18, fontWeight: 600, lineHeight: 1.3, marginBottom: 2 },
  sub: { color: MUTED, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: SOFT, borderRadius: 6, padding: 12, marginBottom: 18 },
  cell: { width: "33.3%", marginBottom: 6 },
  label: { fontSize: 7.5, color: MUTED, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 },
  value: { fontWeight: 500 },
  h2: { fontSize: 11.5, fontWeight: 600, marginTop: 8, marginBottom: 8 },
  dayHead: { flexDirection: "row", alignItems: "baseline", marginTop: 10, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 4 },
  dayNum: { fontSize: 8, fontWeight: 600, color: BRAND, letterSpacing: 1, width: 48 },
  dayTitle: { fontSize: 11, fontWeight: 600, flexGrow: 1 },
  dayDate: { color: MUTED, fontSize: 8.5 },
  item: { flexDirection: "row", marginBottom: 5 },
  time: { width: 48, color: MUTED, fontSize: 8.5 },
  itemBody: { flexGrow: 1, flexShrink: 1 },
  itemTitle: { fontWeight: 500 },
  itemMeta: { color: MUTED, fontSize: 8.5 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5 },
  th: { fontSize: 7.5, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase" },
  right: { textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", paddingTop: 4 },
  footer: { position: "absolute", bottom: 26, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", color: MUTED, fontSize: 7.5, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  box: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 12, marginBottom: 12 },
  note: { color: MUTED, fontSize: 8.5, marginTop: 10 },
});

type Ctx = { trip: TripFull; title: string; docTitle: string; number?: string | null };

function Shell({ ctx, kind, children }: { ctx: Ctx; kind: string; children: ReactNode }) {
  const a = ctx.trip.agency;
  const contact = [a.supportPhone ?? a.phone, a.supportEmail ?? a.email].filter(Boolean).join("  ·  ");
  return (
    <P.Document title={`${ctx.docTitle} — ${ctx.trip.code}`} author={a.name} creator="TRAVORA" producer="TRAVORA">
      <P.Page size="A4" style={s.page}>
        <P.View style={s.header} fixed>
          <P.View>
            <P.Text style={s.agency}>{a.name}</P.Text>
            <P.Text style={s.agencyMeta}>{contact}</P.Text>
            {a.address ? <P.Text style={s.agencyMeta}>{a.address}</P.Text> : null}
            {a.gstNumber ? <P.Text style={s.agencyMeta}>GSTIN {a.gstNumber}</P.Text> : null}
          </P.View>
          <P.View>
            <P.Text style={s.docKind}>{kind.toUpperCase()}</P.Text>
            <P.Text style={[s.docKind, { color: INK, fontWeight: 600, marginTop: 3 }]}>{ctx.number ?? ctx.trip.code}</P.Text>
          </P.View>
        </P.View>
        {children}
        <P.View style={s.footer} fixed>
          <P.Text>
            {ctx.trip.code} · {ctx.title}
          </P.Text>
          <P.Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </P.View>
      </P.Page>
    </P.Document>
  );
}

function Facts({ items }: { items: [string, string][] }) {
  return (
    <P.View style={s.grid}>
      {items.map(([k, v]) => (
        <P.View key={k} style={s.cell}>
          <P.Text style={s.label}>{k}</P.Text>
          <P.Text style={s.value}>{v || "—"}</P.Text>
        </P.View>
      ))}
    </P.View>
  );
}

function travellers(t: TripFull) {
  return [`${t.adults} adult${t.adults === 1 ? "" : "s"}`, t.children ? `${t.children} child${t.children === 1 ? "" : "ren"}` : "", t.infants ? `${t.infants} infant${t.infants === 1 ? "" : "s"}` : ""]
    .filter(Boolean)
    .join(", ");
}

function baseFacts(ctx: Ctx): [string, string][] {
  const t = ctx.trip;
  const n = nightsBetween(toISO(t.startDate), toISO(t.endDate));
  return [
    ["Guest", t.primaryGuest?.fullName ?? "—"],
    ["Trip", t.code],
    ["Travellers", travellers(t)],
    ["Arrival", t.startDate ? fmtDate(t.startDate) : "—"],
    ["Departure", t.endDate ? fmtDate(t.endDate) : "—"],
    ["Duration", n ? `${n} nights / ${n + 1} days` : "—"],
    ["Destinations", t.destinations.map((d) => d.name).join(" → ")],
  ];
}

function Itinerary({ ctx }: { ctx: Ctx }) {
  const t = ctx.trip;
  return (
    <Shell ctx={ctx} kind="Itinerary">
      <P.Text style={s.docTitle}>{ctx.title}</P.Text>
      <P.Text style={s.sub}>Prepared for {t.primaryGuest?.fullName ?? "our guest"}</P.Text>
      <Facts items={baseFacts(ctx)} />
      {t.days.map((d) => (
        <P.View key={d.id} wrap={false}>
          <P.View style={s.dayHead}>
            <P.Text style={s.dayNum}>DAY {d.dayNumber}</P.Text>
            <P.Text style={s.dayTitle}>{d.title ?? `Day ${d.dayNumber}`}</P.Text>
            <P.Text style={s.dayDate}>{fmtDow(d.date)}</P.Text>
          </P.View>
          {d.summary ? <P.Text style={[s.itemMeta, { marginBottom: 6 }]}>{d.summary}</P.Text> : null}
          {d.items.length === 0 ? <P.Text style={s.itemMeta}>At leisure.</P.Text> : null}
          {d.items.map((i) => (
            <P.View key={i.id} style={s.item}>
              <P.Text style={s.time}>{i.time ? fmtTime(i.time) : ""}</P.Text>
              <P.View style={s.itemBody}>
                <P.Text style={s.itemTitle}>{i.title}</P.Text>
                <P.Text style={s.itemMeta}>
                  {[ITEM_TYPE_LABEL[i.type as ItemTypeValue], i.location, fmtDuration(i.durationMins)].filter(Boolean).join(" · ")}
                </P.Text>
                {i.description ? <P.Text style={s.itemMeta}>{i.description}</P.Text> : null}
              </P.View>
            </P.View>
          ))}
        </P.View>
      ))}
      {t.hotels.length ? (
        <P.View wrap={false}>
          <P.Text style={[s.h2, { marginTop: 18 }]}>{"Where you're staying"}</P.Text>
          {t.hotels.map((h) => (
            <P.View key={h.id} style={s.tr}>
              <P.Text style={{ width: "45%", fontWeight: 500 }}>{h.hotel.name}</P.Text>
              <P.Text style={{ width: "30%", color: MUTED }}>{h.hotel.location}</P.Text>
              <P.Text style={{ width: "25%", textAlign: "right" }}>
                {fmtDate(h.checkIn)} → {fmtDate(h.checkOut)}
              </P.Text>
            </P.View>
          ))}
        </P.View>
      ) : null}
    </Shell>
  );
}

function HotelVoucher({ ctx, stayId }: { ctx: Ctx; stayId: string }) {
  const t = ctx.trip;
  const h = t.hotels.find((x) => x.id === stayId)!;
  const n = nightsBetween(toISO(h.checkIn), toISO(h.checkOut));
  return (
    <Shell ctx={ctx} kind="Hotel voucher">
      <P.Text style={s.docTitle}>{h.hotel.name}</P.Text>
      <P.Text style={s.sub}>
        {HOTEL_CATEGORY_LABEL[h.hotel.category as HotelCategoryValue]} · {h.hotel.location}
        {h.hotel.phone ? ` · ${h.hotel.phone}` : ""}
      </P.Text>
      <Facts
        items={[
          ["Lead guest", t.primaryGuest?.fullName ?? "—"],
          ["Booking ref", h.confirmationNumber ?? "Awaiting confirmation"],
          ["Status", h.confirmationStatus === "CONFIRMED" ? "Confirmed" : "Pending confirmation"],
          ["Check-in", `${fmtDate(h.checkIn)}, ${fmtTime(h.hotel.checkInTime)}`],
          ["Check-out", `${fmtDate(h.checkOut)}, ${fmtTime(h.hotel.checkOutTime)}`],
          ["Nights", String(n)],
        ]}
      />
      <P.Text style={s.h2}>Rooms</P.Text>
      <P.View style={s.tr}>
        <P.Text style={[s.th, { width: "40%" }]}>Room</P.Text>
        <P.Text style={[s.th, { width: "15%" }]}>Rooms</P.Text>
        <P.Text style={[s.th, { width: "15%" }]}>Guests</P.Text>
        <P.Text style={[s.th, { width: "30%" }]}>Meal plan</P.Text>
      </P.View>
      {h.rooms.map((r) => (
        <P.View key={r.id} style={s.tr}>
          <P.Text style={{ width: "40%", fontWeight: 500 }}>{r.roomName}</P.Text>
          <P.Text style={{ width: "15%" }}>{r.quantity}</P.Text>
          <P.Text style={{ width: "15%" }}>{r.guests}</P.Text>
          <P.Text style={{ width: "30%" }}>{MEAL_PLAN_LABEL[r.mealPlan as MealPlanValue]}</P.Text>
        </P.View>
      ))}
      {h.rooms.length === 0 ? <P.Text style={s.itemMeta}>Room details to be confirmed.</P.Text> : null}
      <P.Text style={s.h2}>Guests</P.Text>
      <P.Text>{t.guests.map((g) => g.guest.fullName).join(", ") || "—"}</P.Text>
      {h.hotel.address ? <P.Text style={s.note}>Address: {h.hotel.address}</P.Text> : null}
      {h.hotel.cancellationPolicy ? <P.Text style={s.note}>Cancellation: {h.hotel.cancellationPolicy}</P.Text> : null}
      <P.Text style={s.note}>Please present this voucher with a valid photo ID at check-in. Rates are prepaid by {t.agency.name}; incidentals are payable directly to the hotel.</P.Text>
    </Shell>
  );
}

function TransportVoucher({ ctx }: { ctx: Ctx }) {
  const t = ctx.trip;
  return (
    <Shell ctx={ctx} kind="Transport voucher">
      <P.Text style={s.docTitle}>Transfers</P.Text>
      <P.Text style={s.sub}>For {t.primaryGuest?.fullName ?? "our guest"} · {travellers(t)}</P.Text>
      {t.transports.map((x) => (
        <P.View key={x.id} style={s.box} wrap={false}>
          <P.Text style={{ fontWeight: 600 }}>
            {fmtDow(x.date)}
            {x.time ? ` · ${fmtTime(x.time)}` : ""} — {TRANSPORT_KIND_LABEL[x.kind as TransportKindValue]}
          </P.Text>
          <P.Text style={{ marginTop: 3 }}>
            {x.pickup} → {x.dropoff}
          </P.Text>
          <P.Text style={s.itemMeta}>
            {[x.vehicle && `Vehicle: ${x.vehicle}`, x.vehicleNumber && `No. ${x.vehicleNumber}`, x.driverName && `Driver: ${x.driverName}`, x.driverPhone].filter(Boolean).join("  ·  ") ||
              "Vehicle and driver details will be shared before pickup."}
          </P.Text>
          {x.notes ? <P.Text style={s.itemMeta}>{x.notes}</P.Text> : null}
        </P.View>
      ))}
      {t.transports.length === 0 ? <P.Text style={s.itemMeta}>No transfers are booked for this trip.</P.Text> : null}
    </Shell>
  );
}

function Money({ lines, total, paid, pending, tax, subtotal }: { lines: PricedLine[]; total: number; paid: number; pending: number; tax?: number; subtotal?: number }) {
  return (
    <P.View>
      <P.View style={s.tr}>
        <P.Text style={[s.th, { width: "70%" }]}>Description</P.Text>
        <P.Text style={[s.th, s.right, { width: "30%" }]}>Amount</P.Text>
      </P.View>
      {lines.map((l, i) => (
        <P.View key={i} style={s.tr} wrap={false}>
          <P.View style={{ width: "70%" }}>
            <P.Text style={{ fontWeight: 500 }}>{l.label}</P.Text>
            {l.detail ? <P.Text style={s.itemMeta}>{l.detail}</P.Text> : null}
          </P.View>
          <P.Text style={[s.right, { width: "30%" }]}>{formatINR(l.amount)}</P.Text>
        </P.View>
      ))}
      {lines.length === 0 ? <P.Text style={[s.itemMeta, { paddingVertical: 6 }]}>Tour package</P.Text> : null}
      <P.View style={{ marginTop: 8, marginLeft: "auto", width: "45%" }}>
        {subtotal !== undefined ? (
          <>
            <P.View style={s.totalRow}>
              <P.Text style={{ flexGrow: 1, color: MUTED }}>Taxable value</P.Text>
              <P.Text>{formatINR(subtotal)}</P.Text>
            </P.View>
            <P.View style={s.totalRow}>
              <P.Text style={{ flexGrow: 1, color: MUTED }}>GST (5%)</P.Text>
              <P.Text>{formatINR(tax)}</P.Text>
            </P.View>
          </>
        ) : null}
        <P.View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: LINE, marginTop: 4, paddingTop: 6 }]}>
          <P.Text style={{ flexGrow: 1, fontWeight: 600 }}>Total</P.Text>
          <P.Text style={{ fontWeight: 600 }}>{formatINR(total)}</P.Text>
        </P.View>
        <P.View style={s.totalRow}>
          <P.Text style={{ flexGrow: 1, color: MUTED }}>Paid</P.Text>
          <P.Text>{formatINR(paid)}</P.Text>
        </P.View>
        <P.View style={s.totalRow}>
          <P.Text style={{ flexGrow: 1, fontWeight: 600 }}>Balance due</P.Text>
          <P.Text style={{ fontWeight: 600 }}>{formatINR(pending)}</P.Text>
        </P.View>
      </P.View>
    </P.View>
  );
}

export type MoneyCtx = { lines: PricedLine[]; total: number; overridden: boolean; paid: number; pending: number };

function Invoice({ ctx, money, tax, subtotal, issuedAt }: { ctx: Ctx; money: MoneyCtx; tax: number; subtotal: number; issuedAt: Date }) {
  const g = ctx.trip.primaryGuest;
  return (
    <Shell ctx={ctx} kind="Tax invoice">
      <P.Text style={s.docTitle}>Invoice {ctx.number}</P.Text>
      <P.Text style={s.sub}>Issued {fmtDate(issuedAt)}</P.Text>
      <Facts
        items={[
          ["Billed to", g?.fullName ?? "—"],
          ["Phone", g?.phone ?? "—"],
          ["Email", g?.email ?? "—"],
          ["Trip", `${ctx.trip.code} · ${ctx.title}`],
          ["Travel dates", ctx.trip.startDate && ctx.trip.endDate ? `${fmtDate(ctx.trip.startDate)} → ${fmtDate(ctx.trip.endDate)}` : "—"],
          ["Travellers", travellers(ctx.trip)],
        ]}
      />
      <Money lines={money.overridden ? [{ group: "Hotels", label: `Tour package — ${ctx.title}`, amount: money.total }] : money.lines} total={money.total} paid={money.paid} pending={money.pending} tax={tax} subtotal={subtotal} />
      <P.Text style={s.note}>Prices are inclusive of GST. This is a computer-generated invoice.</P.Text>
    </Shell>
  );
}

function Receipt({ ctx, payment, money }: { ctx: Ctx; payment: TripFull["payments"][number]; money: MoneyCtx }) {
  return (
    <Shell ctx={ctx} kind="Payment receipt">
      <P.Text style={s.docTitle}>Receipt for {formatINR(payment.amount)}</P.Text>
      <P.Text style={s.sub}>Received with thanks from {ctx.trip.primaryGuest?.fullName ?? "our guest"}</P.Text>
      <Facts
        items={[
          ["Amount", formatINR(payment.amount)],
          ["Date", fmtDate(payment.paidAt)],
          ["Method", PAYMENT_METHOD_LABEL[payment.method as PaymentMethodValue]],
          ["Reference", payment.reference ?? "—"],
          ["Trip", ctx.trip.code],
          ["Trip total", formatINR(money.total)],
          ["Paid to date", formatINR(money.paid)],
          ["Balance", formatINR(money.pending)],
        ]}
      />
    </Shell>
  );
}

function maskId(n: string | null) {
  if (!n) return "—";
  return n.length <= 4 ? "••••" : `${"•".repeat(Math.min(8, n.length - 4))}${n.slice(-4)}`;
}

function GuestSummary({ ctx }: { ctx: Ctx }) {
  return (
    <Shell ctx={ctx} kind="Guest summary">
      <P.Text style={s.docTitle}>Traveller list</P.Text>
      <P.Text style={s.sub}>{travellers(ctx.trip)}</P.Text>
      <P.View style={s.tr}>
        <P.Text style={[s.th, { width: "30%" }]}>Name</P.Text>
        <P.Text style={[s.th, { width: "22%" }]}>Phone</P.Text>
        <P.Text style={[s.th, { width: "16%" }]}>Date of birth</P.Text>
        <P.Text style={[s.th, { width: "32%" }]}>ID</P.Text>
      </P.View>
      {ctx.trip.guests.map(({ guest: g, isPrimary }) => (
        <P.View key={g.id} style={s.tr} wrap={false}>
          <P.Text style={{ width: "30%", fontWeight: 500 }}>
            {g.fullName}
            {isPrimary ? " (lead)" : ""}
          </P.Text>
          <P.Text style={{ width: "22%" }}>{g.phone ?? "—"}</P.Text>
          <P.Text style={{ width: "16%" }}>{g.dateOfBirth ? fmtDate(g.dateOfBirth) : "—"}</P.Text>
          <P.Text style={{ width: "32%" }}>{g.idType ? `${ID_TYPE_LABEL[g.idType as IdTypeValue]} ${maskId(g.idNumber)}` : "—"}</P.Text>
        </P.View>
      ))}
      <P.Text style={s.note}>ID numbers are masked. Full documents are held securely by {ctx.trip.agency.name}.</P.Text>
    </Shell>
  );
}

function Confirmation({ ctx, money }: { ctx: Ctx; money: MoneyCtx }) {
  const t = ctx.trip;
  return (
    <Shell ctx={ctx} kind="Trip confirmation">
      <P.Text style={s.docTitle}>Your trip is booked</P.Text>
      <P.Text style={s.sub}>{ctx.title}</P.Text>
      <Facts items={baseFacts(ctx)} />
      <P.Text style={s.h2}>Hotels</P.Text>
      {t.hotels.map((h) => (
        <P.View key={h.id} style={s.tr} wrap={false}>
          <P.View style={{ width: "55%" }}>
            <P.Text style={{ fontWeight: 500 }}>{h.hotel.name}</P.Text>
            <P.Text style={s.itemMeta}>{h.rooms.map((r) => `${r.quantity} × ${r.roomName} (${r.mealPlan})`).join(", ") || "Rooms to be confirmed"}</P.Text>
          </P.View>
          <P.Text style={{ width: "30%" }}>
            {fmtDate(h.checkIn)} → {fmtDate(h.checkOut)}
          </P.Text>
          <P.Text style={[s.right, { width: "15%" }]}>{h.confirmationStatus === "CONFIRMED" ? "Confirmed" : "Pending"}</P.Text>
        </P.View>
      ))}
      {t.transports.length ? <P.Text style={s.h2}>Transfers</P.Text> : null}
      {t.transports.map((x) => (
        <P.View key={x.id} style={s.tr} wrap={false}>
          <P.Text style={{ width: "30%" }}>
            {fmtDow(x.date)}
            {x.time ? ` · ${fmtTime(x.time)}` : ""}
          </P.Text>
          <P.Text style={{ width: "70%" }}>
            {x.pickup} → {x.dropoff}
          </P.Text>
        </P.View>
      ))}
      <P.Text style={s.h2}>Payment</P.Text>
      <Facts items={[["Package total", formatINR(money.total)], ["Paid", formatINR(money.paid)], ["Balance due", formatINR(money.pending)]]} />
    </Shell>
  );
}

export type RenderRequest =
  | { kind: "ITINERARY" | "TRANSPORT_VOUCHER" | "GUEST_SUMMARY" }
  | { kind: "HOTEL_VOUCHER"; stayId: string }
  | { kind: "INVOICE"; number: string; tax: number; subtotal: number; issuedAt: Date }
  | { kind: "PAYMENT_RECEIPT"; paymentId: string }
  | { kind: "TRIP_CONFIRMATION" };

export async function renderTripPdf(ctx: Ctx, money: MoneyCtx, req: RenderRequest): Promise<Buffer> {
  P ??= await import("@react-pdf/renderer");
  registerFonts();
  let doc;
  switch (req.kind) {
    case "ITINERARY":
      doc = <Itinerary ctx={ctx} />;
      break;
    case "HOTEL_VOUCHER":
      doc = <HotelVoucher ctx={ctx} stayId={req.stayId} />;
      break;
    case "TRANSPORT_VOUCHER":
      doc = <TransportVoucher ctx={ctx} />;
      break;
    case "INVOICE":
      doc = <Invoice ctx={{ ...ctx, number: req.number }} money={money} tax={req.tax} subtotal={req.subtotal} issuedAt={req.issuedAt} />;
      break;
    case "PAYMENT_RECEIPT":
      doc = <Receipt ctx={ctx} payment={ctx.trip.payments.find((p) => p.id === req.paymentId)!} money={money} />;
      break;
    case "GUEST_SUMMARY":
      doc = <GuestSummary ctx={ctx} />;
      break;
    case "TRIP_CONFIRMATION":
      doc = <Confirmation ctx={ctx} money={money} />;
      break;
  }
  return P.renderToBuffer(doc);
}

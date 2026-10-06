// Calendar-date helpers shared by server and client.
//
// Trip days, check-in/out and payment dates are calendar dates, not instants.
// They are stored as Postgres DATE (Prisma gives a Date at 00:00 UTC) and
// passed around as "YYYY-MM-DD" strings. Every formatter here uses UTC so a
// date never shifts by a day depending on the viewer's timezone.

export const DEFAULT_TZ = "Asia/Kolkata";
const DAY = 86_400_000;

export type ISODate = string; // "YYYY-MM-DD"

export function isISODate(v: unknown): v is ISODate {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

export function toDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function toISO(d: Date | string | null | undefined): ISODate | null {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in a timezone (agency local time). */
export function todayISO(tz = DEFAULT_TZ, now = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: ISODate, days: number): ISODate {
  return toISO(new Date(toDate(iso).getTime() + days * DAY))!;
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
}

export function nightsBetween(start: ISODate | null, end: ISODate | null) {
  if (!start || !end) return 0;
  return Math.max(0, diffDays(start, end));
}

/** Inclusive list of dates from start to end. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const n = diffDays(start, end);
  if (n < 0 || n > 400) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

// Formatting is done by hand (not Intl) so the server and the browser always
// produce identical strings — ICU builds differ in punctuation, which breaks
// React hydration.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const mon = (d: Date) => MONTHS[d.getUTCMonth()].slice(0, 3);

function asDate(d: Date | ISODate) {
  return typeof d === "string" ? toDate(d) : d;
}

/** "10 Oct" */
export const fmtShort = (d: Date | ISODate) => {
  const x = asDate(d);
  return `${x.getUTCDate()} ${mon(x)}`;
};
/** "10 Oct 2026" */
export const fmtDate = (d: Date | ISODate) => {
  const x = asDate(d);
  return `${x.getUTCDate()} ${mon(x)} ${x.getUTCFullYear()}`;
};
/** "Sat, 10 Oct" */
export const fmtDow = (d: Date | ISODate) => {
  const x = asDate(d);
  return `${DAYS[x.getUTCDay()].slice(0, 3)}, ${x.getUTCDate()} ${mon(x)}`;
};
/** "Saturday, 10 October 2026" */
export const fmtLong = (d: Date | ISODate) => {
  const x = asDate(d);
  return `${DAYS[x.getUTCDay()]}, ${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};
/** "October 2026" */
export const fmtMonth = (d: Date | ISODate) => {
  const x = asDate(d);
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};
/** "Sat" */
export const fmtWeekday = (d: Date | ISODate) => DAYS[asDate(d).getUTCDay()].slice(0, 3);

/** "10 Oct → 16 Oct" (adds the year to the end when it differs from this year). */
export function fmtRange(start: Date | ISODate | null, end: Date | ISODate | null) {
  if (!start || !end) return "Dates not set";
  const s = asDate(start);
  const e = asDate(end);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  return sameYear ? `${fmtShort(s)} → ${fmtShort(e)}` : `${fmtDate(s)} → ${fmtDate(e)}`;
}

/** Instants (createdAt etc.) in the agency's timezone: "5 Oct, 2:30 PM". */
export function fmtDateTime(d: Date | string, tz = DEFAULT_TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(new Date(d))
      .map((p) => [p.type, p.value]),
  );
  return `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1].slice(0, 3)}, ${fmtTime(`${parts.hour.padStart(2, "0")}:${parts.minute}`)}`;
}

export function fmtRelative(d: Date | string, now = new Date()) {
  const s = Math.round((now.getTime() - new Date(d).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDateTime(d);
}

/** "09:30" → "9:30 AM" */
export function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function isTime(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Sort key that puts untimed items after timed ones. */
export function timeKey(t: string | null | undefined) {
  return t && isTime(t) ? t : "99:99";
}

export function fmtDuration(mins: number | null | undefined) {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

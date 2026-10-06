import "server-only";
import { db } from "./db";
import { addDays, fmtDow, toDate, todayISO } from "@/lib/dates";
import { rollStatuses, tripTitle } from "./trips/core";
import { guestTripUrl } from "./trips/publish";
import { notifyAgency, notifyAdmins } from "./notifications";
import { sendEmail } from "./email";
import { templates } from "./email/templates";

/**
 * Daily housekeeping (idempotent — safe to run more than once a day):
 *  - CONFIRMED → ONGOING → COMPLETED as dates pass
 *  - "Trip starts tomorrow" notifications for agents
 *  - Reminder email to guests two days before departure (once per trip)
 *  - Trial-ending alerts for platform admins
 */
export async function runDaily(now = new Date()) {
  const today = todayISO(undefined, now);
  await rollStatuses(toDate(today));

  const tomorrow = toDate(addDays(today, 1));
  const startingTomorrow = await db.trip.findMany({
    where: { startDate: tomorrow, status: { notIn: ["CANCELLED", "DRAFT", "COMPLETED"] } },
    select: { id: true, code: true, agencyId: true, primaryGuest: { select: { fullName: true } } },
  });
  for (const t of startingTomorrow) {
    await notifyAgency(t.agencyId, { type: "trip.tomorrow", title: `${t.code} starts tomorrow`, body: t.primaryGuest?.fullName ?? undefined, href: `/app/trips/${t.id}`, dedupeKey: `tomorrow:${t.id}` });
  }

  const inTwoDays = toDate(addDays(today, 2));
  const reminders = await db.trip.findMany({
    where: { startDate: inTwoDays, status: { in: ["SENT", "CONFIRMED"] }, shareEnabled: true, shareToken: { not: null } },
    include: { primaryGuest: true, agency: true, destinations: { orderBy: { position: "asc" } }, days: { where: { dayNumber: 1 }, include: { items: { orderBy: { position: "asc" }, take: 1 } } } },
  });
  let emailed = 0;
  for (const t of reminders) {
    if (!t.primaryGuest?.email || !t.shareToken) continue;
    const already = await db.emailLog.findFirst({ where: { tripId: t.id, template: "tripReminder" }, select: { id: true } });
    if (already) continue;
    const first = t.days[0]?.items[0];
    await sendEmail(
      "tripReminder",
      t.primaryGuest.email,
      templates.tripReminder({ agencyName: t.agency.name, supportEmail: t.agency.supportEmail, supportPhone: t.agency.supportPhone, guestName: t.primaryGuest.fullName, tripTitle: tripTitle(t), startsOn: fmtDow(t.startDate!), url: guestTripUrl(t.shareToken), firstItem: first?.title ?? null }),
      { agencyId: t.agencyId, tripId: t.id },
    );
    emailed++;
  }

  const trials = await db.subscription.findMany({ where: { status: "TRIALING", trialEndsAt: { gte: now, lte: new Date(now.getTime() + 3 * 86_400_000) } }, include: { agency: { select: { id: true, name: true } } } });
  for (const s of trials) {
    await notifyAdmins({ type: "subscription.trial_ending", title: `${s.agency.name} trial ends soon`, href: `/admin/agents/${s.agency.id}`, dedupeKey: `trial:${s.id}:${s.trialEndsAt?.toISOString().slice(0, 10)}` });
  }
  return { tomorrow: startingTomorrow.length, reminders: emailed, trials: trials.length };
}

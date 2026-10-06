import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/context";
import { calendarEvents } from "@/server/ops";
import { PageHeader } from "@/components/app/page";
import { CalendarView, calendarRange, type CalView } from "@/components/calendar/calendar-view";
import { isISODate, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  const actor = await requireAdminPage();
  const sp = await searchParams;
  const view: CalView = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const anchor = isISODate(sp.date) ? sp.date : todayISO();
  const range = calendarRange(view, anchor);
  const events = await calendarEvents(actor, range.from, range.to);
  return (
    <>
      <PageHeader title="Calendar" description="Every agency's arrivals, check-ins, transfers and activities." />
      <CalendarView view={view} anchor={anchor} events={events} basePath="/admin/calendar" />
    </>
  );
}

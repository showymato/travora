import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/context";
import { listDestinations } from "@/server/hotels";
import { PageHeader } from "@/components/app/page";
import { HotelForm, emptyHotel } from "@/components/admin/hotel-form";

export const metadata: Metadata = { title: "New hotel" };

export default async function NewHotelPage() {
  await requireAdminPage();
  const destinations = await listDestinations();
  return (
    <>
      <PageHeader back={{ href: "/admin/hotels", label: "Hotels" }} title="New hotel" description="After creating the hotel you'll add room types, photos, agency access and rates." />
      <div className="max-w-5xl rounded-xl border bg-card p-5 sm:p-7">
        <HotelForm initial={emptyHotel} destinations={destinations.map((d) => d.name)} />
      </div>
    </>
  );
}

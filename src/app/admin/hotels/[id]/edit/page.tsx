import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/context";
import { getHotelAdmin, listDestinations } from "@/server/hotels";
import { or404 } from "@/server/pages";
import { PageHeader } from "@/components/app/page";
import { HotelForm } from "@/components/admin/hotel-form";
import type { HotelCategoryValue } from "@/lib/labels";

export const metadata: Metadata = { title: "Edit hotel" };

export default async function EditHotelPage({ params }: PageProps<"/admin/hotels/[id]/edit">) {
  const actor = await requireAdminPage();
  const { id } = await params;
  const [h, destinations] = await Promise.all([or404(getHotelAdmin(actor, id)), listDestinations()]);
  return (
    <>
      <PageHeader back={{ href: `/admin/hotels/${id}`, label: h.name }} title={`Edit ${h.name}`} />
      <div className="max-w-5xl rounded-xl border bg-card p-5 sm:p-7">
        <HotelForm
          hotelId={id}
          destinations={destinations.map((d) => d.name)}
          initial={{
            name: h.name,
            category: h.category as HotelCategoryValue,
            description: h.description ?? "",
            destination: h.destination?.name ?? "",
            location: h.location,
            address: h.address ?? "",
            latitude: h.latitude?.toString() ?? "",
            longitude: h.longitude?.toString() ?? "",
            phone: h.phone ?? "",
            email: h.email ?? "",
            website: h.website ?? "",
            amenities: h.amenities,
            checkInTime: h.checkInTime,
            checkOutTime: h.checkOutTime,
            cancellationPolicy: h.cancellationPolicy ?? "",
            notes: h.notes ?? "",
            status: h.status,
          }}
        />
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/context";
import { getAssignments } from "@/server/hotels";
import { or404 } from "@/server/pages";
import { PageHeader } from "@/components/app/page";
import { HotelAssignment } from "@/components/admin/hotel-assignment";

export const metadata: Metadata = { title: "Hotel access" };

export default async function AgencyHotelsPage({ params }: PageProps<"/admin/agents/[id]/hotels">) {
  const actor = await requireAdminPage();
  const { id } = await params;
  const data = await or404(getAssignments(actor, id));
  return (
    <>
      <PageHeader
        back={{ href: `/admin/agents/${id}`, label: data.agency.name }}
        title="Hotel access"
        description={`Choose which hotels ${data.agency.name} can see and book. Set agency-specific rates on each hotel's Rates tab.`}
      />
      <HotelAssignment agencyId={id} agencyName={data.agency.name} hotels={data.hotels} assigned={data.assigned} />
    </>
  );
}

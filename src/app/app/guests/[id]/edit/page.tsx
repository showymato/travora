import type { Metadata } from "next";
import { requireAgentPage } from "@/server/auth/context";
import { getGuestProfile } from "@/server/guests";
import { PageHeader } from "@/components/app/page";
import { toISO } from "@/lib/dates";
import { EditGuest } from "../../new/new-guest";

export const metadata: Metadata = { title: "Edit guest" };

export default async function EditGuestPage({ params }: PageProps<"/app/guests/[id]/edit">) {
  const actor = await requireAgentPage();
  const { id } = await params;
  const g = await getGuestProfile(actor, id);
  return (
    <>
      <PageHeader back={{ href: `/app/guests/${id}`, label: g.fullName }} title={`Edit ${g.fullName}`} />
      <div className="max-w-4xl rounded-xl border bg-card p-5 sm:p-7">
        <EditGuest
          guestId={id}
          initial={{
            fullName: g.fullName,
            phone: g.phone ?? "",
            email: g.email ?? "",
            whatsapp: g.whatsapp ?? "",
            nationality: g.nationality ?? "",
            dateOfBirth: toISO(g.dateOfBirth) ?? "",
            gender: g.gender ?? "",
            address: g.address ?? "",
            idType: g.idType ?? "",
            idNumber: g.idNumber ?? "",
            notes: g.notes ?? "",
          }}
        />
      </div>
    </>
  );
}

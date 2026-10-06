import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/context";
import { or404 } from "@/server/pages";
import { getAgencyDetail, listPlans } from "@/server/agencies";
import { PageHeader } from "@/components/app/page";
import { EditAgencyForm } from "@/components/admin/agency-form";
import type { PlanCodeValue } from "@/lib/labels";

export const metadata: Metadata = { title: "Edit agency" };

export default async function EditAgencyPage({ params }: PageProps<"/admin/agents/[id]/edit">) {
  const actor = await requireAdminPage();
  const { id } = await params;
  const [a, plans] = await Promise.all([or404(getAgencyDetail(actor, id)), listPlans()]);
  return (
    <>
      <PageHeader back={{ href: `/admin/agents/${id}`, label: a.name }} title={`Edit ${a.name}`} />
      <div className="max-w-5xl rounded-xl border bg-card p-5 sm:p-7">
        <EditAgencyForm
          agencyId={id}
          plans={plans}
          initial={{
            name: a.name,
            ownerName: a.ownerName,
            email: a.email,
            phone: a.phone,
            city: a.city ?? "",
            state: a.state ?? "",
            country: a.country ?? "",
            address: a.address ?? "",
            gstNumber: a.gstNumber ?? "",
            plan: (a.subscription?.plan.code ?? "STARTER") as PlanCodeValue,
          }}
        />
      </div>
    </>
  );
}

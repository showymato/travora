import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/context";
import { listPlans } from "@/server/agencies";
import { PageHeader } from "@/components/app/page";
import { CreateAgencyForm } from "@/components/admin/agency-form";

export const metadata: Metadata = { title: "New agency" };

export default async function NewAgencyPage() {
  await requireAdminPage();
  const plans = await listPlans();
  return (
    <>
      <PageHeader back={{ href: "/admin/agents", label: "Agents" }} title="New agency" description="Creates the agency, its owner account, subscription and workspace, then sends a welcome email." />
      <div className="max-w-5xl rounded-xl border bg-card p-5 sm:p-7">
        <CreateAgencyForm plans={plans} />
      </div>
    </>
  );
}

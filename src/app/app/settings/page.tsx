import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { getOwnAgency } from "@/server/agencies";
import { Button } from "@/components/ui/button";
import { DetailList, PageHeader, Panel } from "@/components/app/page";
import { AgencyStatusBadge, PlanBadge } from "@/components/app/badges";
import { fmtDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { AgencySettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireAgentPage();
  const a = await getOwnAgency(actor);
  const sub = a.subscription;
  return (
    <>
      <PageHeader title="Settings" description="Your workspace details appear on documents, emails and the guest trip page." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Workspace">
          <AgencySettingsForm initial={{ name: a.name, supportEmail: a.supportEmail ?? "", supportPhone: a.supportPhone ?? "", address: a.address ?? "", gstNumber: a.gstNumber ?? "" }} />
        </Panel>
        <div className="space-y-5">
          <Panel title="Plan">
            {sub ? (
              <>
                <div className="flex items-center gap-2">
                  <PlanBadge name={sub.plan.name} />
                  <AgencyStatusBadge status={a.status} />
                </div>
                <DetailList
                  className="mt-4 sm:grid-cols-1"
                  items={[
                    ["Price", `${formatINR(sub.plan.priceMonthly)} / month`],
                    ["Current period ends", fmtDate(sub.currentPeriodEnd)],
                    ["Team members", `${a._count.users} of ${sub.plan.maxUsers}`],
                    ["Includes", sub.plan.features.join(" · ")],
                  ]}
                />
                <p className="mt-4 text-[12.5px] text-muted-foreground">To change plans, contact TRAVORA support.</p>
              </>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">No subscription on file.</p>
            )}
          </Panel>
          <Panel title="Your account">
            <DetailList className="sm:grid-cols-1" items={[["Name", actor.name], ["Email", actor.email]]} />
            <Button asChild variant="outline" className="mt-4">
              <Link href="/account/password">
                <KeyRound className="size-4" aria-hidden /> Change password
              </Link>
            </Button>
          </Panel>
        </div>
      </div>
    </>
  );
}

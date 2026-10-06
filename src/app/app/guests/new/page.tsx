import type { Metadata } from "next";
import { requireAgentPage } from "@/server/auth/context";
import { PageHeader } from "@/components/app/page";
import { NewGuest } from "./new-guest";

export const metadata: Metadata = { title: "New guest" };

export default async function NewGuestPage() {
  await requireAgentPage();
  return (
    <>
      <PageHeader back={{ href: "/app/guests", label: "Guests" }} title="New guest" description="Only the name is required. Add documents from the guest's profile after saving." />
      <div className="max-w-4xl rounded-xl border bg-card p-5 sm:p-7">
        <NewGuest />
      </div>
    </>
  );
}

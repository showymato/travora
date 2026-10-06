import type { Metadata } from "next";
import { requireAgentPage } from "@/server/auth/context";
import { ownGuest } from "@/server/guests";
import { WizardFrame } from "@/components/trips/wizard/frame";
import { GuestStep } from "@/components/trips/wizard/step-guest";

export const metadata: Metadata = { title: "New trip" };

export default async function NewTripPage({ searchParams }: PageProps<"/app/trips/new">) {
  const actor = await requireAgentPage();
  const sp = await searchParams;
  // "New trip for this guest" from a guest profile pre-selects them.
  const guestId = typeof sp.guest === "string" ? sp.guest : null;
  const guest = guestId ? await ownGuest(actor.agencyId, guestId).catch(() => null) : null;
  return (
    <WizardFrame tripId={null} code={null} step={1} reached={1} title="Who's travelling?" description="Select an existing guest or create one. The primary guest is your main contact." savedAt={null}>
      <GuestStep
        tripId={null}
        initial={{
          primaryId: guest?.id ?? null,
          guests: guest ? [{ id: guest.id, fullName: guest.fullName, phone: guest.phone, email: guest.email }] : [],
          adults: 2,
          children: 0,
          infants: 0,
        }}
      />
    </WizardFrame>
  );
}

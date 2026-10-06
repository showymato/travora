"use client";

import { useRouter } from "next/navigation";
import { GuestForm } from "@/components/guests/guest-form";

export function NewGuest() {
  const router = useRouter();
  return <GuestForm onSaved={(g) => g && router.push(`/app/guests/${g.id}`)} onCancel={() => router.push("/app/guests")} />;
}

export function EditGuest({ guestId, initial }: { guestId: string; initial: React.ComponentProps<typeof GuestForm>["initial"] }) {
  const router = useRouter();
  return <GuestForm guestId={guestId} initial={initial} onSaved={() => router.push(`/app/guests/${guestId}`)} onCancel={() => router.push(`/app/guests/${guestId}`)} />;
}

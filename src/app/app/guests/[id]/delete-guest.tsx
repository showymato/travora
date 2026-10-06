"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useAction } from "@/lib/use-action";
import { deleteGuestAction } from "@/server/actions/agent";

export function DeleteGuestButton({ guestId, name }: { guestId: string; name: string }) {
  const router = useRouter();
  const del = useAction(deleteGuestAction, { refresh: false, onSuccess: () => router.push("/app/guests") });
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" className="text-bad hover:text-bad">
          <Trash2 className="size-4" aria-hidden /> Delete guest
        </Button>
      }
      title={`Delete ${name}?`}
      description="The guest and their uploaded documents are permanently removed. Guests with trips can't be deleted."
      confirmLabel="Delete guest"
      destructive
      onConfirm={() => del.run(guestId)}
    />
  );
}

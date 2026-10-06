"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Ban, BedDouble, CheckCircle2, Copy, Eye, KeyRound, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAction } from "@/lib/use-action";
import { resetAgencyAccessAction, setAgencyStatusAction } from "@/server/actions/admin";

export function AgencyActions({ agencyId, name, status, compact = false }: { agencyId: string; name: string; status: string; compact?: boolean }) {
  const [dialog, setDialog] = useState<null | "suspend" | "activate" | "reset">(null);
  const [creds, setCreds] = useState<{ email: string; tempPassword: string; emailStatus: string } | null>(null);
  const setStatus = useAction((s: "ACTIVE" | "SUSPENDED") => setAgencyStatusAction(agencyId, s), { onSuccess: () => setDialog(null) });
  const reset = useAction(() => resetAgencyAccessAction(agencyId), { success: false, onSuccess: (d) => setCreds(d) });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {compact ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          ) : (
            <Button variant="outline">
              Actions <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {compact ? (
            <DropdownMenuItem asChild>
              <Link href={`/admin/agents/${agencyId}`}>
                <Eye aria-hidden /> View
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/admin/agents/${agencyId}/edit`}>
              <Pencil aria-hidden /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/agents/${agencyId}/hotels`}>
              <BedDouble aria-hidden /> Hotel access & rates
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/agents/${agencyId}?tab=activity`}>
              <Activity aria-hidden /> View activity
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("reset")}>
            <KeyRound aria-hidden /> Reset access
          </DropdownMenuItem>
          {status === "SUSPENDED" ? (
            <DropdownMenuItem onSelect={() => setDialog("activate")}>
              <CheckCircle2 aria-hidden /> Activate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("suspend")}>
              <Ban aria-hidden /> Suspend
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "suspend" || dialog === "activate"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "suspend" ? `Suspend ${name}?` : `Activate ${name}?`}</DialogTitle>
            <DialogDescription>
              {dialog === "suspend" ? "Everyone in this agency is signed out immediately and can't sign in. Their data is kept and guest trip pages keep working." : "The agency's users can sign in again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button className={dialog === "suspend" ? "bg-bad text-white hover:bg-bad/90" : undefined} disabled={setStatus.pending} onClick={() => setStatus.run(dialog === "suspend" ? "SUSPENDED" : "ACTIVE")}>
              {setStatus.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {dialog === "suspend" ? "Suspend agency" : "Activate agency"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "reset"}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            setCreds(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{creds ? "Access reset" : `Reset access for ${name}?`}</DialogTitle>
            <DialogDescription>
              {creds
                ? creds.emailStatus === "SENT"
                  ? "The owner has been emailed a temporary password."
                  : "Email is in development mode — share this temporary password securely."
                : "The owner gets a new temporary password and every session is signed out. They'll choose a new password at next sign-in."}
            </DialogDescription>
          </DialogHeader>
          {creds ? (
            <div className="space-y-2 rounded-xl border bg-surface p-4 font-mono text-[13px]">
              <p>{creds.email}</p>
              <p className="text-[15px] font-semibold">{creds.tempPassword}</p>
            </div>
          ) : null}
          <DialogFooter>
            {creds ? (
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(creds.tempPassword).then(() => toast.success("Copied."), () => toast.error("Couldn't copy."))}>
                <Copy className="size-4" aria-hidden /> Copy password
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button disabled={reset.pending} onClick={() => reset.run()}>
                  {reset.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Reset access
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

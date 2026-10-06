"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, ChevronDown, Copy, ExternalLink, Link2Off, Loader2, MoreHorizontal, Pencil, RefreshCw, Rocket, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TRIP_STATUS_LABEL, TRIP_TRANSITIONS, type TripStatusValue } from "@/lib/labels";
import { stepHref } from "@/lib/plan";
import { confirmTripAction, deleteDraftAction, publishUpdateAction, setShareAction, setTripStatusAction } from "@/server/actions/trips";

type Props = {
  tripId: string;
  status: string;
  guestName: string | null;
  guestEmail: string | null;
  shareUrl: string | null;
  published: number | null;
  unpublished: boolean;
};

export function TripHeaderActions(p: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "publish" | "confirm" | "cancel" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const transitions = (TRIP_TRANSITIONS[p.status as TripStatusValue] ?? []).filter((s) => s !== "CANCELLED" && s !== "CONFIRMED");

  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>, ok?: string, after?: () => void) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message ?? "Something went wrong.");
      return false;
    }
    if (ok) toast.success(ok);
    setDialog(null);
    after?.();
    router.refresh();
    return true;
  };

  const copy = async () => {
    if (!p.shareUrl) return;
    try {
      await navigator.clipboard.writeText(p.shareUrl);
      toast.success("Guest link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const primary =
    p.status === "DRAFT" || p.status === "PLANNING" || p.status === "READY" ? (
      <Button asChild>
        <Link href={stepHref(p.tripId, p.status === "READY" ? 10 : 9)}>
          <Send className="size-4" aria-hidden /> {p.status === "READY" ? "Send to guest" : "Review & send"}
        </Link>
      </Button>
    ) : p.unpublished ? (
      <Button onClick={() => setDialog("publish")}>
        <Rocket className="size-4" aria-hidden /> Publish update
      </Button>
    ) : p.status === "SENT" ? (
      <Button onClick={() => setDialog("confirm")}>
        <CheckCircle2 className="size-4" aria-hidden /> Mark confirmed
      </Button>
    ) : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline">
        <Link href={stepHref(p.tripId, 1)}>
          <Pencil className="size-4" aria-hidden /> Edit plan
        </Link>
      </Button>
      {p.shareUrl ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Guest page <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">Showing version {p.published}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href={p.shareUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> Open guest page
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={copy}>
              <Copy aria-hidden /> Copy link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => run(() => setShareAction(p.tripId, true, true), "New link created. The old link no longer works.")}>
              <RefreshCw aria-hidden /> Replace link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run(() => setShareAction(p.tripId, false), "Guest page disabled.")}>
              <Link2Off aria-hidden /> Disable guest page
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : p.published ? (
        <Button variant="outline" onClick={() => run(() => setShareAction(p.tripId, true), "Guest page enabled.")}>
          Enable guest page
        </Button>
      ) : null}
      {primary}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More trip actions">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">Change status</DropdownMenuLabel>
          {p.status === "SENT" ? (
            <DropdownMenuItem onSelect={() => setDialog("confirm")}>
              <CheckCircle2 aria-hidden /> Confirmed
            </DropdownMenuItem>
          ) : null}
          {transitions.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => run(() => setTripStatusAction(p.tripId, s), `Marked ${TRIP_STATUS_LABEL[s].toLowerCase()}.`)}>
              {TRIP_STATUS_LABEL[s]}
            </DropdownMenuItem>
          ))}
          {p.published && !p.unpublished ? (
            <DropdownMenuItem onSelect={() => setDialog("publish")}>
              <Rocket aria-hidden /> Re-publish to guest
            </DropdownMenuItem>
          ) : null}
          {(TRIP_TRANSITIONS[p.status as TripStatusValue] ?? []).includes("CANCELLED") ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
                <Ban aria-hidden /> Cancel trip
              </DropdownMenuItem>
            </>
          ) : null}
          {p.status === "DRAFT" ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash2 aria-hidden /> Delete draft
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <PublishDialog open={dialog === "publish"} onOpenChange={(o) => setDialog(o ? "publish" : null)} busy={busy} hasEmail={Boolean(p.guestEmail)} guestName={p.guestName} onSubmit={(summary, notify) => run(() => publishUpdateAction(p.tripId, { summary, notify }), notify && p.guestEmail ? "Update published and the guest was emailed." : "Update published to the guest page.")} />
      <SimpleDialog
        open={dialog === "confirm"}
        onOpenChange={(o) => setDialog(o ? "confirm" : null)}
        title="Mark this trip as confirmed?"
        description="Use this once the guest has accepted the plan."
        busy={busy}
        withNotify={Boolean(p.guestEmail)}
        confirmLabel="Confirm trip"
        onConfirm={(notify) => run(() => confirmTripAction(p.tripId, notify))}
      />
      <SimpleDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => setDialog(o ? "cancel" : null)}
        title="Cancel this trip?"
        description="The guest page stops working and the trip leaves your active lists. You can reopen it later by moving it back to Planning."
        busy={busy}
        destructive
        confirmLabel="Cancel trip"
        onConfirm={() => run(() => setTripStatusAction(p.tripId, "CANCELLED"), "Trip cancelled.")}
      />
      <SimpleDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title="Delete this draft?"
        description="The draft and everything in it is removed permanently."
        busy={busy}
        destructive
        confirmLabel="Delete draft"
        onConfirm={() => run(() => deleteDraftAction(p.tripId), "Draft deleted.", () => router.push("/app/trips"))}
      />
    </div>
  );
}

function PublishDialog({ open, onOpenChange, busy, hasEmail, guestName, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; busy: boolean; hasEmail: boolean; guestName: string | null; onSubmit: (summary: string, notify: boolean) => void }) {
  const [summary, setSummary] = useState("");
  const [notify, setNotify] = useState(true);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish update to {guestName ?? "the guest"}</DialogTitle>
          <DialogDescription>The guest page switches to the latest version of the trip. Previous versions are kept in the activity history.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pub-sum">What changed?</Label>
            <Textarea id="pub-sum" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={300} placeholder="Day 3: Gondola moved to the morning; added dinner at Ahdoos." />
          </div>
          <div className="flex items-center gap-2.5">
            <Switch id="pub-notify" checked={notify && hasEmail} disabled={!hasEmail} onCheckedChange={setNotify} />
            <Label htmlFor="pub-notify" className="font-normal">
              {hasEmail ? "Email the guest: “Your itinerary has been updated”" : "Guest has no email — share the link instead"}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => onSubmit(summary, notify && hasEmail)}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />} Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SimpleDialog({
  open,
  onOpenChange,
  title,
  description,
  busy,
  destructive,
  withNotify,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  busy: boolean;
  destructive?: boolean;
  withNotify?: boolean;
  confirmLabel: string;
  onConfirm: (notify: boolean) => void;
}) {
  const [notify, setNotify] = useState(true);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {withNotify ? (
          <div className="flex items-center gap-2.5">
            <Switch id="dlg-notify" checked={notify} onCheckedChange={setNotify} />
            <Label htmlFor="dlg-notify" className="font-normal">
              Email the guest
            </Label>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button className={destructive ? "bg-bad text-white hover:bg-bad/90" : undefined} disabled={busy} onClick={() => onConfirm(notify)}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

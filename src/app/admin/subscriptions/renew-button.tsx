"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/lib/use-action";
import { renewSubscriptionAction } from "@/server/actions/admin";

export function RenewButton({ agencyId, name }: { agencyId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState("1");
  const renew = useAction(() => renewSubscriptionAction(agencyId, Number(months)), { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Extend
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Extend {name}</DialogTitle>
          <DialogDescription>Record an offline payment by extending the current period. Trials become active.</DialogDescription>
        </DialogHeader>
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-full" aria-label="Months">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 3, 6, 12].map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m} month{m === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={renew.pending} onClick={() => renew.run()}>
            {renew.pending ? "Saving…" : "Extend subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

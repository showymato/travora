"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Building2, Loader2, Map, Plus, UserPlus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { searchAction } from "@/server/actions/agent";
import type { SearchHit } from "@/server/ops";
import { NAV, type Role } from "./nav";

const GROUP_ICON = { Trips: Map, Guests: Users, Hotels: BedDouble, Agencies: Building2 } as const;

export function CommandMenu({ open, onOpenChange, role }: { open: boolean; onOpenChange: (o: boolean) => void; role: Role }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      start(async () => {
        const res = await searchAction(q);
        if (res.ok) {
          setHits(res.data);
          setFailed(false);
        } else setFailed(true);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    setHits([]);
    router.push(href);
  };

  const groups = (["Trips", "Guests", "Agencies", "Hotels"] as const).map((g) => [g, hits.filter((h) => h.group === g)] as const).filter(([, list]) => list.length);
  const searching = q.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Search and commands</DialogTitle>
        <DialogDescription className="sr-only">Search across your workspace or jump to a page.</DialogDescription>
        <Command shouldFilter={!searching} loop>
          <CommandInput value={q} onValueChange={setQ} placeholder={role === "admin" ? "Search agencies, trip IDs, guests, hotels…" : "Search guests, trip IDs, phone, email, destinations…"} />
          <CommandList>
            {searching ? (
              <>
                {pending && !hits.length ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
                  </div>
                ) : null}
                {failed ? <div className="py-8 text-center text-sm text-bad">Search is unavailable right now. Try again.</div> : null}
                {!pending && !failed ? <CommandEmpty>No matches for “{q}”.</CommandEmpty> : null}
                {groups.map(([group, list]) => {
                  const Icon = GROUP_ICON[group];
                  return (
                    <CommandGroup key={group} heading={group}>
                      {list.map((h) => (
                        <CommandItem key={`${group}-${h.id}`} value={`${group}-${h.id}-${h.title}`} onSelect={() => go(h.href)}>
                          <Icon className="text-muted-foreground" aria-hidden />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{h.title}</div>
                            <div className="truncate text-[12px] text-muted-foreground">{h.subtitle}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            ) : (
              <>
                <CommandGroup heading="Actions">
                  {role === "agent" ? (
                    <>
                      <CommandItem onSelect={() => go("/app/trips/new")}>
                        <Plus aria-hidden /> New trip
                      </CommandItem>
                      <CommandItem onSelect={() => go("/app/guests/new")}>
                        <UserPlus aria-hidden /> New guest
                      </CommandItem>
                    </>
                  ) : (
                    <>
                      <CommandItem onSelect={() => go("/admin/agents/new")}>
                        <Plus aria-hidden /> New agency
                      </CommandItem>
                      <CommandItem onSelect={() => go("/admin/hotels/new")}>
                        <Plus aria-hidden /> New hotel
                      </CommandItem>
                      <CommandItem onSelect={() => go("/admin/templates/new")}>
                        <Plus aria-hidden /> New itinerary template
                      </CommandItem>
                    </>
                  )}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Go to">
                  {NAV[role].map((n) => {
                    const Icon = n.icon;
                    return (
                      <CommandItem key={n.href} onSelect={() => go(n.href)}>
                        <Icon aria-hidden /> {n.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

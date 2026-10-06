"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { listNotificationsAction, markNotificationsReadAction } from "@/server/actions/agent";
import { fmtRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; href: string | null; type: string; readAt: string | null; createdAt: string };

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const res = await listNotificationsAction();
    if (res.ok) {
      setItems(res.data.items);
      setUnread(res.data.unread);
      setError(false);
    } else setError(true);
  }, []);

  useEffect(() => {
    // Initial fetch and a light poll; notifications are not latency-critical.
    const first = setTimeout(load, 0);
    const t = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const markAll = async () => {
    setItems((xs) => xs?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null);
    setUnread(0);
    await markNotificationsReadAction();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell className="size-[18px]" aria-hidden />
          {unread > 0 ? (
            <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] leading-4 font-semibold text-white tabular" aria-hidden>
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-[14px] font-semibold">Notifications</p>
          {unread > 0 ? (
            <button onClick={markAll} className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground">
              <CheckCheck className="size-3.5" aria-hidden /> Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items === null && !error ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-label="Loading" />
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Couldn&apos;t load notifications.{" "}
              <button onClick={load} className="font-medium text-foreground underline underline-offset-2">
                Retry
              </button>
            </div>
          ) : items && items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center text-[13px] text-muted-foreground">
              <BellOff className="mb-2 size-5" aria-hidden />
              You&apos;re all caught up.
            </div>
          ) : (
            <ul>
              {items!.map((n) => {
                const body = (
                  <div className="flex gap-3 px-4 py-3">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <div className="min-w-0">
                      <p className={cn("text-[13.5px] leading-snug", !n.readAt && "font-medium")}>{n.title}</p>
                      {n.body ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{n.body}</p> : null}
                      <p className="mt-1 text-[11.5px] text-muted-foreground">{fmtRelative(n.createdAt)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id} className="border-b last:border-0">
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => {
                          setOpen(false);
                          if (!n.readAt) markNotificationsReadAction([n.id]).then(load);
                        }}
                        className="block transition-colors hover:bg-muted/60"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

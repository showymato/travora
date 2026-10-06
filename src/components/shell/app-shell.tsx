"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { NAV, isActive, type Role } from "./nav";
import { CommandMenu } from "./command-menu";
import { NotificationCenter } from "./notification-center";
import { ProfileMenu } from "./profile-menu";

export type ShellUser = { name: string; email: string; workspace: string };

export function AppShell({ role, user, initialCollapsed, children }: { role: Role; user: ShellUser; initialCollapsed: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const items = NAV[role];

  const toggle = () => {
    setCollapsed((c) => {
      document.cookie = `tv_sidebar=${c ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // toggle only uses a functional state update, so the first closure is safe.
  }, []);

  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);

  return (
    <TooltipProvider delayDuration={200}>
      <a href="#main" className="sr-only z-[100] rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 ease-out lg:flex",
            collapsed ? "w-[64px]" : "w-[232px]",
          )}
          aria-label="Primary"
        >
          <div className={cn("flex h-14 items-center border-b", collapsed ? "justify-center px-2" : "px-4")}>
            <Link href={role === "admin" ? "/admin" : "/app"} aria-label="TRAVORA home" className="rounded-md">
              {collapsed ? <LogoMark /> : <Logo />}
            </Link>
          </div>
          {!collapsed ? (
            <div className="px-4 pt-4 pb-1">
              <div className="truncate text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{role === "admin" ? "Platform" : "Workspace"}</div>
              <div className="mt-0.5 truncate text-[13.5px] font-medium">{user.workspace}</div>
            </div>
          ) : null}
          {role === "agent" ? (
            <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
              <SidebarButton collapsed={collapsed} label="New trip">
                <Button asChild className={cn("w-full", collapsed && "size-10 px-0")}>
                  <Link href="/app/trips/new">
                    <Plus className="size-4" aria-hidden />
                    {!collapsed && "New trip"}
                    {collapsed && <span className="sr-only">New trip</span>}
                  </Link>
                </Button>
              </SidebarButton>
            </div>
          ) : null}
          <nav className={cn("flex-1 space-y-0.5 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
            {items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <SidebarButton key={item.href} collapsed={collapsed} label={item.label}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-3 rounded-lg text-[13.5px] font-medium transition-colors",
                      collapsed ? "justify-center" : "px-2.5",
                      active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className={cn("size-[17px] shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} aria-hidden />
                    {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                  </Link>
                </SidebarButton>
              );
            })}
          </nav>
          <div className={cn("border-t py-2", collapsed ? "px-2" : "px-3")}>
            <SidebarButton collapsed={collapsed} label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <button
                onClick={toggle}
                className={cn("flex h-9 w-full items-center gap-3 rounded-lg text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground", collapsed ? "justify-center" : "px-2.5")}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? <PanelLeftOpen className="size-[17px]" aria-hidden /> : <PanelLeftClose className="size-[17px]" aria-hidden />}
                {!collapsed && (
                  <>
                    Collapse
                    <kbd className="ml-auto rounded border bg-background px-1.5 font-sans text-[10.5px]">Ctrl \</kbd>
                  </>
                )}
              </button>
            </SidebarButton>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-5">
            <Link href={role === "admin" ? "/admin" : "/app"} className="lg:hidden" aria-label="TRAVORA home">
              <LogoMark />
            </Link>
            <button
              onClick={() => setCmdOpen(true)}
              className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border bg-card px-3 text-left text-[13.5px] text-muted-foreground shadow-xs transition-colors hover:border-foreground/15 sm:max-w-md"
              aria-label="Search and commands"
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{role === "admin" ? "Search agencies, trips, hotels…" : "Search guests, trips, phone, hotels…"}</span>
              <kbd className="ml-auto hidden shrink-0 rounded border bg-background px-1.5 font-sans text-[11px] sm:inline">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1">
              {role === "agent" ? (
                <Button asChild size="sm" className="lg:hidden">
                  <Link href="/app/trips/new">
                    <Plus className="size-4" aria-hidden />
                    <span className="hidden sm:inline">New trip</span>
                    <span className="sr-only sm:hidden">New trip</span>
                  </Link>
                </Button>
              ) : null}
              <NotificationCenter />
              <ProfileMenu user={user} role={role} />
            </div>
          </header>

          <main id="main" className="mx-auto w-full max-w-[1320px] min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-16">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <ul className="grid grid-cols-5">
          {mobileItems.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMoreOpen(true)} className="flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground" aria-haspopup="dialog">
              <MoreHorizontal className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),16px)]">
          <SheetHeader>
            <SheetTitle>{user.workspace}</SheetTitle>
          </SheetHeader>
          <ul className="grid grid-cols-3 gap-2 px-4">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setMoreOpen(false)} className={cn("flex flex-col items-center gap-2 rounded-xl border px-2 py-4 text-[12.5px] font-medium", active ? "border-primary/30 bg-accent text-accent-foreground" : "bg-card")}>
                    <Icon className="size-5" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} role={role} />
    </TooltipProvider>
  );
}

function SidebarButton({ collapsed, label, children }: { collapsed: boolean; label: string; children: ReactNode }) {
  if (!collapsed) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

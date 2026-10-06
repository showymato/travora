"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Update URL search params (resets page) without a full reload. */
function useParamSetter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { set, pending, params };
}

export function SearchInput({ placeholder = "Search…", param = "q", className }: { placeholder?: string; param?: string; className?: string }) {
  const { set, pending, params } = useParamSetter();
  const [value, setValue] = useState(params.get(param) ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => set({ [param]: value.trim() || null }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden" />
      {pending ? (
        <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : value ? (
        <button type="button" onClick={() => setValue("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect({ param, options, placeholder, className }: { param: string; options: { value: string; label: string }[]; placeholder: string; className?: string }) {
  const { set, params } = useParamSetter();
  const current = params.get(param) ?? "all";
  return (
    <Select value={current} onValueChange={(v) => set({ [param]: v === "all" ? null : v })}>
      <SelectTrigger className={cn("w-full sm:w-auto sm:min-w-36", className)} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Segmented tabs driven by a search param (e.g. ?when=upcoming). */
export function SegmentedFilter({ param, options, className }: { param: string; options: { value: string; label: string; count?: number }[]; className?: string }) {
  const { set, params } = useParamSetter();
  const current = params.get(param) ?? "";
  return (
    <div role="tablist" aria-label="Filter" className={cn("scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1", className)}>
      {options.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value || "all"}
            role="tab"
            aria-selected={active}
            onClick={() => set({ [param]: o.value || null })}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined ? <span className={cn("tabular text-[11.5px]", active ? "text-background/70" : "text-muted-foreground/70")}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 border-b px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4", className)}>{children}</div>;
}

export function Pagination({ page, pages, total, pageSize }: { page: number; pages: number; total: number; pageSize: number }) {
  const params = useSearchParams();
  const pathname = usePathname();
  if (total === 0) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex size-8 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t px-4 py-3 text-[13px] text-muted-foreground">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Link href={href(page - 1)} aria-disabled={page <= 1} aria-label="Previous page" className={btn} scroll={false}>
          <ChevronLeft className="size-4" />
        </Link>
        <span className="px-1.5 tabular">
          {page} / {pages}
        </span>
        <Link href={href(page + 1)} aria-disabled={page >= pages} aria-label="Next page" className={btn} scroll={false}>
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}

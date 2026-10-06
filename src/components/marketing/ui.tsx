import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { ITEM_ICON } from "@/components/trips/item-icon";
import { cn } from "@/lib/utils";

export { Wordmark } from "@/components/marketing/wordmark";

export function Eyebrow({ index, children, className }: { index?: string; children: ReactNode; className?: string }) {
  return (
    <p className={cn("eyebrow flex items-center gap-3", className)}>
      {index ? <span className="font-mono text-[11px] tracking-normal text-ivory/55">{index}</span> : null}
      {index ? <span className="h-px w-8 bg-sand/40" aria-hidden /> : null}
      <span>{children}</span>
    </p>
  );
}

/** Section heading: a sans line and an editorial serif line. */
export function Heading({ id, lead, serif, as: Tag = "h2", className, size = "lg" }: { id?: string; lead: ReactNode; serif: ReactNode; as?: "h2" | "h3"; className?: string; size?: "lg" | "xl" }) {
  return (
    <Tag id={id} className={cn("display text-balance text-ivory", size === "xl" ? "text-[40px] sm:text-[60px] lg:text-[76px]" : "text-[34px] sm:text-[48px] lg:text-[58px]", className)}>
      <span className="block">{lead}</span>
      <span className="serif block text-[1.12em] leading-[0.98] text-ivory/95">{serif}</span>
    </Tag>
  );
}

/** A quiet, believable app frame: breadcrumb bar, ⌘K search, initials. */
export function AppWindow({ crumbs, children, className, initials = "RV" }: { crumbs: string[]; children: ReactNode; className?: string; initials?: string }) {
  return (
    <div className={cn("window", className)}>
      <div className="flex h-10 items-center gap-3 border-b border-ivory/8 bg-ivory/[0.015] px-3.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-ivory/15" />
          <span className="size-2 rounded-full bg-ivory/10" />
          <span className="size-2 rounded-full bg-ivory/10" />
        </span>
        <p className="min-w-0 truncate text-[11.5px] text-ivory/55">
          {crumbs.map((c, i) => (
            <span key={c}>
              {i > 0 ? <span className="px-1.5 text-ivory/55">/</span> : null}
              <span className={i === crumbs.length - 1 ? "text-ivory/85" : undefined}>{c}</span>
            </span>
          ))}
        </p>
        <span className="ml-auto hidden items-center gap-2 rounded-md border border-ivory/8 px-2 py-1 text-[11px] text-ivory/60 @[520px]:flex">
          <Search className="size-3" aria-hidden /> Search trips, guests…
          <kbd className="font-mono text-[10px] text-ivory/60">⌘K</kbd>
        </span>
        <span className="ml-auto grid size-6 place-items-center rounded-full bg-sand/15 text-[9.5px] font-semibold text-sand @[520px]:ml-0">{initials}</span>
      </div>
      {children}
    </div>
  );
}

export function StatusPill({ tone = "ok", children }: { tone?: "ok" | "warn" | "info" | "idle"; children: ReactNode }) {
  const tones = {
    ok: "bg-moss/12 text-[#9cc3a5] ring-moss/25",
    warn: "bg-sand/10 text-sand ring-sand/25",
    info: "bg-steel/12 text-[#a9bccd] ring-steel/25",
    idle: "bg-ivory/5 text-ivory/65 ring-ivory/10",
  } as const;
  const dots = { ok: "bg-moss", warn: "bg-sand", info: "bg-steel", idle: "bg-ivory/40" } as const;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", tones[tone])}>
      <span className={cn("size-1.5 rounded-full", dots[tone])} aria-hidden />
      {children}
    </span>
  );
}

/** Itinerary-type icon tile, same vocabulary as the product's ItemIcon. */
export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ITEM_ICON[type] ?? ITEM_ICON.CUSTOM;
  return (
    <span aria-hidden className={cn("inline-grid size-7 shrink-0 place-items-center rounded-md border border-ivory/10 bg-ivory/[0.03] text-ivory/70", className)}>
      <Icon className="size-3.5" />
    </span>
  );
}

export function Meter({ ratio, tone = "sand" }: { ratio: number; tone?: "sand" | "moss" }) {
  return (
    <span className="block h-[3px] w-full overflow-hidden rounded-full bg-ivory/8" aria-hidden>
      <span className={cn("block h-full rounded-full", tone === "moss" ? "bg-moss" : "bg-sand/80")} style={{ width: `${Math.round(ratio * 100)}%` }} />
    </span>
  );
}

/** Small label used inside product previews. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[10.5px] font-medium tracking-[0.14em] text-ivory/60 uppercase", className)}>{children}</p>;
}

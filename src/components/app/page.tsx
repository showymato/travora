import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page title block: optional back link, eyebrow, title, description and actions. */
export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="size-3.5" aria-hidden />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <div className="mb-1.5 text-[13px] text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[30px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Card-like section with a compact header row. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      {title || actions ? (
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  href?: string;
  tone?: "default" | "attention";
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
        <span>{label}</span>
        {icon ? <span className={cn("[&_svg]:size-4", tone === "attention" ? "text-warn" : "text-muted-foreground/70")}>{icon}</span> : null}
      </div>
      <div className="mt-2 text-[26px] leading-none font-semibold tracking-[-0.02em] tabular">{value}</div>
      {hint ? <div className="mt-2 text-[12.5px] text-muted-foreground">{hint}</div> : null}
    </>
  );
  const cls = "block min-w-0 rounded-xl border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-foreground/15 hover:bg-surface/60")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[14px] font-medium">{value}</dd>
    </div>
  );
}

/** Two-column label/value list for detail pages. */
export function DetailList({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[12px] text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 text-[14px] break-words">{v || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

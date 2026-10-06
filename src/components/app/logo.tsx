import { cn } from "@/lib/utils";

/** TRAVORA mark: a route line bending through three stops. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M8 22c3.5 0 4-6 8-6s4.5-6 8-6" fill="none" className="stroke-primary-foreground" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="8" cy="22" r="2.2" className="fill-primary-foreground" />
      <circle cx="16" cy="16" r="1.7" className="fill-primary-foreground/70" />
      <circle cx="24" cy="10" r="2.2" className="fill-teal" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && <span className="text-[15px] font-semibold tracking-[0.18em]">TRAVORA</span>}
    </span>
  );
}

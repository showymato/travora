import { cn } from "@/lib/utils";

/** Marketing mark: the TRAVORA route line through three stops, drawn as a hairline. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ivory", className)}>
      <svg viewBox="0 0 28 28" className="size-[22px]" aria-hidden>
        <circle cx="14" cy="14" r="13.25" fill="none" stroke="currentColor" strokeOpacity=".28" strokeWidth="1.1" />
        <path d="M7 18.5c3 0 3.6-4.6 7-4.6s4-4.4 7-4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="7" cy="18.5" r="1.7" fill="currentColor" />
        <circle cx="21" cy="9.5" r="1.7" className="fill-sand" />
      </svg>
      <span className="text-[13px] font-semibold tracking-[0.32em]">TRAVORA</span>
    </span>
  );
}

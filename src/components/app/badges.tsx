import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AGENCY_STATUS_LABEL, TRIP_STATUS_HINT, TRIP_STATUS_LABEL, type AgencyStatusValue, type TripStatusValue } from "@/lib/labels";
import type { PaymentState } from "@/lib/money";

export type Tone = "neutral" | "info" | "ok" | "warn" | "bad" | "teal" | "brand";

const TONE: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: "bg-idle-soft text-foreground/75 ring-foreground/8", dot: "bg-idle" },
  info: { pill: "bg-info-soft text-info ring-info/15", dot: "bg-info" },
  ok: { pill: "bg-ok-soft text-ok ring-ok/15", dot: "bg-ok" },
  warn: { pill: "bg-warn-soft text-warn ring-warn/20", dot: "bg-warn" },
  bad: { pill: "bg-bad-soft text-bad ring-bad/15", dot: "bg-bad" },
  teal: { pill: "bg-teal-soft text-teal ring-teal/20", dot: "bg-teal" },
  brand: { pill: "bg-secondary text-secondary-foreground ring-primary/10", dot: "bg-primary" },
};

export function Pill({ tone = "neutral", children, dot = true, className, title }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string; title?: string }) {
  const t = TONE[tone];
  return (
    <span title={title} className={cn("inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[12px] font-medium whitespace-nowrap ring-1 ring-inset", t.pill, className)}>
      {dot ? <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}

export const TRIP_TONE: Record<TripStatusValue, Tone> = {
  DRAFT: "neutral",
  PLANNING: "info",
  READY: "brand",
  SENT: "teal",
  CONFIRMED: "ok",
  ONGOING: "ok",
  COMPLETED: "neutral",
  CANCELLED: "bad",
};

export function TripStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status as TripStatusValue;
  return (
    <Pill tone={TRIP_TONE[s] ?? "neutral"} title={TRIP_STATUS_HINT[s]} className={cn(s === "ONGOING" && "[&>span:first-child]:animate-pulse", className)}>
      {TRIP_STATUS_LABEL[s] ?? status}
    </Pill>
  );
}

export function AgencyStatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "ACTIVE" ? "ok" : status === "TRIAL" ? "info" : "bad";
  return <Pill tone={tone}>{AGENCY_STATUS_LABEL[status as AgencyStatusValue] ?? status}</Pill>;
}

export function PaymentBadge({ state }: { state: PaymentState }) {
  const map: Record<PaymentState, [Tone, string]> = { UNPAID: ["warn", "Unpaid"], PARTIAL: ["info", "Partial"], PAID: ["ok", "Paid"] };
  const [tone, label] = map[state];
  return <Pill tone={tone}>{label}</Pill>;
}

export function ConfirmationBadge({ status }: { status: string }) {
  if (status === "CONFIRMED") return <Pill tone="ok">Confirmed</Pill>;
  if (status === "REQUESTED") return <Pill tone="info">Requested</Pill>;
  return <Pill tone="warn">Not confirmed</Pill>;
}

export function PlanBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-md border bg-surface px-2 text-[12px] font-medium text-foreground/80">{name}</span>
  );
}

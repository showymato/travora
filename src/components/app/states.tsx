import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border bg-surface text-muted-foreground [&_svg]:size-5" aria-hidden>
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13.5px] text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-bad-soft text-bad" aria-hidden>
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-[15px] font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-md text-[13.5px] text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Generic page skeleton used by loading.tsx files. */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "dashboard" | "detail" }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-fade-in">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-8 w-64 max-w-full" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      {variant === "dashboard" ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </>
      ) : variant === "detail" ? (
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="mt-8 rounded-xl border bg-card">
          <div className="border-b p-4">
            <Skeleton className="h-9 w-72 max-w-full" />
          </div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="hidden h-4 w-20 md:block" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

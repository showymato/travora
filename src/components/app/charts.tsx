import { cn } from "@/lib/utils";

/**
 * Minimal, single-series charts (one hue, no legend needed — the panel title
 * names the series). Each mark has a native tooltip and is focusable; a visually
 * hidden table carries the same data for screen readers.
 */

export function ColumnChart({ data, format = String, label }: { data: { key: string; label: string; value: number }[]; format?: (n: number) => string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure>
      <div className="flex h-44 items-end gap-2 border-b border-border/80 pt-6" aria-hidden>
        {data.map((d) => {
          const h = Math.round((d.value / max) * 100);
          return (
            <div key={d.key} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${d.label}: ${format(d.value)}`}>
              <span className="pointer-events-none absolute -top-0.5 text-[11.5px] font-medium text-foreground/80 tabular opacity-0 transition-opacity group-hover:opacity-100" style={{ bottom: `calc(${h}% + 4px)`, top: "auto" }}>
                {format(d.value)}
              </span>
              <div className="w-full max-w-10 rounded-t-[4px] bg-chart-1 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(h, d.value ? 2 : 0)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2" aria-hidden>
        {data.map((d) => (
          <span key={d.key} className="min-w-0 flex-1 truncate text-center text-[11.5px] text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Ranked horizontal bars with direct labels (top-N lists). */
export function BarList({ data, format = String, empty = "No data yet." }: { data: { label: string; value: number; href?: string }[]; format?: (n: number) => string; empty?: string }) {
  if (!data.length) return <p className="text-[13.5px] text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} title={`${d.label}: ${format(d.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="truncate">{d.href ? <a href={d.href} className="hover:underline">{d.label}</a> : d.label}</span>
            <span className="shrink-0 font-medium tabular">{format(d.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className={cn("h-full rounded-full bg-chart-1")} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

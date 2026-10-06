import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOTEL_CATEGORY_LABEL, HOTEL_CATEGORY_STARS, type HotelCategoryValue } from "@/lib/labels";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Hotel imagery. Uses the first uploaded photo; otherwise a quiet, generated
 * landscape (ridge lines over a dusk gradient) seeded by the hotel's name so
 * each property is recognisable without stock photos.
 */
export function HotelCover({ name, image, className, rounded = true }: { name: string; image?: string | null; className?: string; rounded?: boolean }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/media/${image}`} alt="" loading="lazy" className={cn("h-full w-full object-cover", rounded && "rounded-lg", className)} />
    );
  }
  const h = hash(name);
  const hue = 200 + (h % 70); // blue → indigo range
  const a = 20 + ((h >> 3) % 25);
  const b = 35 + ((h >> 7) % 30);
  return (
    <div className={cn("relative h-full w-full overflow-hidden", rounded && "rounded-lg", className)} aria-hidden>
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id={`sky-${h}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`oklch(0.86 0.05 ${hue})`} />
            <stop offset="1" stopColor={`oklch(0.95 0.03 ${hue + 40})`} />
          </linearGradient>
        </defs>
        <rect width="320" height="180" fill={`url(#sky-${h})`} />
        <circle cx={60 + (h % 200)} cy={48 + (h % 20)} r="14" fill={`oklch(0.97 0.04 ${hue + 60})`} opacity="0.9" />
        <path d={`M0 ${120 - a / 2} L60 ${80 - a} L110 ${110 - a / 3} L170 ${70 - b / 2} L230 ${105 - a / 2} L290 ${78 - a / 3} L320 ${96} V180 H0Z`} fill={`oklch(0.62 0.06 ${hue})`} opacity="0.55" />
        <path d={`M0 ${140 - b / 3} L50 ${118 - a / 2} L120 ${138 - b / 4} L190 ${112 - a / 3} L250 ${134 - b / 4} L320 ${120 - a / 4} V180 H0Z`} fill={`oklch(0.45 0.07 ${hue + 10})`} opacity="0.8" />
        <path d="M0 160 Q80 150 160 158 T320 154 V180 H0Z" fill={`oklch(0.32 0.06 ${hue + 15})`} />
      </svg>
    </div>
  );
}

export function Stars({ category, className }: { category: string; className?: string }) {
  const n = HOTEL_CATEGORY_STARS[category as HotelCategoryValue] ?? 3;
  const label = HOTEL_CATEGORY_LABEL[category as HotelCategoryValue] ?? category;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground", className)} title={label}>
      <span className="inline-flex" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <Star key={i} className="size-3 fill-current text-warn" />
        ))}
      </span>
      <span className="sr-only">{label}</span>
      {category === "LUXURY" || category === "BOUTIQUE" ? <span aria-hidden>{label}</span> : null}
    </span>
  );
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  const hue = 220 + (hash(name) % 60);
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", className)}
      style={{ background: `oklch(0.93 0.03 ${hue})`, color: `oklch(0.38 0.08 ${hue})` }}
    >
      {initials || "?"}
    </span>
  );
}

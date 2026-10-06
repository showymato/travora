"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Wordmark } from "@/components/marketing/wordmark";
import { cn } from "@/lib/utils";

const LINKS = [
  ["Product", "#product"],
  ["How it works", "#how-it-works"],
  ["Pricing", "#pricing"],
  ["Security", "#security"],
  ["Resources", "#resources"],
] as const;

/** Transparent over the hero; turns into a translucent bar with a hairline once you scroll. */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-500",
        solid ? "border-ivory/8 bg-ink/75 backdrop-blur-xl backdrop-saturate-150" : "border-transparent bg-transparent",
      )}
    >
      <nav aria-label="Main" className="mx-auto flex max-w-[1384px] items-center gap-8 px-4 py-3.5 sm:px-8">
        <Link href="/" aria-label="TRAVORA home" className="shrink-0 rounded-md">
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-7 text-[13.5px] text-ivory/70 lg:flex">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <a href={href} className="rounded-sm transition-colors duration-300 hover:text-ivory">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <Link href="/login" className="hidden rounded-full px-3 py-2 text-[13.5px] text-ivory/80 transition-colors hover:text-ivory sm:inline-flex">
            Sign in
          </Link>
          <a href="#cta" className="btn-ivory btn-sm">
            Get started <ArrowRight className="arrow size-3.5" aria-hidden />
          </a>
          <button
            type="button"
            className="inline-grid size-10 place-items-center rounded-full text-ivory/85 hover:text-ivory lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </nav>
      <div id="mobile-menu" hidden={!open} className="border-t border-ivory/8 px-4 pt-2 pb-6 sm:px-8 lg:hidden">
        <ul className="divide-y divide-ivory/8">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <a href={href} onClick={() => setOpen(false)} className="flex items-center justify-between py-3.5 text-[17px] text-ivory/90">
                {label}
                <ArrowRight className="size-4 text-ivory/60" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link href="/login" className="btn-line">
            Sign in
          </Link>
          <a href="#cta" onClick={() => setOpen(false)} className="btn-ivory">
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}

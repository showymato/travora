import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/context";
import { homeFor } from "@/server/auth/session";
import { Logo } from "@/components/app/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const actor = await getActor();
  if (actor) redirect(homeFor(actor));
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const showDev = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_CREDENTIALS === "true";

  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" aria-label="TRAVORA home" className="w-fit">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Sign in</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">Welcome back. Your trips are where you left them.</p>
          <LoginForm next={next} />
          {showDev ? (
            <div className="mt-8 rounded-xl border border-dashed bg-surface/60 p-4 text-[12.5px] text-muted-foreground">
              <p className="font-medium text-foreground">Development credentials</p>
              <p className="mt-1">Seeded by <code className="font-mono">npm run db:seed</code>. Never use these in production.</p>
              <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12px]">
                <dt>Super Admin</dt>
                <dd>admin@travora.local</dd>
                <dt>Agent</dt>
                <dd>demo@travora.local</dd>
                <dt>Password</dt>
                <dd>Travora@2026</dd>
              </dl>
            </div>
          ) : null}
        </div>
        <p className="text-[12px] text-muted-foreground">© {new Date().getFullYear()} TRAVORA · The operating system for travel agencies</p>
      </div>
      <aside className="relative hidden overflow-hidden border-l bg-[oklch(0.22_0.05_268)] lg:block" aria-hidden>
        <div className="bg-dots absolute inset-0 opacity-[0.35] [--foreground:white]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <p className="max-w-md text-[26px] leading-snug font-medium tracking-[-0.015em] text-white/95">
            “Our team used to run every trip on WhatsApp and Excel. Now the whole operation lives in one place.”
          </p>
          <div className="space-y-3">
            {[
              ["09:30", "Airport pickup", "Srinagar Airport → Blanco Hotel"],
              ["14:00", "Check-in", "Royal Kashmir, Gulmarg"],
              ["17:30", "Sunset shikara", "Dal Lake"],
            ].map(([t, a, b]) => (
              <div key={t} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
                <span className="w-12 font-mono text-[12.5px] text-white/60">{t}</span>
                <div>
                  <div className="text-[14px] font-medium">{a}</div>
                  <div className="text-[12.5px] text-white/60">{b}</div>
                </div>
              </div>
            ))}
            <p className="pt-3 text-[12.5px] text-white/50">Illustrative example. Every morning, the day&apos;s operations in one view.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

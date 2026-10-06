import type { Metadata } from "next";
import Link from "next/link";
import { requireActor } from "@/server/auth/context";
import { homeFor } from "@/server/auth/session";
import { db } from "@/server/db";
import { Logo } from "@/components/app/logo";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Change password" };

export default async function PasswordPage() {
  const actor = await requireActor();
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { mustChangePassword: true } });
  return (
    <div className="flex min-h-dvh flex-col px-6 py-8 sm:px-12">
      <Link href={homeFor(actor)} aria-label="TRAVORA home" className="w-fit">
        <Logo />
      </Link>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{user.mustChangePassword ? "Choose your password" : "Change password"}</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          {user.mustChangePassword ? "You signed in with a temporary password. Set your own to continue." : "Use at least 10 characters. You'll stay signed in on this device."}
        </p>
        <PasswordForm home={homeFor(actor)} forced={user.mustChangePassword} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "@/components/app/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-10 font-mono text-[13px] text-muted-foreground">404</p>
      <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">This page isn&apos;t available</h1>
      <p className="mt-2 max-w-sm text-[14.5px] text-muted-foreground">The link may be mistyped, expired or replaced. If someone shared it with you, ask them for a new link.</p>
      <Link href="/" className="mt-6 text-[14px] font-medium text-primary underline-offset-4 hover:underline">
        Go to TRAVORA
      </Link>
    </div>
  );
}

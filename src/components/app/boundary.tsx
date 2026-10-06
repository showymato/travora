"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "./states";

/** Shared body for error.tsx files: friendly message, retry, no stack traces. */
export function RouteError({ error, retry, home }: { error: Error & { digest?: string }; retry: () => void; home: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorState
      title="Something went wrong while loading this page"
      description={
        <>
          It&apos;s probably temporary. Try again, or go back to the dashboard.
          {error.digest ? <span className="mt-2 block font-mono text-[11.5px]">Reference: {error.digest}</span> : null}
        </>
      }
      action={
        <div className="flex gap-2">
          <Button onClick={() => retry()}>
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href={home}>Dashboard</Link>
          </Button>
        </div>
      }
    />
  );
}

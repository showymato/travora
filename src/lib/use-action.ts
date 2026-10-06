"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/server/errors";

type Options<T> = {
  /** Toast on success; defaults to the action's own message. false = silent. */
  success?: string | false | ((data: T) => string | false);
  onSuccess?: (data: T) => void;
  onError?: (r: Extract<ActionResult<T>, { ok: false }>) => void;
  /** Re-render server components after success (default true). */
  refresh?: boolean;
};

/**
 * Run a server action with a pending flag, toasts and a router refresh.
 * Errors are always shown — nothing fails silently.
 */
export function useAction<A extends unknown[], T>(action: (...args: A) => Promise<ActionResult<T>>, opts: Options<T> = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<Extract<ActionResult<T>, { ok: false }> | null>(null);

  const run = useCallback(
    (...args: A) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let res: ActionResult<T>;
          try {
            res = await action(...args);
          } catch {
            res = { ok: false, code: "INTERNAL_ERROR", message: "We couldn't reach the server. Check your connection and try again." };
          }
          if (res.ok) {
            setError(null);
            const msg = typeof opts.success === "function" ? opts.success(res.data) : opts.success === undefined ? res.message : opts.success;
            if (msg) toast.success(msg);
            opts.onSuccess?.(res.data);
            if (opts.refresh !== false) router.refresh();
          } else {
            setError(res);
            toast.error(res.message);
            opts.onError?.(res);
          }
          resolve(res);
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action, router],
  );

  return { run, pending, error };
}

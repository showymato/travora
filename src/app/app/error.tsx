"use client";

import { RouteError } from "@/components/app/boundary";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError error={error} retry={retry} home="/app" />;
}

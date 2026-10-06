import "server-only";
import { NextResponse } from "next/server";
import { toPublicError } from "./errors";

/** JSON error response with a stable shape; never leaks internals. */
export function errorResponse(err: unknown) {
  const e = toPublicError(err);
  return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
}

/** Stream a private file with download-safe headers. */
export function fileResponse(bytes: Buffer, opts: { contentType: string; fileName: string; inline?: boolean; cache?: string }) {
  const safeName = opts.fileName.replace(/[^\w.\- ()]/g, "_");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": opts.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${opts.inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": opts.cache ?? "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Images can't run anything; the CSP sandbox would also block the
      // browser's built-in PDF viewer, so it's applied to non-PDF files only.
      ...(opts.contentType === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}

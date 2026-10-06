// Domain errors carry a stable code and an HTTP status. Anything else that
// escapes a service is logged and replaced by a generic message — stack traces
// never reach the browser.

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "AGENCY_SUSPENDED"
  | "INVALID_FILE"
  | "EMAIL_FAILED"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INVALID_CREDENTIALS: 401,
  AGENCY_SUSPENDED: 403,
  INVALID_FILE: 400,
  EMAIL_FAILED: 502,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: { fieldErrors?: Record<string, string> },
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found.`);
export const forbidden = (msg = "You do not have access to this resource.") => new AppError("FORBIDDEN", msg);
export const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  new AppError("VALIDATION_ERROR", message, fieldErrors ? { fieldErrors } : undefined);

export function toPublicError(err: unknown): {
  code: ErrorCode;
  message: string;
  status: number;
  fieldErrors?: Record<string, string>;
} {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, status: err.status, fieldErrors: err.details?.fieldErrors };
  }
  // Zod errors that escaped a service: surface the first issue, not internals.
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as { issues: unknown }).issues)) {
    const issues = (err as { issues: { path: PropertyKey[]; message: string }[] }).issues;
    const fieldErrors: Record<string, string> = {};
    for (const i of issues) {
      const k = i.path.map(String).join(".");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { code: "VALIDATION_ERROR", message: issues[0]?.message ?? "Check the highlighted fields.", status: 400, fieldErrors };
  }
  console.error("[internal]", err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : err);
  return { code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again.", status: 500 };
}

/** Result type for server actions (they cannot throw rich errors to the client). */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string> };

function isNextControlFlow(err: unknown) {
  if (!err || typeof err !== "object" || !("digest" in err)) return false;
  const digest = (err as { digest: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (err) {
    // redirect()/notFound() must keep propagating.
    if (isNextControlFlow(err)) throw err;
    const e = toPublicError(err);
    return { ok: false, code: e.code, message: e.message, fieldErrors: e.fieldErrors };
  }
}

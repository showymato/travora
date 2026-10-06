"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActor, requestMeta } from "../auth/context";
import { changePassword, login } from "../auth/service";
import { destroySession, homeFor, SESSION_COOKIE } from "../auth/session";
import { runAction, type ActionResult } from "../errors";
import { passwordChangeSchema } from "@/lib/schemas";

const cookieOpts = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

const loginSchema = z.object({ email: z.string().trim().max(200).pipe(z.email()), password: z.string().min(1).max(200) });

export async function loginAction(_prev: ActionResult<string> | null, form: FormData): Promise<ActionResult<string>> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "Enter your email and password." };
  const result = await runAction(async () => {
    const { actor, token, expiresAt, mustChangePassword } = await login(parsed.data, await requestMeta());
    (await cookies()).set(SESSION_COOKIE, token, cookieOpts(expiresAt));
    return mustChangePassword ? "/account/password" : homeFor(actor);
  });
  if (result.ok) {
    const next = String(form.get("next") ?? "");
    // Only same-site relative paths, and only into the area this role owns.
    const target = result.data !== "/account/password" && (next === result.data || next.startsWith(result.data + "/")) && !next.startsWith("//") ? next : result.data;
    redirect(target);
  }
  return result;
}

export async function logoutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePasswordAction(input: unknown): Promise<ActionResult<string>> {
  return runAction(async () => {
    const actor = await getActor();
    if (!actor) redirect("/login");
    const v = passwordChangeSchema.parse(input);
    await changePassword(actor, { current: v.current, next: v.next });
    return homeFor(actor);
  }, "Password updated.");
}

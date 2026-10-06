import { NextResponse } from "next/server";
import { runDaily } from "@/server/cron";
import { safeEqual } from "@/server/auth/crypto";

// Called by Vercel Cron (Authorization: Bearer $CRON_SECRET).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16 || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Unauthorized." } }, { status: 401 });
  }
  const result = await runDaily();
  return NextResponse.json({ ok: true, ...result });
}

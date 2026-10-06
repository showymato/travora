import { NextResponse } from "next/server";
import { readDocumentForGuest } from "@/server/documents/service";
import { fileResponse } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

// Guest access to shared documents via the trip's secret token.
export async function GET(req: Request, ctx: RouteContext<"/api/trip/[token]/documents/[id]">) {
  const { token, id } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = await rateLimit(`guestdoc:${ip}`, 120, 60 * 10);
  if (!rl.allowed) return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many requests." } }, { status: 429 });
  const res = await readDocumentForGuest(token, id);
  if (!res) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return fileResponse(res.bytes, { contentType: "application/pdf", fileName: `${res.doc.title}.pdf`, inline });
}

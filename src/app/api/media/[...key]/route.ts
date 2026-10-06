import { NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { fileResponse } from "@/server/http";

// Public hotel marketing images only. Everything else in storage is private
// and served through authorised routes.
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[...key]">) {
  const { key } = await ctx.params;
  const path = key.join("/");
  if (!/^hotels\/[a-z0-9]+\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(path)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });
  }
  const file = await storage().get(path);
  if (!file) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });
  return fileResponse(file.bytes, { contentType: file.contentType, fileName: path.split("/").pop()!, inline: true, cache: "public, max-age=86400, immutable" });
}

import { getActor } from "@/server/auth/context";
import { readDocument } from "@/server/documents/service";
import { errorResponse, fileResponse } from "@/server/http";

// Agency-scoped PDF access. readDocument enforces the tenant check.
export async function GET(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  try {
    const { id } = await ctx.params;
    const { doc, bytes } = await readDocument(await getActor(), id);
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    return fileResponse(bytes, { contentType: "application/pdf", fileName: `${doc.title}.pdf`, inline });
  } catch (err) {
    return errorResponse(err);
  }
}

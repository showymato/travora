import { getActor } from "@/server/auth/context";
import { readGuestDocument } from "@/server/guests";
import { errorResponse, fileResponse } from "@/server/http";

// Private guest ID documents. Tenant-checked and audited on every read.
export async function GET(req: Request, ctx: RouteContext<"/api/guest-documents/[id]">) {
  try {
    const { id } = await ctx.params;
    const file = await readGuestDocument(await getActor(), id);
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    return fileResponse(file.bytes, { contentType: file.contentType, fileName: file.fileName, inline });
  } catch (err) {
    return errorResponse(err);
  }
}

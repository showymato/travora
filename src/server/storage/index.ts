import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Private object storage. Keys are opaque paths like
 * `agencies/<agencyId>/guests/<guestId>/<random>.pdf`. Nothing here ever
 * hands a storage URL to the browser: files are streamed through routes that
 * authorise every request (`/api/files/...`) or, for the guest trip page,
 * through the trip's secret share token.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
export function contentTypeFor(key: string) {
  return TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

const SAFE_KEY = /^[A-Za-z0-9_\-/]+\.[a-z0-9]+$/;
function assertKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

/** Local disk. Development only: serverless filesystems are ephemeral. */
export class LocalStorage implements StorageProvider {
  readonly name = "local";
  constructor(private readonly root: string) {}
  private file(key: string) {
    assertKey(key);
    const full = path.resolve(/*turbopackIgnore: true*/ this.root, key);
    if (!full.startsWith(path.resolve(/*turbopackIgnore: true*/ this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, bytes: Buffer) {
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, bytes);
  }
  async get(key: string) {
    try {
      return { bytes: await fs.readFile(this.file(key)), contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await fs.rm(this.file(key), { force: true });
  }
}

/** Vercel Blob in private mode. Requires BLOB_READ_WRITE_TOKEN (or OIDC + BLOB_STORE_ID). */
export class VercelBlobStorage implements StorageProvider {
  readonly name = "vercel-blob";
  constructor(private readonly prefix: string) {}
  private path(key: string) {
    assertKey(key);
    return this.prefix ? `${this.prefix}/${key}` : key;
  }
  async put(key: string, bytes: Buffer, contentType: string) {
    const { put } = await import("@vercel/blob");
    await put(this.path(key), bytes, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
  }
  async get(key: string) {
    const { get } = await import("@vercel/blob");
    const res = await get(this.path(key), { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    return { bytes: Buffer.from(await new Response(res.stream).arrayBuffer()), contentType: res.blob.contentType };
  }
  async delete(key: string) {
    const { del } = await import("@vercel/blob");
    await del(this.path(key));
  }
}

let instance: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (instance) return instance;
  const kind = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (kind === "vercel-blob") instance = new VercelBlobStorage(process.env.STORAGE_BUCKET ?? "");
  else if (kind === "local") {
    if (process.env.VERCEL) throw new Error("STORAGE_PROVIDER=local does not persist on Vercel; use vercel-blob.");
    instance = new LocalStorage(path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.STORAGE_LOCAL_DIR ?? ".data/uploads"));
  } else throw new Error(`Unknown STORAGE_PROVIDER "${kind}"`);
  return instance;
}

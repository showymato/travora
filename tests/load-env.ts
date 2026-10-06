import fs from "node:fs";
import path from "node:path";

/** Load .env, then point DATABASE_URL at the (disposable) test database. */
export function loadTestEnv() {
  const file = path.resolve(__dirname, "../.env");
  const fromFile: Record<string, string> = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
      if (!m) continue;
      fromFile[m[1]] = m[2];
      if (process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required to run tests");
  // Tests wipe their database — never let that be the development one.
  if (fromFile.DATABASE_URL && process.env.TEST_DATABASE_URL === fromFile.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.AUTH_SECRET ||= "test-auth-secret-0123456789abcdef";
  process.env.EMAIL_PROVIDER = "log";
  process.env.STORAGE_PROVIDER = "local";
  process.env.STORAGE_LOCAL_DIR = ".data/test-uploads";
  process.env.APP_URL = "http://localhost:3000";
}

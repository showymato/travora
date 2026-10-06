// Local development Postgres without Docker.
//
// Starts a real PostgreSQL server (embedded-postgres ships official binaries)
// and keeps it running in the foreground. Any other Postgres works too: just
// point DATABASE_URL at it and skip this script.
//
// The data directory lives OUTSIDE the repo by default, because cloud-synced
// folders (OneDrive/Dropbox) lock files that a live Postgres is writing.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const port = Number(process.env.LOCAL_PG_PORT ?? 5434);
const baseDir =
  process.env.LOCAL_PG_DIR ??
  path.join(
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "share"),
    "travora",
    "pgdata",
  );

const pg = new EmbeddedPostgres({
  databaseDir: baseDir,
  user: "travora",
  password: "travora",
  port,
  persistent: true,
  // Without these, initdb on Windows picks the WIN1252 code page and the
  // database can't store "₹" or "→".
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

const fresh = !fs.existsSync(path.join(baseDir, "PG_VERSION"));
if (fresh) {
  console.log(`[db] initialising new cluster in ${baseDir}`);
  await pg.initialise();
}
await pg.start();

for (const name of ["travora", "travora_test"]) {
  try {
    await pg.createDatabase(name);
    console.log(`[db] created database ${name}`);
  } catch {
    // already exists
  }
}

console.log(`[db] Postgres ready on postgresql://travora:travora@localhost:${port}/travora`);
console.log("[db] Ctrl+C to stop.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// keep the process alive
setInterval(() => {}, 1 << 30);

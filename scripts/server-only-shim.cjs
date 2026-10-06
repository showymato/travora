// Lets CLI scripts (seed, tests) import server modules that start with
// `import "server-only"`. Next.js still enforces the guard in the app.
const Module = require("node:module");
const path = require("node:path");
const empty = path.join(__dirname, "empty.cjs");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return empty;
  return original.call(this, request, ...rest);
};

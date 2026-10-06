import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // react-hook-form's watch() is intentionally used for live form UI; the
      // compiler simply skips memoising those components.
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // CommonJS by necessity: preloaded with `tsx --require` for the seed script.
    files: ["scripts/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "screenshots/**",
    ".data/**",
  ]),
]);

export default eslintConfig;

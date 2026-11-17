/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Module boundaries (see STRUCTURE.md):
  // common/ is shared by every module, so it must never depend on a module.
  {
    files: ["common/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/modules/*", "@/modules/**"], message: "common/ must not import from modules/. Move the shared piece into common/, or pass it in from the module." },
            { group: ["@/app/*", "@/app/**"], message: "common/ must not import from app/ routes." },
          ],
        },
      ],
    },
  },
  // Modules and shared code don't import route files; routes import modules.
  {
    files: ["modules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/app/*", "@/app/**"], message: "Modules must not import from app/ routes. Routes import modules, not the other way round." }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

// Same rules as the web app (platform/web), plus this module's boundary: it may use the platform's
// shared code (@/common/*) but not another module's screens or the platform's routes and pages.
import { defineConfig } from "eslint/config";
import platform from "../../../platform/web/eslint.config.mjs";

export default defineConfig([
  ...platform,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/app/*", "@/app/**"], message: "Modules must not import from app/ routes. Routes import modules, not the other way round." },
            { group: ["@/modules/*", "@/modules/**"], message: "Use the platform's shared code (@/common/*), not its pages and screens." },
          ],
        },
      ],
      // A package has no pages/ folder; links are checked in platform/web.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  // Tests may set up data through the platform.
  { files: ["**/*.test.{ts,tsx}"], rules: { "no-restricted-imports": "off" } },
]);

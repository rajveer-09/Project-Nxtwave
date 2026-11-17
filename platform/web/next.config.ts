/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { join } from "node:path";
import type { NextConfig } from "next";

// The repo root: the module frontends (modules/*/frontend) live outside this folder.
const repoRoot = join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Each module's screens are a workspace package (modules/<module>/frontend), compiled with the app.
  transpilePackages: ["@nxtone/attendance-ui", "@nxtone/contest-ui", "@nxtone/interactions-ui"],
  outputFileTracingRoot: repoRoot,
  experimental: {
    // Pages opened in the last 30 s reopen from the browser without a server round trip
    // (fully prefetched sidebar pages: 3 min). Saves still refresh at once.
    staleTimes: { dynamic: 30, static: 180 },
  },
  partialPrefetching: true,
  turbopack: {
    root: repoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

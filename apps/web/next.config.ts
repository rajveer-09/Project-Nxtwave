/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // Pages opened in the last 30 s reopen from the browser without a server round trip
    // (fully prefetched sidebar pages: 3 min). Saves still refresh at once.
    staleTimes: { dynamic: 30, static: 180 },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

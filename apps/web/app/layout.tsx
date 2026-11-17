/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { TooltipProvider } from "@/common/ui/tooltip";
import { Toaster } from "@/common/ui/sonner";
import { cn } from "@/common/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export const metadata: Metadata = {
  title: { default: "NxtOne", template: "%s · NxtOne" },
  description: "NxtOne by NxtWave.",
  applicationName: "NxtOne",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn(inter.variable, spaceGrotesk.variable)}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}

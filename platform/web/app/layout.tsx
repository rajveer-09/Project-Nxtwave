/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import type { Metadata } from "next";
import { Inter, Noto_Sans_Telugu, Space_Grotesk } from "next/font/google";
import { TooltipProvider } from "@/common/ui/tooltip";
import { Toaster } from "@/common/ui/sonner";
import { WebVitals } from "@/common/components/web-vitals";
import { ThemeProvider } from "@/common/components/theme";
import { cn } from "@/common/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
// Telugu student reports and feedback. Not preloaded: the browser fetches it only where Telugu text is shown.
const notoTelugu = Noto_Sans_Telugu({ subsets: ["telugu"], weight: ["400", "500", "600", "700"], variable: "--font-noto-telugu", preload: false });

export const metadata: Metadata = {
  title: { default: "NxtOne", template: "%s · NxtOne" },
  description: "NxtOne by NxtWave.",
  applicationName: "NxtOne",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn(inter.variable, spaceGrotesk.variable, notoTelugu.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
        <WebVitals />
      </body>
    </html>
  );
}

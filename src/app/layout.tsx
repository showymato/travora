import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, themeScript, type ThemePref } from "@/components/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "TRAVORA — The Operating System for Travel Agencies", template: "%s · TRAVORA" },
  description: "Plan every trip. Manage every guest. Organize every detail. TRAVORA replaces WhatsApp, spreadsheets and manual itineraries with one workspace for travel agencies.",
  applicationName: "TRAVORA",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#16171c" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const pref = ((await cookies()).get("tv_theme")?.value ?? "system") as ThemePref;
  const theme: ThemePref = ["light", "dark", "system"].includes(pref) ? pref : "system";
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ThemeProvider initial={theme}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

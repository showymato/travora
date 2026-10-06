import type { Metadata } from "next";
import { SiteNav } from "@/components/marketing/site-nav";
import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { SystemMap } from "@/components/marketing/system-map";
import { Lifecycle } from "@/components/marketing/lifecycle";
import { CommandCenter, GuestExperience, ItineraryBuilder, ThreeViews } from "@/components/marketing/features";
import { FinalCta, Footer, Pricing, Questions, Security } from "@/components/marketing/closing";

export const metadata: Metadata = {
  title: "TRAVORA — The Operating System for Travel Agencies",
  description: "Plan trips. Coordinate suppliers. Manage guests. Get paid. TRAVORA brings trips, guests, hotels, suppliers, itineraries, payments and documents into one workspace for travel agencies.",
  openGraph: {
    title: "TRAVORA — The Operating System for Travel Agencies",
    description: "Travel agencies shouldn't run on WhatsApp, Excel and memory. One workspace for every journey.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <>
      <a href="#main" className="sr-only z-[70] rounded-full bg-ivory px-4 py-2 text-[13px] text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <Problem />
        <SystemMap />
        <Lifecycle />
        <CommandCenter />
        <ItineraryBuilder />
        <GuestExperience />
        <ThreeViews />
        <Security />
        <Pricing />
        <Questions />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

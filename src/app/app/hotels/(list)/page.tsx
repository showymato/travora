import type { Metadata } from "next";
import { BedDouble } from "lucide-react";
import { requireAgentPage } from "@/server/auth/context";
import { listAgentHotels } from "@/server/hotels";
import { PageHeader } from "@/components/app/page";
import { EmptyState } from "@/components/app/states";
import { FilterSelect, SearchInput } from "@/components/app/list-controls";
import { HotelCard } from "@/components/hotels/hotel-card";
import { HOTEL_CATEGORIES, HOTEL_CATEGORY_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Hotels" };

export default async function AgentHotelsPage({ searchParams }: PageProps<"/app/hotels">) {
  const actor = await requireAgentPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const dest = typeof sp.destination === "string" ? sp.destination : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const all = await listAgentHotels(actor);
  const destinations = [...new Map(all.filter((h) => h.destinationId).map((h) => [h.destinationId!, h.destination!])).entries()];
  const hotels = all.filter((h) => (!q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q)) && (!dest || h.destinationId === dest) && (!category || h.category === category));

  return (
    <>
      <PageHeader title="Hotels" description={`${all.length} hotels available to ${actor.agencyName}. Prices are your agency's nightly rates.`} />
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search hotels or locations…" />
        <FilterSelect param="destination" placeholder="All destinations" options={destinations.map(([value, label]) => ({ value, label }))} />
        <FilterSelect param="category" placeholder="Any category" options={HOTEL_CATEGORIES.map((c) => ({ value: c, label: HOTEL_CATEGORY_LABEL[c] }))} />
      </div>
      {hotels.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hotels.map((h) => (
            <HotelCard key={h.id} hotel={h} href={`/app/hotels/${h.id}`} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={<BedDouble />}
            title={all.length ? "No hotels match" : "No hotels assigned yet"}
            description={all.length ? "Try another search or filter." : "Your TRAVORA administrator decides which hotels your agency can book. Contact them to get access."}
          />
        </div>
      )}
    </>
  );
}

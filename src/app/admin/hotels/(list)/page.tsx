import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, Plus } from "lucide-react";
import type { HotelCategory } from "@prisma/client";
import { requireAdminPage } from "@/server/auth/context";
import { listDestinations, listHotelsAdmin } from "@/server/hotels";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page";
import { Pill } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { HotelCover, Stars } from "@/components/app/visuals";
import { FilterSelect, SearchInput } from "@/components/app/list-controls";
import { formatINR } from "@/lib/money";
import { HOTEL_CATEGORIES, HOTEL_CATEGORY_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Hotels" };

export default async function AdminHotels({ searchParams }: PageProps<"/admin/hotels">) {
  const actor = await requireAdminPage();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const category = ((HOTEL_CATEGORIES as readonly string[]).includes(str("category")) ? str("category") : "") as HotelCategory | "";
  const [hotels, destinations] = await Promise.all([listHotelsAdmin(actor, { q: str("q"), category, destination: str("destination"), status: str("status") }), listDestinations()]);
  return (
    <>
      <PageHeader
        title="Hotels"
        description="The platform hotel catalogue. Control which agencies see each hotel and what they pay."
        actions={
          <Button asChild>
            <Link href="/admin/hotels/new">
              <Plus className="size-4" aria-hidden /> New hotel
            </Link>
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SearchInput placeholder="Search hotels…" />
        <FilterSelect param="destination" placeholder="All destinations" options={destinations.map((d) => ({ value: d.id, label: d.name }))} />
        <FilterSelect param="category" placeholder="Any category" options={HOTEL_CATEGORIES.map((c) => ({ value: c, label: HOTEL_CATEGORY_LABEL[c] }))} />
        <FilterSelect param="status" placeholder="Any status" options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
      </div>
      {hotels.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hotels.map((h) => (
            <Link key={h.id} href={`/admin/hotels/${h.id}`} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
              <div className="aspect-[16/8]">
                <HotelCover name={h.name} image={h.images[0]} rounded={false} />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold group-hover:underline">{h.name}</p>
                  <Stars category={h.category} />
                </div>
                <p className="text-[12.5px] text-muted-foreground">{h.location}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                  <span>{h.rooms.length} room types</span>
                  <span>{h._count.agencies} agencies</span>
                  <span>{h._count.tripHotels} stays booked</span>
                  {h.status === "INACTIVE" ? <Pill>Inactive</Pill> : null}
                </div>
                {h.rooms[0] ? (
                  <p className="mt-2 text-[13px]">
                    Base from <span className="font-semibold tabular">{formatINR(h.rooms[0].baseRate)}</span>
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={<BedDouble />} title="No hotels found" description="Add the first hotel to the catalogue." action={<Button asChild><Link href="/admin/hotels/new"><Plus className="size-4" aria-hidden /> New hotel</Link></Button>} />
        </div>
      )}
    </>
  );
}

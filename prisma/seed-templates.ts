// Platform itinerary templates (fictional but realistic Kashmir programmes).
import type { ItineraryItemType } from "@prisma/client";

type I = [time: string | null, type: ItineraryItemType, title: string, location?: string, description?: string, durationMins?: number];
type D = { title: string; summary?: string; items: I[] };
export type SeedTemplate = { name: string; description: string; destination: string; nights: number; tags: string[]; days: D[] };

const arrivalSrinagar: D = {
  title: "Arrival in Srinagar",
  summary: "Airport pickup, check-in and an evening on Dal Lake.",
  items: [
    [null, "AIRPORT_ARRIVAL", "Arrive at Srinagar airport", "Sheikh ul-Alam International Airport"],
    [null, "TRANSPORT", "Transfer to hotel", "Airport → Srinagar", "Private car with driver.", 45],
    ["14:00", "HOTEL_CHECK_IN", "Hotel check-in", "Srinagar"],
    ["17:00", "ACTIVITY", "Shikara ride on Dal Lake", "Dal Lake", "One-hour shikara ride past the floating gardens and markets.", 60],
    ["20:00", "MEAL", "Dinner at the hotel", "Srinagar"],
  ],
};
const srinagarSights: D = {
  title: "Srinagar — Mughal gardens",
  summary: "The three great Mughal gardens and the old city.",
  items: [
    ["09:30", "SIGHTSEEING", "Nishat Bagh", "Srinagar", "Terraced 17th-century garden on the eastern shore of Dal Lake.", 75],
    ["11:15", "SIGHTSEEING", "Shalimar Bagh", "Srinagar", undefined, 60],
    ["13:00", "MEAL", "Lunch — Kashmiri wazwan", "Srinagar"],
    ["15:00", "SIGHTSEEING", "Pari Mahal & Chashme Shahi", "Zabarwan range", undefined, 90],
    ["18:00", "FREE_TIME", "Evening at leisure", "Boulevard Road"],
  ],
};
const toGulmarg: D = {
  title: "Srinagar → Gulmarg",
  summary: "Drive to the meadow of flowers; Gondola ride.",
  items: [
    ["09:00", "HOTEL_CHECK_OUT", "Check-out", "Srinagar"],
    ["09:30", "TRANSPORT", "Drive to Gulmarg", "Srinagar → Gulmarg", "About 2 hours by road.", 120],
    ["12:00", "HOTEL_CHECK_IN", "Hotel check-in", "Gulmarg"],
    ["14:00", "ACTIVITY", "Gulmarg Gondola (Phase 1 & 2)", "Gulmarg", "Cable car to Kongdoori and Apharwat. Tickets subject to weather.", 180],
    ["19:30", "MEAL", "Dinner", "Gulmarg"],
  ],
};
const gulmargDay: D = {
  title: "Gulmarg",
  summary: "Meadows, St. Mary's church and optional skiing or pony rides.",
  items: [
    ["10:00", "SIGHTSEEING", "Gulmarg meadows & St. Mary's Church", "Gulmarg", undefined, 120],
    ["13:00", "MEAL", "Lunch", "Gulmarg"],
    ["14:30", "ACTIVITY", "Pony ride to Khilanmarg (optional)", "Gulmarg", "Payable locally.", 150],
  ],
};
const toPahalgam: D = {
  title: "Gulmarg → Pahalgam",
  summary: "Scenic drive via saffron fields and Avantipora ruins.",
  items: [
    ["08:30", "HOTEL_CHECK_OUT", "Check-out", "Gulmarg"],
    ["09:00", "TRANSPORT", "Drive to Pahalgam", "Gulmarg → Pahalgam", "About 4.5 hours with stops.", 270],
    ["11:30", "SIGHTSEEING", "Saffron fields & Avantipora ruins", "Pampore", undefined, 45],
    ["14:30", "HOTEL_CHECK_IN", "Hotel check-in", "Pahalgam"],
    ["17:00", "FREE_TIME", "Walk along the Lidder river", "Pahalgam"],
  ],
};
const pahalgamDay: D = {
  title: "Pahalgam — valleys",
  summary: "Aru, Betaab and Chandanwari valleys by local cab.",
  items: [
    ["09:30", "SIGHTSEEING", "Betaab Valley", "Pahalgam", "Local union cab required (payable locally).", 90],
    ["11:30", "SIGHTSEEING", "Chandanwari", "Pahalgam", undefined, 90],
    ["14:00", "MEAL", "Lunch", "Pahalgam"],
    ["15:30", "SIGHTSEEING", "Aru Valley", "Pahalgam", undefined, 120],
  ],
};
const toSrinagarDepart: D = {
  title: "Departure",
  summary: "Check-out and transfer to Srinagar airport.",
  items: [
    ["08:00", "HOTEL_CHECK_OUT", "Check-out", "Pahalgam"],
    ["08:30", "TRANSPORT", "Transfer to Srinagar airport", "Pahalgam → Srinagar airport", "About 3 hours.", 180],
    [null, "AIRPORT_DEPARTURE", "Depart Srinagar", "Sheikh ul-Alam International Airport"],
  ],
};
const departSrinagar: D = {
  title: "Departure",
  items: [
    ["10:00", "HOTEL_CHECK_OUT", "Check-out", "Srinagar"],
    ["10:30", "TRANSPORT", "Transfer to airport", "Srinagar → Airport", undefined, 45],
    [null, "AIRPORT_DEPARTURE", "Depart Srinagar", "Sheikh ul-Alam International Airport"],
  ],
};
const sonamargDay: D = {
  title: "Day trip to Sonamarg",
  summary: "The meadow of gold and Thajiwas glacier.",
  items: [
    ["08:30", "TRANSPORT", "Drive to Sonamarg", "Srinagar → Sonamarg", "About 2.5 hours.", 150],
    ["11:30", "SIGHTSEEING", "Thajiwas Glacier", "Sonamarg", "Pony or walk; payable locally.", 180],
    ["15:30", "TRANSPORT", "Return to Srinagar", "Sonamarg → Srinagar", undefined, 150],
  ],
};
const houseboatNight: D = {
  title: "Houseboat evening",
  summary: "Old city walk and a night aboard a houseboat.",
  items: [
    ["10:00", "SIGHTSEEING", "Old city heritage walk", "Downtown Srinagar", "Jamia Masjid, Khanqah-e-Moula, Zaina Kadal.", 150],
    ["15:00", "FREE_TIME", "Leisure", "Srinagar"],
    ["18:30", "ACTIVITY", "Sunset on Nigeen Lake", "Nigeen Lake", undefined, 60],
  ],
};

export const SEED_TEMPLATES: SeedTemplate[] = [
  { name: "Kashmir 4N / 5D", description: "Srinagar and Gulmarg essentials for a short break.", destination: "Kashmir", nights: 4, tags: ["Classic"], days: [arrivalSrinagar, srinagarSights, toGulmarg, gulmargDay, { ...departSrinagar, items: [["09:00", "HOTEL_CHECK_OUT", "Check-out", "Gulmarg"], ["09:30", "TRANSPORT", "Transfer to Srinagar airport", "Gulmarg → Srinagar airport", undefined, 150], [null, "AIRPORT_DEPARTURE", "Depart Srinagar", "Sheikh ul-Alam International Airport"]] }] },
  { name: "Kashmir 5N / 6D", description: "Srinagar, Gulmarg and Pahalgam at an easy pace.", destination: "Kashmir", nights: 5, tags: ["Classic"], days: [arrivalSrinagar, srinagarSights, toGulmarg, toPahalgam, pahalgamDay, toSrinagarDepart] },
  { name: "Kashmir 6N / 7D", description: "The full circuit: Srinagar, Gulmarg and Pahalgam with a free day.", destination: "Kashmir", nights: 6, tags: ["Classic", "Bestseller"], days: [arrivalSrinagar, srinagarSights, toGulmarg, gulmargDay, toPahalgam, pahalgamDay, toSrinagarDepart] },
  { name: "Kashmir 7N / 8D", description: "Adds Sonamarg and a houseboat night to the full circuit.", destination: "Kashmir", nights: 7, tags: ["Classic"], days: [arrivalSrinagar, srinagarSights, sonamargDay, toGulmarg, gulmargDay, toPahalgam, pahalgamDay, toSrinagarDepart] },
  { name: "Kashmir Honeymoon", description: "Slow mornings, a houseboat evening and private transfers.", destination: "Kashmir", nights: 5, tags: ["Honeymoon", "Couples"], days: [arrivalSrinagar, houseboatNight, toGulmarg, toPahalgam, pahalgamDay, toSrinagarDepart] },
  { name: "Kashmir Family", description: "Shorter drives and kid-friendly stops; pony rides optional.", destination: "Kashmir", nights: 6, tags: ["Family"], days: [arrivalSrinagar, srinagarSights, toGulmarg, gulmargDay, toPahalgam, pahalgamDay, toSrinagarDepart] },
  { name: "Kashmir Luxury", description: "Five-star stays, private guide and curated dining.", destination: "Kashmir", nights: 6, tags: ["Luxury"], days: [arrivalSrinagar, srinagarSights, houseboatNight, toGulmarg, gulmargDay, toPahalgam, toSrinagarDepart] },
  { name: "Kashmir Budget", description: "Value hotels and shared sightseeing; Srinagar and Gulmarg.", destination: "Kashmir", nights: 4, tags: ["Budget"], days: [arrivalSrinagar, srinagarSights, sonamargDay, toGulmarg, { ...departSrinagar, items: [["09:00", "HOTEL_CHECK_OUT", "Check-out", "Gulmarg"], ["09:30", "TRANSPORT", "Transfer to Srinagar airport", "Gulmarg → Srinagar airport", undefined, 150], [null, "AIRPORT_DEPARTURE", "Depart Srinagar", "Sheikh ul-Alam International Airport"]] }] },
];

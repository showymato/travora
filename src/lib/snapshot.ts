// The guest-facing view of a trip. A TripVersion stores one of these; the
// public trip page renders only from it, so guests always see the last
// version the agent published — never half-finished edits — and internal data
// (rates, notes, other guests' IDs, payments) is never included.

export type SnapshotItem = {
  time: string | null;
  type: string;
  title: string;
  description: string | null;
  location: string | null;
  durationMins: number | null;
};

export type TripSnapshot = {
  schema: 1;
  agency: { name: string; email: string | null; phone: string | null; address: string | null };
  trip: {
    code: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    nights: number;
    travelers: { adults: number; children: number; infants: number };
    destinations: string[];
    status: string;
  };
  guests: { name: string; primary: boolean }[];
  days: { dayNumber: number; date: string; title: string | null; summary: string | null; items: SnapshotItem[] }[];
  hotels: {
    name: string;
    category: string;
    location: string;
    address: string | null;
    phone: string | null;
    checkIn: string;
    checkOut: string;
    checkInTime: string;
    checkOutTime: string;
    confirmationNumber: string | null;
    confirmed: boolean;
    rooms: { name: string; quantity: number; mealPlan: string }[];
  }[];
  transports: {
    kind: string;
    date: string;
    time: string | null;
    pickup: string;
    dropoff: string;
    vehicle: string | null;
    vehicleNumber: string | null;
    driverName: string | null;
    driverPhone: string | null;
  }[];
  agent: { name: string | null };
  publishedAt: string;
};

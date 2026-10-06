// Human labels for enum values. Kept free of Prisma runtime imports so client
// components can use them.

export const TRIP_STATUSES = ["DRAFT", "PLANNING", "READY", "SENT", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"] as const;
export type TripStatusValue = (typeof TRIP_STATUSES)[number];

export const TRIP_STATUS_LABEL: Record<TripStatusValue, string> = {
  DRAFT: "Draft",
  PLANNING: "Planning",
  READY: "Ready",
  SENT: "Sent",
  CONFIRMED: "Confirmed",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TRIP_STATUS_HINT: Record<TripStatusValue, string> = {
  DRAFT: "Still being set up",
  PLANNING: "Itinerary in progress",
  READY: "Reviewed, not yet sent",
  SENT: "Shared with the guest",
  CONFIRMED: "Guest confirmed",
  ONGOING: "Guest is travelling",
  COMPLETED: "Trip finished",
  CANCELLED: "Cancelled",
};

/** Manual transitions an agent may make from each status. */
export const TRIP_TRANSITIONS: Record<TripStatusValue, TripStatusValue[]> = {
  DRAFT: ["PLANNING", "CANCELLED"],
  PLANNING: ["READY", "CANCELLED"],
  READY: ["PLANNING", "CANCELLED"], // READY → SENT happens via "Send to guest"
  SENT: ["CONFIRMED", "PLANNING", "CANCELLED"],
  CONFIRMED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: ["PLANNING"],
};

export const HOTEL_CATEGORIES = ["THREE_STAR", "FOUR_STAR", "FIVE_STAR", "LUXURY", "BOUTIQUE"] as const;
export type HotelCategoryValue = (typeof HOTEL_CATEGORIES)[number];
export const HOTEL_CATEGORY_LABEL: Record<HotelCategoryValue, string> = {
  THREE_STAR: "3 Star",
  FOUR_STAR: "4 Star",
  FIVE_STAR: "5 Star",
  LUXURY: "Luxury",
  BOUTIQUE: "Boutique",
};
export const HOTEL_CATEGORY_STARS: Record<HotelCategoryValue, number> = {
  THREE_STAR: 3,
  FOUR_STAR: 4,
  FIVE_STAR: 5,
  LUXURY: 5,
  BOUTIQUE: 4,
};

export const MEAL_PLANS = ["EP", "CP", "MAP", "AP"] as const;
export type MealPlanValue = (typeof MEAL_PLANS)[number];
export const MEAL_PLAN_LABEL: Record<MealPlanValue, string> = {
  EP: "Room only (EP)",
  CP: "Breakfast (CP)",
  MAP: "Breakfast + dinner (MAP)",
  AP: "All meals (AP)",
};
export const MEAL_PLAN_SHORT: Record<MealPlanValue, string> = { EP: "EP", CP: "CP", MAP: "MAP", AP: "AP" };

export const TRANSPORT_KINDS = ["AIRPORT_TRANSFER", "INTERCITY", "LOCAL", "CUSTOM"] as const;
export type TransportKindValue = (typeof TRANSPORT_KINDS)[number];
export const TRANSPORT_KIND_LABEL: Record<TransportKindValue, string> = {
  AIRPORT_TRANSFER: "Airport transfer",
  INTERCITY: "Intercity transfer",
  LOCAL: "Local transfer",
  CUSTOM: "Custom transport",
};

export const ACTIVITY_KINDS = ["SIGHTSEEING", "ACTIVITY", "EXPERIENCE", "MEAL", "FREE_TIME", "CUSTOM"] as const;
export type ActivityKindValue = (typeof ACTIVITY_KINDS)[number];
export const ACTIVITY_KIND_LABEL: Record<ActivityKindValue, string> = {
  SIGHTSEEING: "Sightseeing",
  ACTIVITY: "Activity",
  EXPERIENCE: "Experience",
  MEAL: "Meal",
  FREE_TIME: "Free time",
  CUSTOM: "Custom",
};

export const ITEM_TYPES = [
  "FLIGHT",
  "TRAIN",
  "AIRPORT_ARRIVAL",
  "AIRPORT_DEPARTURE",
  "HOTEL_CHECK_IN",
  "HOTEL_CHECK_OUT",
  "TRANSPORT",
  "SIGHTSEEING",
  "ACTIVITY",
  "MEAL",
  "FREE_TIME",
  "CUSTOM",
  "NOTE",
] as const;
export type ItemTypeValue = (typeof ITEM_TYPES)[number];
export const ITEM_TYPE_LABEL: Record<ItemTypeValue, string> = {
  FLIGHT: "Flight",
  TRAIN: "Train",
  AIRPORT_ARRIVAL: "Airport arrival",
  AIRPORT_DEPARTURE: "Airport departure",
  HOTEL_CHECK_IN: "Hotel check-in",
  HOTEL_CHECK_OUT: "Hotel check-out",
  TRANSPORT: "Transport",
  SIGHTSEEING: "Sightseeing",
  ACTIVITY: "Activity",
  MEAL: "Meal",
  FREE_TIME: "Free time",
  CUSTOM: "Custom event",
  NOTE: "Note",
};

export const ID_TYPES = ["PASSPORT", "AADHAAR", "PAN", "DRIVING_LICENCE", "VOTER_ID", "OTHER"] as const;
export type IdTypeValue = (typeof ID_TYPES)[number];
export const ID_TYPE_LABEL: Record<IdTypeValue, string> = {
  PASSPORT: "Passport",
  AADHAAR: "Aadhaar",
  PAN: "PAN card",
  DRIVING_LICENCE: "Driving licence",
  VOTER_ID: "Voter ID",
  OTHER: "Other",
};

export const GENDERS = ["FEMALE", "MALE", "OTHER", "UNDISCLOSED"] as const;
export const GENDER_LABEL: Record<(typeof GENDERS)[number], string> = {
  FEMALE: "Female",
  MALE: "Male",
  OTHER: "Other",
  UNDISCLOSED: "Prefer not to say",
};

export const PAYMENT_METHODS = ["UPI", "BANK_TRANSFER", "CARD", "CASH", "CHEQUE", "RAZORPAY", "OTHER"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethodValue, string> = {
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  CASH: "Cash",
  CHEQUE: "Cheque",
  RAZORPAY: "Razorpay",
  OTHER: "Other",
};

export const DOCUMENT_KINDS = [
  "ITINERARY",
  "TRIP_CONFIRMATION",
  "HOTEL_VOUCHER",
  "TRANSPORT_VOUCHER",
  "INVOICE",
  "PAYMENT_RECEIPT",
  "GUEST_SUMMARY",
] as const;
export type DocumentKindValue = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABEL: Record<DocumentKindValue, string> = {
  ITINERARY: "Itinerary",
  TRIP_CONFIRMATION: "Trip confirmation",
  HOTEL_VOUCHER: "Hotel voucher",
  TRANSPORT_VOUCHER: "Transport voucher",
  INVOICE: "Invoice",
  PAYMENT_RECEIPT: "Payment receipt",
  GUEST_SUMMARY: "Guest summary",
};
export const DOCUMENT_KIND_HINT: Record<DocumentKindValue, string> = {
  ITINERARY: "Day-by-day plan with hotels and transfers",
  TRIP_CONFIRMATION: "Booking summary the guest can keep",
  HOTEL_VOUCHER: "One voucher per hotel stay",
  TRANSPORT_VOUCHER: "All transfers with driver details",
  INVOICE: "Itemised invoice with tax",
  PAYMENT_RECEIPT: "Receipt for the latest payment",
  GUEST_SUMMARY: "Traveller list for hotels and drivers",
};

export const PLAN_CODES = ["STARTER", "GROWTH", "PROFESSIONAL", "ENTERPRISE"] as const;
export type PlanCodeValue = (typeof PLAN_CODES)[number];

export const AGENCY_STATUSES = ["ACTIVE", "TRIAL", "SUSPENDED"] as const;
export type AgencyStatusValue = (typeof AGENCY_STATUSES)[number];
export const AGENCY_STATUS_LABEL: Record<AgencyStatusValue, string> = { ACTIVE: "Active", TRIAL: "Trial", SUSPENDED: "Suspended" };

export const CONFIRMATION_LABEL = { PENDING: "Not requested", REQUESTED: "Requested", CONFIRMED: "Confirmed" } as const;

export const AMENITIES = [
  "Wi-Fi",
  "Parking",
  "Restaurant",
  "Room service",
  "Spa",
  "Pool",
  "Gym",
  "Bar",
  "Airport shuttle",
  "Heating",
  "Lake view",
  "Mountain view",
  "Garden",
  "Family rooms",
  "Fireplace",
  "Ski storage",
  "Business centre",
  "Laundry",
] as const;

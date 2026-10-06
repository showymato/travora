// Zod schemas shared by client forms (react-hook-form) and server services.
// The server always re-validates; client validation is for fast feedback.
//
// Optional text fields are plain strings ("" = empty) so form input and
// output types match; services convert "" to null with `nul()`.

import { z } from "zod";
import {
  ACTIVITY_KINDS,
  AGENCY_STATUSES,
  GENDERS,
  HOTEL_CATEGORIES,
  ID_TYPES,
  ITEM_TYPES,
  MEAL_PLANS,
  PAYMENT_METHODS,
  PLAN_CODES,
  TRANSPORT_KINDS,
} from "./labels";

const req = (label: string, max = 120) => z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);
const opt = (max = 500) => z.string().trim().max(max, "Too long.");
const phoneRe = /^[+0-9 ()-]{7,20}$/;
const optPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || phoneRe.test(v), "Enter a valid phone number.");
const reqPhone = z.string().trim().min(1, "Phone is required.").regex(phoneRe, "Enter a valid phone number.");
const optEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email.");
const reqEmail = z.string().trim().min(1, "Email is required.").pipe(z.email("Enter a valid email."));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const optIsoDate = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a valid date.");
const time = z.string().refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Use HH:MM.");
const money = z.number({ error: "Enter an amount." }).int("Whole rupees only.").min(0, "Can't be negative.").max(100_000_000, "Amount is too large.");

export const nul = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

// ---- Agencies ----------------------------------------------------------------

export const agencyProfileSchema = z.object({
  name: req("Agency name"),
  ownerName: req("Owner name"),
  email: reqEmail,
  phone: reqPhone,
  city: opt(80),
  state: opt(80),
  country: opt(80),
  address: opt(300),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[0-9A-Z]{15}$/.test(v), "GSTIN is 15 letters/digits."),
});

export const agencyCreateSchema = agencyProfileSchema.extend({
  plan: z.enum(PLAN_CODES),
  status: z.enum(AGENCY_STATUSES),
  loginEmail: reqEmail,
  tempPassword: z.string().min(10, "Use at least 10 characters.").max(200),
});
export type AgencyCreateInput = z.infer<typeof agencyCreateSchema>;

export const agencyUpdateSchema = agencyProfileSchema.extend({ plan: z.enum(PLAN_CODES) });
export type AgencyUpdateInput = z.infer<typeof agencyUpdateSchema>;

export const agencySettingsSchema = z.object({
  name: req("Agency name"),
  supportEmail: optEmail,
  supportPhone: optPhone,
  address: opt(300),
  gstNumber: agencyProfileSchema.shape.gstNumber,
});
export type AgencySettingsInput = z.infer<typeof agencySettingsSchema>;

// ---- Hotels ------------------------------------------------------------------

export const hotelSchema = z.object({
  name: req("Hotel name"),
  category: z.enum(HOTEL_CATEGORIES),
  description: opt(2000),
  destination: req("Destination", 80),
  location: req("Location", 120),
  address: opt(300),
  latitude: z.string().refine((v) => v === "" || (Number(v) >= -90 && Number(v) <= 90), "Latitude is -90 to 90."),
  longitude: z.string().refine((v) => v === "" || (Number(v) >= -180 && Number(v) <= 180), "Longitude is -180 to 180."),
  phone: optPhone,
  email: optEmail,
  website: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), "Use a full URL (https://…)."),
  amenities: z.array(z.string().trim().min(1).max(40)).max(40),
  checkInTime: time.refine((v) => v !== "", "Required."),
  checkOutTime: time.refine((v) => v !== "", "Required."),
  cancellationPolicy: opt(2000),
  notes: opt(2000),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export type HotelInput = z.infer<typeof hotelSchema>;

export const roomSchema = z.object({
  name: req("Room name", 80),
  description: opt(1000),
  capacity: z.number().int().min(1, "At least 1 guest.").max(20),
  bedConfig: opt(80),
  inventory: z.number().int().min(1, "At least 1 room.").max(500),
  baseRate: money.min(1, "Base rate is required."),
  mealPlans: z.array(z.enum(MEAL_PLANS)).min(1, "Pick at least one meal plan."),
  amenities: z.array(z.string().trim().min(1).max(40)).max(30),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export type RoomInput = z.infer<typeof roomSchema>;

export const ratesSchema = z.object({
  roomId: z.string().min(1),
  rates: z.array(z.object({ agencyId: z.string().min(1), rate: money.nullable() })).max(500),
});

// ---- Templates -------------------------------------------------------------

export const templateItemSchema = z.object({
  time,
  type: z.enum(ITEM_TYPES),
  title: req("Title", 140),
  description: opt(1500),
  location: opt(140),
  durationMins: z.number().int().min(0).max(24 * 60).nullable(),
  notes: opt(1000),
});
export type TemplateItemInput = z.infer<typeof templateItemSchema>;

export const templateSchema = z.object({
  name: req("Template name", 100),
  description: opt(600),
  destination: req("Destination", 80),
  nights: z.number().int().min(1, "At least 1 night.").max(30, "30 nights at most."),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  days: z
    .array(
      z.object({
        title: opt(120),
        summary: opt(600),
        items: z.array(templateItemSchema).max(30),
      }),
    )
    .max(31),
});
export type TemplateInput = z.infer<typeof templateSchema>;

// ---- Guests ------------------------------------------------------------------

export const guestSchema = z.object({
  fullName: req("Full name", 120),
  phone: optPhone,
  email: optEmail,
  whatsapp: optPhone,
  nationality: opt(60),
  dateOfBirth: optIsoDate.refine((v) => v === "" || v <= new Date().toISOString().slice(0, 10), "Date of birth can't be in the future."),
  gender: z.enum([...GENDERS, ""]),
  address: opt(300),
  idType: z.enum([...ID_TYPES, ""]),
  idNumber: opt(40),
  notes: opt(2000),
});
export type GuestInput = z.infer<typeof guestSchema>;

// ---- Trips -------------------------------------------------------------------

export const tripTravelersSchema = z.object({
  primaryGuestId: z.string().min(1, "Choose the primary guest."),
  guestIds: z.array(z.string().min(1)).max(40),
  adults: z.number().int().min(1, "At least one adult.").max(60),
  children: z.number().int().min(0).max(40),
  infants: z.number().int().min(0).max(20),
});
export type TripTravelersInput = z.infer<typeof tripTravelersSchema>;

export const tripDatesSchema = z
  .object({ startDate: isoDate, endDate: isoDate })
  .refine((v) => v.endDate > v.startDate, { message: "Departure must be after arrival.", path: ["endDate"] })
  .refine((v) => (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86_400_000 <= 60, {
    message: "Trips can be at most 60 nights.",
    path: ["endDate"],
  });
export type TripDatesInput = z.infer<typeof tripDatesSchema>;

export const tripDestinationsSchema = z.object({
  destinations: z
    .array(z.object({ name: req("Destination", 80), destinationId: z.string().nullable(), nights: z.number().int().min(0).max(60).nullable() }))
    .max(15, "15 destinations at most."),
});

export const stayCreateSchema = z
  .object({ hotelId: z.string().min(1, "Choose a hotel."), checkIn: isoDate, checkOut: isoDate })
  .refine((v) => v.checkOut > v.checkIn, { message: "Check-out must be after check-in.", path: ["checkOut"] });
export type StayCreateInput = z.infer<typeof stayCreateSchema>;

export const stayRoomSchema = z
  .object({
    roomId: z.string().min(1, "Choose a room type."),
    quantity: z.number().int().min(1, "At least 1 room.").max(50),
    guests: z.number().int().min(1, "At least 1 guest.").max(100),
    mealPlan: z.enum(MEAL_PLANS),
    checkIn: isoDate,
    checkOut: isoDate,
  })
  .refine((v) => v.checkOut > v.checkIn, { message: "Check-out must be after check-in.", path: ["checkOut"] });
export type StayRoomInput = z.infer<typeof stayRoomSchema>;

export const stayUpdateSchema = z
  .object({
    checkIn: isoDate,
    checkOut: isoDate,
    confirmationStatus: z.enum(["PENDING", "REQUESTED", "CONFIRMED"]),
    confirmationNumber: opt(60),
    notes: opt(1000),
  })
  .refine((v) => v.checkOut > v.checkIn, { message: "Check-out must be after check-in.", path: ["checkOut"] });
export type StayUpdateInput = z.infer<typeof stayUpdateSchema>;

export const transportSchema = z.object({
  kind: z.enum(TRANSPORT_KINDS),
  date: isoDate,
  time,
  pickup: req("Pickup", 140),
  dropoff: req("Drop", 140),
  vehicle: opt(80),
  driverName: opt(80),
  driverPhone: optPhone,
  vehicleNumber: opt(30),
  notes: opt(1000),
  price: money,
  addToItinerary: z.boolean(),
});
export type TransportInput = z.infer<typeof transportSchema>;

export const activitySchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  date: isoDate,
  time,
  title: req("Title", 140),
  location: opt(140),
  description: opt(1500),
  durationMins: z.number().int().min(0).max(24 * 60).nullable(),
  notes: opt(1000),
  price: money,
  addToItinerary: z.boolean(),
});
export type ActivityInput = z.infer<typeof activitySchema>;

export const itineraryItemSchema = templateItemSchema;
export type ItineraryItemInput = z.infer<typeof itineraryItemSchema>;

export const paymentSchema = z.object({
  amount: money.min(1, "Enter an amount."),
  paidAt: isoDate,
  method: z.enum(PAYMENT_METHODS),
  reference: opt(80),
  notes: opt(500),
  notifyGuest: z.boolean(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const sendTripSchema = z.object({
  message: opt(1000),
  email: z.boolean(),
});

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(10, "Use at least 10 characters.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Passwords don't match.", path: ["confirm"] });

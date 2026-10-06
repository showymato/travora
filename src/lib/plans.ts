// Subscription plans. Seeded into SubscriptionPlan and shown on the pricing page.
export const PLANS = [
  { code: "STARTER", name: "Starter", priceMonthly: 2499, maxUsers: 2, maxTripsMonthly: 30, features: ["Trips & itineraries", "Guest records", "PDF documents", "Guest trip pages"] },
  { code: "GROWTH", name: "Growth", priceMonthly: 5999, maxUsers: 5, maxTripsMonthly: 120, features: ["Everything in Starter", "Itinerary templates", "Agent-specific hotel rates", "Payment tracking"] },
  { code: "PROFESSIONAL", name: "Professional", priceMonthly: 11999, maxUsers: 15, maxTripsMonthly: null, features: ["Everything in Growth", "Unlimited trips", "Reports", "Priority support"] },
  { code: "ENTERPRISE", name: "Enterprise", priceMonthly: 29999, maxUsers: 100, maxTripsMonthly: null, features: ["Everything in Professional", "Custom templates", "SSO (on request)", "Dedicated success manager"] },
] as const;

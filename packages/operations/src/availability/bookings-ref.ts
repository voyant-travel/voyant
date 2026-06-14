import { boolean, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core"

/**
 * Minimal references to bookings tables so availability service methods can
 * count active reservations per option_unit. No FKs — availability must not
 * take a compile-time dependency on bookings to keep the dependency graph
 * flowing bookings → availability only.
 */
export const bookingsRef = pgTable("bookings", {
  id: text("id").primaryKey(),
  bookingNumber: text("booking_number").notNull(),
  status: text("status").notNull(),
  contactFirstName: text("contact_first_name"),
  contactLastName: text("contact_last_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  sellCurrency: text("sell_currency"),
  pax: integer("pax"),
})

export const bookingItemsRef = pgTable("booking_items", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  productId: text("product_id"),
  optionId: text("option_id"),
  optionUnitId: text("option_unit_id"),
  quantity: integer("quantity").notNull().default(1),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
})

export const bookingAllocationsRef = pgTable("booking_allocations", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  bookingItemId: text("booking_item_id").notNull(),
  productId: text("product_id"),
  optionId: text("option_id"),
  optionUnitId: text("option_unit_id"),
  availabilitySlotId: text("availability_slot_id"),
  quantity: integer("quantity").notNull().default(1),
  status: text("status").notNull(),
})

export const bookingTravelersRef = pgTable("booking_travelers", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  personId: text("person_id"),
  participantType: text("participant_type").notNull(),
  travelerCategory: text("traveler_category"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").notNull(),
})

export const bookingTravelerTravelDetailsRef = pgTable("booking_traveler_travel_details", {
  travelerId: text("traveler_id").primaryKey(),
  dietaryEncrypted: jsonb("dietary_encrypted"),
  accessibilityEncrypted: jsonb("accessibility_encrypted"),
  isLeadTraveler: boolean("is_lead_traveler").notNull(),
  sharingGroupId: text("sharing_group_id"),
  roomTypeId: text("room_type_id"),
  bedPreference: text("bed_preference"),
  allocations: jsonb("allocations").$type<Record<string, string>>().notNull(),
})

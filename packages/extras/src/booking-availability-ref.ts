import { boolean, date, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const availabilitySlotsRef = pgTable("availability_slots", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  optionId: text("option_id"),
  dateLocal: date("date_local").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  timezone: text("timezone").notNull(),
  status: text("status").notNull(),
})

export const bookingsRef = pgTable("bookings", {
  id: text("id").primaryKey(),
  bookingNumber: text("booking_number").notNull(),
  status: text("status").notNull(),
  contactFirstName: text("contact_first_name"),
  contactLastName: text("contact_last_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  sellCurrency: text("sell_currency").notNull(),
})

export const bookingTravelersRef = pgTable("booking_travelers", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  participantType: text("participant_type").notNull(),
  travelerCategory: text("traveler_category"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
})

export const bookingItemsRef = pgTable("booking_items", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  itemType: text("item_type").notNull(),
  status: text("status").notNull(),
  quantity: integer("quantity").notNull(),
  sellCurrency: text("sell_currency").notNull(),
  unitSellAmountCents: integer("unit_sell_amount_cents"),
  totalSellAmountCents: integer("total_sell_amount_cents"),
  productId: text("product_id"),
  optionId: text("option_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
})

export const bookingItemTravelersRef = pgTable("booking_item_travelers", {
  id: text("id").primaryKey(),
  bookingItemId: text("booking_item_id").notNull(),
  travelerId: text("traveler_id").notNull(),
  role: text("role").notNull(),
  isPrimary: boolean("is_primary").notNull(),
})

export const bookingAllocationsRef = pgTable("booking_allocations", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  bookingItemId: text("booking_item_id").notNull(),
  availabilitySlotId: text("availability_slot_id"),
  status: text("status").notNull(),
})

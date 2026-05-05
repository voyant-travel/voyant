import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { boolean, date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const productsRef = pgTable("products", {
  id: typeId("products").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  description: text("description"),
  visibility: text("visibility").notNull(),
  activated: boolean("activated").notNull().default(false),
  reservationTimeoutMinutes: integer("reservation_timeout_minutes"),
  sellCurrency: text("sell_currency").notNull(),
  sellAmountCents: integer("sell_amount_cents"),
  costAmountCents: integer("cost_amount_cents"),
  marginPercent: integer("margin_percent"),
  supplierId: text("supplier_id"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  pax: integer("pax"),
})

export const suppliersRef = pgTable("suppliers", {
  id: typeId("suppliers").primaryKey(),
  reservationTimeoutMinutes: integer("reservation_timeout_minutes"),
})

export const productOptionsRef = pgTable("product_options", {
  id: typeId("product_options").primaryKey(),
  productId: typeIdRef("product_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const optionUnitsRef = pgTable("option_units", {
  id: typeId("option_units").primaryKey(),
  optionId: typeIdRef("option_id").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  unitType: text("unit_type"),
  isRequired: boolean("is_required").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  minQuantity: integer("min_quantity"),
  maxQuantity: integer("max_quantity"),
  minAge: integer("min_age"),
  maxAge: integer("max_age"),
  occupancyMin: integer("occupancy_min"),
  occupancyMax: integer("occupancy_max"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const productItinerariesRef = pgTable("product_itineraries", {
  id: typeId("product_itineraries").primaryKey(),
  productId: typeIdRef("product_id").notNull(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
})

// product_days was re-parented to product_itineraries in products, so the
// historical `product_days.product_id` column no longer exists. Bookings'
// getConvertProductData joins through product_itineraries to keep the
// per-product day lookup working.
export const productDaysRef = pgTable("product_days", {
  id: typeId("product_days").primaryKey(),
  itineraryId: typeIdRef("itinerary_id").notNull(),
  dayNumber: integer("day_number").notNull(),
})

export const productDayServicesRef = pgTable("product_day_services", {
  id: typeId("product_day_services").primaryKey(),
  dayId: typeIdRef("day_id").notNull(),
  supplierServiceId: text("supplier_service_id"),
  serviceType: text("service_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  costCurrency: text("cost_currency").notNull(),
  costAmountCents: integer("cost_amount_cents").notNull(),
  quantity: integer("quantity").notNull().default(1),
  sortOrder: integer("sort_order"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const productTicketSettingsRef = pgTable("product_ticket_settings", {
  id: typeId("product_ticket_settings").primaryKey(),
  productId: typeIdRef("product_id").notNull(),
  fulfillmentMode: text("fulfillment_mode").notNull(),
  defaultDeliveryFormat: text("default_delivery_format").notNull(),
  ticketPerUnit: boolean("ticket_per_unit").notNull().default(false),
})

export const bookingProductDetailsRef = pgTable("booking_product_details", {
  bookingId: text("booking_id").primaryKey(),
  productId: text("product_id"),
  optionId: text("option_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const bookingItemProductDetailsRef = pgTable("booking_item_product_details", {
  bookingItemId: text("booking_item_id").primaryKey(),
  productId: text("product_id"),
  optionId: text("option_id"),
  unitId: text("unit_id"),
  supplierServiceId: text("supplier_service_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

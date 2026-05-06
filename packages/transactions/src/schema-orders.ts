import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import type { KmsEnvelope } from "@voyantjs/db/schema/iam"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { offerItems, offers } from "./schema-offers.js"
import {
  orderStatusEnum,
  orderTermAcceptanceStatusEnum,
  orderTermTypeEnum,
  transactionItemParticipantRoleEnum,
  transactionItemStatusEnum,
  transactionItemTypeEnum,
  transactionParticipantTypeEnum,
  transactionTravelerCategoryEnum,
} from "./schema-shared.js"

export const orders = pgTable(
  "orders",
  {
    id: typeId("orders"),
    orderNumber: text("order_number").notNull().unique(),
    offerId: typeIdRef("offer_id").references(() => offers.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    status: orderStatusEnum("status").notNull().default("draft"),
    personId: text("person_id"),
    organizationId: text("organization_id"),
    opportunityId: text("opportunity_id"),
    quoteId: text("quote_id"),
    marketId: text("market_id"),
    sourceChannelId: text("source_channel_id"),
    contactFirstName: text("contact_first_name"),
    contactLastName: text("contact_last_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    contactPreferredLanguage: text("contact_preferred_language"),
    contactCountry: text("contact_country"),
    contactRegion: text("contact_region"),
    contactCity: text("contact_city"),
    contactAddressLine1: text("contact_address_line1"),
    contactPostalCode: text("contact_postal_code"),
    currency: text("currency").notNull(),
    baseCurrency: text("base_currency"),
    fxRateSetId: text("fx_rate_set_id"),
    subtotalAmountCents: integer("subtotal_amount_cents").notNull().default(0),
    taxAmountCents: integer("tax_amount_cents").notNull().default(0),
    feeAmountCents: integer("fee_amount_cents").notNull().default(0),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    costAmountCents: integer("cost_amount_cents").notNull().default(0),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_orders_created").on(table.createdAt),
    index("idx_orders_offer_created").on(table.offerId, table.createdAt),
    index("idx_orders_status_created").on(table.status, table.createdAt),
    index("idx_orders_person_created").on(table.personId, table.createdAt),
    index("idx_orders_organization_created").on(table.organizationId, table.createdAt),
    index("idx_orders_opportunity_created").on(table.opportunityId, table.createdAt),
    index("idx_orders_quote_created").on(table.quoteId, table.createdAt),
    index("idx_orders_market_created").on(table.marketId, table.createdAt),
    index("idx_orders_channel").on(table.sourceChannelId),
    index("idx_orders_fx_rate_set").on(table.fxRateSetId),
  ],
)

export const orderParticipants = pgTable(
  "order_participants",
  {
    id: typeId("order_participants"),
    orderId: typeIdRef("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    personId: text("person_id"),
    participantType: transactionParticipantTypeEnum("participant_type")
      .notNull()
      .default("traveler"),
    travelerCategory: transactionTravelerCategoryEnum("traveler_category"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    preferredLanguage: text("preferred_language"),
    identityEncrypted: jsonb("identity_encrypted").$type<KmsEnvelope>(),
    isPrimary: boolean("is_primary").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_order_participants_order_created").on(table.orderId, table.createdAt),
    index("idx_order_participants_person_created").on(table.personId, table.createdAt),
    index("idx_order_participants_type").on(table.participantType),
  ],
)

export const orderItems = pgTable(
  "order_items",
  {
    id: typeId("order_items"),
    orderId: typeIdRef("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    offerItemId: typeIdRef("offer_item_id").references(() => offerItems.id, {
      onDelete: "set null",
    }),
    productId: text("product_id"),
    optionId: text("option_id"),
    unitId: text("unit_id"),
    slotId: text("slot_id"),
    title: text("title").notNull(),
    description: text("description"),
    itemType: transactionItemTypeEnum("item_type").notNull().default("unit"),
    status: transactionItemStatusEnum("status").notNull().default("draft"),
    serviceDate: date("service_date"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    quantity: integer("quantity").notNull().default(1),
    sellCurrency: text("sell_currency").notNull(),
    unitSellAmountCents: integer("unit_sell_amount_cents"),
    totalSellAmountCents: integer("total_sell_amount_cents"),
    taxAmountCents: integer("tax_amount_cents"),
    feeAmountCents: integer("fee_amount_cents"),
    costCurrency: text("cost_currency"),
    unitCostAmountCents: integer("unit_cost_amount_cents"),
    totalCostAmountCents: integer("total_cost_amount_cents"),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_order_items_order_created").on(table.orderId, table.createdAt),
    index("idx_order_items_offer_item_created").on(table.offerItemId, table.createdAt),
    index("idx_order_items_product_created").on(table.productId, table.createdAt),
    index("idx_order_items_option_created").on(table.optionId, table.createdAt),
    index("idx_order_items_unit_created").on(table.unitId, table.createdAt),
    index("idx_order_items_slot_created").on(table.slotId, table.createdAt),
    index("idx_order_items_status_created").on(table.status, table.createdAt),
    check(
      "ck_order_items_cost_currency_amounts",
      sql`(${table.unitCostAmountCents} IS NULL AND ${table.totalCostAmountCents} IS NULL) OR ${table.costCurrency} IS NOT NULL`,
    ),
  ],
)

export const orderItemParticipants = pgTable(
  "order_item_participants",
  {
    id: typeId("order_item_participants"),
    orderItemId: typeIdRef("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    travelerId: typeIdRef("traveler_id")
      .notNull()
      .references(() => orderParticipants.id, { onDelete: "cascade" }),
    role: transactionItemParticipantRoleEnum("role").notNull().default("traveler"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_order_item_participants_item_created").on(table.orderItemId, table.createdAt),
    index("idx_order_item_participants_participant_created").on(table.travelerId, table.createdAt),
    uniqueIndex("uidx_order_item_participants").on(table.orderItemId, table.travelerId),
  ],
)

export const orderTerms = pgTable(
  "order_terms",
  {
    id: typeId("order_terms"),
    offerId: typeIdRef("offer_id").references(() => offers.id, { onDelete: "cascade" }),
    orderId: typeIdRef("order_id").references(() => orders.id, { onDelete: "cascade" }),
    termType: orderTermTypeEnum("term_type").notNull().default("terms_and_conditions"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    language: text("language"),
    required: boolean("required").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    acceptanceStatus: orderTermAcceptanceStatusEnum("acceptance_status")
      .notNull()
      .default("pending"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: text("accepted_by"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_order_terms_offer_sort").on(table.offerId, table.sortOrder, table.createdAt),
    index("idx_order_terms_order_sort").on(table.orderId, table.sortOrder, table.createdAt),
    index("idx_order_terms_type_sort").on(table.termType, table.sortOrder, table.createdAt),
    index("idx_order_terms_acceptance_sort").on(
      table.acceptanceStatus,
      table.sortOrder,
      table.createdAt,
    ),
  ],
)

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderParticipant = typeof orderParticipants.$inferSelect
export type NewOrderParticipant = typeof orderParticipants.$inferInsert
export type OrderTraveler = OrderParticipant
export type NewOrderTraveler = NewOrderParticipant
export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
export type OrderItemParticipant = typeof orderItemParticipants.$inferSelect
export type NewOrderItemParticipant = typeof orderItemParticipants.$inferInsert
export type OrderItemTraveler = OrderItemParticipant
export type NewOrderItemTraveler = NewOrderItemParticipant
export type OrderTerm = typeof orderTerms.$inferSelect
export type NewOrderTerm = typeof orderTerms.$inferInsert

import { bookingItems } from "@voyantjs/bookings/schema"
import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { properties } from "@voyantjs/facilities/schema"
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { stayBookingItems } from "./schema-bookings.js"
import { roomUnits } from "./schema-inventory.js"
import {
  stayCheckpointTypeEnum,
  stayFolioStatusEnum,
  stayOperationStatusEnum,
  stayServicePostKindEnum,
} from "./schema-shared.js"

export const stayOperations = pgTable(
  "stay_operations",
  {
    id: typeId("stay_operations"),
    stayBookingItemId: typeIdRef("stay_booking_item_id")
      .notNull()
      .references(() => stayBookingItems.id, { onDelete: "cascade" }),
    propertyId: typeIdRef("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomUnitId: typeIdRef("room_unit_id").references(() => roomUnits.id, { onDelete: "set null" }),
    operationStatus: stayOperationStatusEnum("operation_status").notNull().default("reserved"),
    expectedArrivalAt: timestamp("expected_arrival_at", { withTimezone: true }),
    expectedDepartureAt: timestamp("expected_departure_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
    noShowRecordedAt: timestamp("no_show_recorded_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_stay_operations_stay_booking_item").on(table.stayBookingItemId),
    index("idx_stay_operations_property_created").on(table.propertyId, table.createdAt),
    index("idx_stay_operations_room_unit_created").on(table.roomUnitId, table.createdAt),
    index("idx_stay_operations_status_created").on(table.operationStatus, table.createdAt),
  ],
)

export const stayCheckpoints = pgTable(
  "stay_checkpoints",
  {
    id: typeId("stay_checkpoints"),
    stayOperationId: typeIdRef("stay_operation_id")
      .notNull()
      .references(() => stayOperations.id, { onDelete: "cascade" }),
    checkpointType: stayCheckpointTypeEnum("checkpoint_type").notNull().default("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    roomUnitId: typeIdRef("room_unit_id").references(() => roomUnits.id, { onDelete: "set null" }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stay_checkpoints_operation_occurred_at").on(table.stayOperationId, table.occurredAt),
    index("idx_stay_checkpoints_type_occurred_at").on(table.checkpointType, table.occurredAt),
  ],
)

export const stayServicePosts = pgTable(
  "stay_service_posts",
  {
    id: typeId("stay_service_posts"),
    stayOperationId: typeIdRef("stay_operation_id")
      .notNull()
      .references(() => stayOperations.id, { onDelete: "cascade" }),
    bookingItemId: typeIdRef("booking_item_id").references(() => bookingItems.id, {
      onDelete: "set null",
    }),
    serviceDate: date("service_date").notNull(),
    kind: stayServicePostKindEnum("kind").notNull().default("other"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    currencyCode: text("currency_code").notNull(),
    sellAmountCents: integer("sell_amount_cents").notNull().default(0),
    costAmountCents: integer("cost_amount_cents"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stay_service_posts_operation_service_date").on(
      table.stayOperationId,
      table.serviceDate,
    ),
    index("idx_stay_service_posts_booking_item_service_date").on(
      table.bookingItemId,
      table.serviceDate,
    ),
    index("idx_stay_service_posts_kind_service_date").on(table.kind, table.serviceDate),
  ],
)

export const stayFolios = pgTable(
  "stay_folios",
  {
    id: typeId("stay_folios"),
    stayOperationId: typeIdRef("stay_operation_id")
      .notNull()
      .references(() => stayOperations.id, { onDelete: "cascade" }),
    currencyCode: text("currency_code").notNull(),
    status: stayFolioStatusEnum("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stay_folios_operation_opened_at").on(table.stayOperationId, table.openedAt),
    index("idx_stay_folios_status_opened_at").on(table.status, table.openedAt),
  ],
)

export const stayFolioLines = pgTable(
  "stay_folio_lines",
  {
    id: typeId("stay_folio_lines"),
    stayFolioId: typeIdRef("stay_folio_id")
      .notNull()
      .references(() => stayFolios.id, { onDelete: "cascade" }),
    servicePostId: typeIdRef("service_post_id").references(() => stayServicePosts.id, {
      onDelete: "set null",
    }),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    lineType: text("line_type").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    amountCents: integer("amount_cents").notNull().default(0),
    taxAmountCents: integer("tax_amount_cents"),
    feeAmountCents: integer("fee_amount_cents"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stay_folio_lines_folio_posted_at").on(table.stayFolioId, table.postedAt),
    index("idx_stay_folio_lines_service_post_posted_at").on(table.servicePostId, table.postedAt),
  ],
)

export type StayOperation = typeof stayOperations.$inferSelect
export type NewStayOperation = typeof stayOperations.$inferInsert
export type StayCheckpoint = typeof stayCheckpoints.$inferSelect
export type NewStayCheckpoint = typeof stayCheckpoints.$inferInsert
export type StayServicePost = typeof stayServicePosts.$inferSelect
export type NewStayServicePost = typeof stayServicePosts.$inferInsert
export type StayFolio = typeof stayFolios.$inferSelect
export type NewStayFolio = typeof stayFolios.$inferInsert
export type StayFolioLine = typeof stayFolioLines.$inferSelect
export type NewStayFolioLine = typeof stayFolioLines.$inferInsert

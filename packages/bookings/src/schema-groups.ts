import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { bookings } from "./schema-core.js"

export const bookingGroupKindEnum = pgEnum("booking_group_kind", [
  "shared_room",
  "cruise_party",
  "other",
])

export const bookingGroupMemberRoleEnum = pgEnum("booking_group_member_role", ["primary", "shared"])

export const bookingGroups = pgTable(
  "booking_groups",
  {
    id: typeId("booking_groups"),
    kind: bookingGroupKindEnum("kind").notNull().default("shared_room"),
    label: text("label").notNull(),
    primaryBookingId: typeIdRef("primary_booking_id"),
    productId: text("product_id"),
    optionUnitId: text("option_unit_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_groups_kind_created").on(table.kind, table.createdAt),
    index("idx_booking_groups_product_created").on(table.productId, table.createdAt),
    index("idx_booking_groups_option_unit_created").on(table.optionUnitId, table.createdAt),
  ],
)

export const bookingGroupMembers = pgTable(
  "booking_group_members",
  {
    id: typeId("booking_group_members"),
    groupId: typeIdRef("group_id")
      .notNull()
      .references(() => bookingGroups.id, { onDelete: "cascade" }),
    bookingId: typeIdRef("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    role: bookingGroupMemberRoleEnum("role").notNull().default("shared"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("booking_group_members_booking_unique").on(table.bookingId),
    index("idx_booking_group_members_group_created").on(table.groupId, table.createdAt),
  ],
)

export type BookingGroup = typeof bookingGroups.$inferSelect
export type NewBookingGroup = typeof bookingGroups.$inferInsert
export type BookingGroupMember = typeof bookingGroupMembers.$inferSelect
export type NewBookingGroupMember = typeof bookingGroupMembers.$inferInsert

import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { bookings } from "./schema-core.js"
import { bookingItems } from "./schema-items.js"
import { bookingStaffAssignmentRoleEnum } from "./schema-shared.js"

export const bookingStaffAssignments = pgTable(
  "booking_staff_assignments",
  {
    id: typeId("booking_staff_assignments"),
    bookingId: typeIdRef("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    bookingItemId: typeIdRef("booking_item_id").references(() => bookingItems.id, {
      onDelete: "set null",
    }),
    personId: text("person_id"),
    role: bookingStaffAssignmentRoleEnum("role").notNull().default("service_assignee"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    preferredLanguage: text("preferred_language"),
    isPrimary: boolean("is_primary").notNull().default(false),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_staff_assignments_booking").on(table.bookingId),
    index("idx_booking_staff_assignments_booking_role_created").on(
      table.bookingId,
      table.role,
      table.createdAt,
    ),
    index("idx_booking_staff_assignments_item").on(table.bookingItemId),
    index("idx_booking_staff_assignments_person").on(table.personId),
  ],
)

export type BookingStaffAssignment = typeof bookingStaffAssignments.$inferSelect
export type NewBookingStaffAssignment = typeof bookingStaffAssignments.$inferInsert

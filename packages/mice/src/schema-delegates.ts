import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { programs } from "./schema.js"
import { programSessions } from "./schema-sessions.js"

/**
 * Delegate registry — the attendee roster of a program with role + lifecycle
 * status, plus per-session enrollment. The gap the audit found: bookings model
 * travelers but have no attendee lifecycle (invited → … → checked_in/no_show),
 * delegate roles, or session enrollment.
 *
 * No new PII store (§9-Q7): identity/dietary/accessibility live on the linked
 * CRM person / booking traveler (KMS-encrypted there). A delegate references
 * `personId`/`bookingId` and carries only role/status/timing.
 */
export const delegateRoleEnum = pgEnum("mice_delegate_role", [
  "attendee",
  "speaker",
  "sponsor",
  "vip",
  "staff",
  "exhibitor",
  "organizer",
])

export const delegateStatusEnum = pgEnum("mice_delegate_status", [
  "invited",
  "registered",
  "confirmed",
  "checked_in",
  "no_show",
  "cancelled",
])

export const programDelegates = pgTable(
  "mice_program_delegates",
  {
    id: typeId("mice_program_delegates"),
    // Intra-package FK (delegates + programs both live in mice):
    programId: typeIdRef("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    // Cross-package → loose columns + defineLink at the deployment:
    personId: typeIdRef("person_id"), // → relationships.people (nullable: leads pre-booking)
    bookingId: typeIdRef("booking_id"), // → bookings (populated on confirmation)
    role: delegateRoleEnum("role").notNull().default("attendee"),
    status: delegateStatusEnum("status").notNull().default("invited"),
    arrivalAt: timestamp("arrival_at", { withTimezone: true }),
    departureAt: timestamp("departure_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mice_program_delegates_program").on(table.programId),
    index("idx_mice_program_delegates_program_status").on(table.programId, table.status),
    index("idx_mice_program_delegates_person").on(table.personId),
    index("idx_mice_program_delegates_booking").on(table.bookingId),
  ],
)

export const enrollmentStatusEnum = pgEnum("mice_enrollment_status", [
  "registered",
  "waitlisted",
  "attended",
  "cancelled",
])

export const delegateSessionEnrollments = pgTable(
  "mice_delegate_session_enrollments",
  {
    id: typeId("mice_delegate_session_enrollments"),
    delegateId: typeIdRef("delegate_id")
      .notNull()
      .references(() => programDelegates.id, { onDelete: "cascade" }),
    sessionId: typeIdRef("session_id")
      .notNull()
      .references(() => programSessions.id, { onDelete: "cascade" }),
    status: enrollmentStatusEnum("status").notNull().default("registered"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mice_enrollments_session").on(table.sessionId),
    // A delegate enrolls in a given session at most once.
    uniqueIndex("uidx_mice_enrollments_delegate_session").on(table.delegateId, table.sessionId),
  ],
)

export type ProgramDelegate = typeof programDelegates.$inferSelect
export type NewProgramDelegate = typeof programDelegates.$inferInsert
export type DelegateSessionEnrollment = typeof delegateSessionEnrollments.$inferSelect
export type NewDelegateSessionEnrollment = typeof delegateSessionEnrollments.$inferInsert

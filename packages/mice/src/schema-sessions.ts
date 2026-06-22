import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { programs } from "./schema.js"

/**
 * Program agenda — timed, capacity-bound sessions (keynote → breakouts → gala)
 * and their inclusions (F&B, AV, materials, signage). This is the model the
 * gap analysis found missing: product itineraries carry service/cost/quantity
 * but no start/end/capacity. See RFC voyant#1489 (Phase 2).
 */
export const sessionTypeEnum = pgEnum("mice_session_type", [
  "keynote",
  "breakout",
  "meal",
  "networking",
  "gala",
  "excursion",
  "free",
])

export const sessionInclusionKindEnum = pgEnum("mice_session_inclusion_kind", [
  "fnb",
  "av",
  "materials",
  "signage",
  "other",
])

export const programSessions = pgTable(
  "mice_program_sessions",
  {
    id: typeId("mice_program_sessions"),
    // Intra-package FK (sessions + programs both live in mice):
    programId: typeIdRef("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    // Cross-package → loose column + defineLink at the deployment:
    functionSpaceId: typeIdRef("function_space_id"), // → operations.functionSpaces
    title: text("title").notNull(),
    sessionType: sessionTypeEnum("session_type").notNull().default("breakout"),
    dayDate: date("day_date"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    track: text("track"),
    capacity: integer("capacity"),
    requiresRegistration: boolean("requires_registration").notNull().default(false),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mice_program_sessions_program").on(table.programId),
    index("idx_mice_program_sessions_program_day").on(table.programId, table.dayDate),
    index("idx_mice_program_sessions_function_space").on(table.functionSpaceId),
    index("idx_mice_program_sessions_starts_at").on(table.startsAt),
  ],
)

export const sessionInclusions = pgTable(
  "mice_session_inclusions",
  {
    id: typeId("mice_session_inclusions"),
    sessionId: typeIdRef("session_id")
      .notNull()
      .references(() => programSessions.id, { onDelete: "cascade" }),
    kind: sessionInclusionKindEnum("kind").notNull(),
    description: text("description"),
    quantity: integer("quantity").notNull().default(1),
    costAmountCents: integer("cost_amount_cents"),
    currency: text("currency"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_mice_session_inclusions_session").on(table.sessionId)],
)

export type ProgramSession = typeof programSessions.$inferSelect
export type NewProgramSession = typeof programSessions.$inferInsert
export type SessionInclusion = typeof sessionInclusions.$inferSelect
export type NewSessionInclusion = typeof sessionInclusions.$inferInsert

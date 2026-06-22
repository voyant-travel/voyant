import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { date, index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * The MICE group-program spine (Phase 1: the minimal umbrella). A Program is a
 * group engagement a buyer org runs over a date range; room blocks (owned by
 * accommodations) link to it via `programId`. Sessions, delegates, rooming, and
 * RFP/bid land in later phases. See RFC voyant#1489.
 *
 * Cross-package associations (`organizationId`, `primaryContactPersonId`) are
 * loose `typeIdRef` columns linked via `defineLink` at the deployment.
 */
export const programTypeEnum = pgEnum("mice_program_type", [
  "meeting",
  "incentive",
  "conference",
  "exhibition",
  "other",
])

export const programStatusEnum = pgEnum("mice_program_status", [
  "lead",
  "planning",
  "contracted",
  "operating",
  "completed",
  "cancelled",
])

export const programs = pgTable(
  "mice_programs",
  {
    id: typeId("mice_programs"),
    organizationId: typeIdRef("organization_id"), // → relationships.organizations (buyer)
    primaryContactPersonId: typeIdRef("primary_contact_person_id"), // → relationships.people
    accountManagerId: text("account_manager_id"), // owning staff user (auth)
    name: text("name").notNull(),
    code: text("code"),
    type: programTypeEnum("type").notNull().default("conference"),
    status: programStatusEnum("status").notNull().default("lead"),
    destination: text("destination"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    estimatedPax: integer("estimated_pax"),
    confirmedPax: integer("confirmed_pax"),
    currency: text("currency"),
    budgetAmountCents: integer("budget_amount_cents"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mice_programs_org").on(table.organizationId),
    index("idx_mice_programs_status").on(table.status),
    index("idx_mice_programs_dates").on(table.startDate, table.endDate),
  ],
)

export type Program = typeof programs.$inferSelect
export type NewProgram = typeof programs.$inferInsert

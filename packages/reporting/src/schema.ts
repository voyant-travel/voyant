import { typeId } from "@voyant-travel/db/lib/typeid-column"
import type { ReportDraft } from "@voyant-travel/reporting-contracts"
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const reportDefinitions = pgTable(
  "report_definitions",
  {
    id: typeId("report_definitions"),
    name: text("name").notNull(),
    description: text("description"),
    sourceTemplateId: text("source_template_id"),
    sourceTemplateVersion: integer("source_template_version"),
    draft: jsonb("draft").$type<ReportDraft>().notNull(),
    revision: integer("revision").notNull().default(1),
    createdByUserId: text("created_by_user_id"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_report_definitions_updated").on(table.updatedAt)],
)

export type ReportDefinitionRow = typeof reportDefinitions.$inferSelect

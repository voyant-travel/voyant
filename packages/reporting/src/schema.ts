import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import type {
  ReportDraft,
  ReportParameters,
  ReportResult,
} from "@voyant-travel/reporting-contracts"
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export interface ReportRunWidgetOutput {
  widgetInstanceId: string
  status: "succeeded" | "missing" | "failed"
  result?: ReportResult
  reason?: string
}

export interface ReportRunOutput {
  widgets: ReportRunWidgetOutput[]
}

export const reportRunStatusEnum = pgEnum("report_run_status", ["running", "succeeded", "failed"])

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

export const reportVersions = pgTable(
  "report_versions",
  {
    id: typeId("report_versions"),
    reportDefinitionId: typeIdRef("report_definition_id")
      .notNull()
      .references(() => reportDefinitions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    definitionRevision: integer("definition_revision").notNull(),
    snapshot: jsonb("snapshot").$type<ReportDraft>().notNull(),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_report_versions_definition_version").on(
      table.reportDefinitionId,
      table.version,
    ),
    index("idx_report_versions_definition_created").on(table.reportDefinitionId, table.createdAt),
  ],
)

export const reportRuns = pgTable(
  "report_runs",
  {
    id: typeId("report_runs"),
    reportVersionId: typeIdRef("report_version_id")
      .notNull()
      .references(() => reportVersions.id, { onDelete: "restrict" }),
    status: reportRunStatusEnum("status").notNull().default("running"),
    parameters: jsonb("parameters").$type<ReportParameters>().notNull(),
    output: jsonb("output").$type<ReportRunOutput | null>(),
    error: text("error"),
    triggeredByUserId: text("triggered_by_user_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_report_runs_version_created").on(table.reportVersionId, table.createdAt),
    index("idx_report_runs_status_started").on(table.status, table.startedAt),
  ],
)

export type ReportDefinitionRow = typeof reportDefinitions.$inferSelect
export type ReportVersionRow = typeof reportVersions.$inferSelect
export type ReportRunRow = typeof reportRuns.$inferSelect

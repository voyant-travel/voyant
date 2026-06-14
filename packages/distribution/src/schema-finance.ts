import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { date, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import {
  channelBookingLinks,
  channelCommissionRules,
  channelContracts,
  channels,
} from "./schema-core.js"
import {
  channelReconciliationIssueTypeEnum,
  channelReconciliationResolutionStatusEnum,
  channelReconciliationRunStatusEnum,
  channelReconciliationSeverityEnum,
  channelRemittanceExceptionStatusEnum,
  channelSettlementApprovalStatusEnum,
  channelSettlementItemStatusEnum,
  channelSettlementRunStatusEnum,
} from "./schema-shared.js"

export const channelSettlementRuns = pgTable(
  "channel_settlement_runs",
  {
    id: typeId("channel_settlement_runs"),
    channelId: typeIdRef("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    contractId: typeIdRef("contract_id").references(() => channelContracts.id, {
      onDelete: "set null",
    }),
    status: channelSettlementRunStatusEnum("status").notNull().default("draft"),
    currencyCode: text("currency_code"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    statementReference: text("statement_reference"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_settlement_runs_updated").on(table.updatedAt),
    index("idx_channel_settlement_runs_channel_updated").on(table.channelId, table.updatedAt),
    index("idx_channel_settlement_runs_contract_updated").on(table.contractId, table.updatedAt),
    index("idx_channel_settlement_runs_status_updated").on(table.status, table.updatedAt),
    index("idx_channel_settlement_runs_period").on(table.periodStart, table.periodEnd),
  ],
)

export const channelSettlementItems = pgTable(
  "channel_settlement_items",
  {
    id: typeId("channel_settlement_items"),
    settlementRunId: typeIdRef("settlement_run_id")
      .notNull()
      .references(() => channelSettlementRuns.id, { onDelete: "cascade" }),
    bookingLinkId: typeIdRef("booking_link_id").references(() => channelBookingLinks.id, {
      onDelete: "set null",
    }),
    bookingId: text("booking_id"),
    commissionRuleId: typeIdRef("commission_rule_id").references(() => channelCommissionRules.id, {
      onDelete: "set null",
    }),
    status: channelSettlementItemStatusEnum("status").notNull().default("pending"),
    grossAmountCents: integer("gross_amount_cents").notNull().default(0),
    commissionAmountCents: integer("commission_amount_cents").notNull().default(0),
    netRemittanceAmountCents: integer("net_remittance_amount_cents").notNull().default(0),
    currencyCode: text("currency_code"),
    remittanceDueAt: timestamp("remittance_due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_settlement_items_updated").on(table.updatedAt),
    index("idx_channel_settlement_items_run_updated").on(table.settlementRunId, table.updatedAt),
    index("idx_channel_settlement_items_booking_link_updated").on(
      table.bookingLinkId,
      table.updatedAt,
    ),
    index("idx_channel_settlement_items_booking_updated").on(table.bookingId, table.updatedAt),
    index("idx_channel_settlement_items_status_updated").on(table.status, table.updatedAt),
  ],
)

export const channelReconciliationRuns = pgTable(
  "channel_reconciliation_runs",
  {
    id: typeId("channel_reconciliation_runs"),
    channelId: typeIdRef("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    contractId: typeIdRef("contract_id").references(() => channelContracts.id, {
      onDelete: "set null",
    }),
    status: channelReconciliationRunStatusEnum("status").notNull().default("draft"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    externalReportReference: text("external_report_reference"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_reconciliation_runs_updated").on(table.updatedAt),
    index("idx_channel_reconciliation_runs_channel_updated").on(table.channelId, table.updatedAt),
    index("idx_channel_reconciliation_runs_contract_updated").on(table.contractId, table.updatedAt),
    index("idx_channel_reconciliation_runs_status_updated").on(table.status, table.updatedAt),
  ],
)

export const channelReconciliationItems = pgTable(
  "channel_reconciliation_items",
  {
    id: typeId("channel_reconciliation_items"),
    reconciliationRunId: typeIdRef("reconciliation_run_id")
      .notNull()
      .references(() => channelReconciliationRuns.id, { onDelete: "cascade" }),
    bookingLinkId: typeIdRef("booking_link_id").references(() => channelBookingLinks.id, {
      onDelete: "set null",
    }),
    bookingId: text("booking_id"),
    externalBookingId: text("external_booking_id"),
    issueType: channelReconciliationIssueTypeEnum("issue_type").notNull().default("other"),
    severity: channelReconciliationSeverityEnum("severity").notNull().default("warning"),
    resolutionStatus: channelReconciliationResolutionStatusEnum("resolution_status")
      .notNull()
      .default("open"),
    notes: text("notes"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_reconciliation_items_updated").on(table.updatedAt),
    index("idx_channel_reconciliation_items_run_updated").on(
      table.reconciliationRunId,
      table.updatedAt,
    ),
    index("idx_channel_reconciliation_items_booking_link_updated").on(
      table.bookingLinkId,
      table.updatedAt,
    ),
    index("idx_channel_reconciliation_items_booking_updated").on(table.bookingId, table.updatedAt),
    index("idx_channel_reconciliation_items_issue_updated").on(table.issueType, table.updatedAt),
    index("idx_channel_reconciliation_items_resolution_updated").on(
      table.resolutionStatus,
      table.updatedAt,
    ),
  ],
)

export const channelRemittanceExceptions = pgTable(
  "channel_remittance_exceptions",
  {
    id: typeId("channel_remittance_exceptions"),
    channelId: typeIdRef("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    settlementItemId: typeIdRef("settlement_item_id").references(() => channelSettlementItems.id, {
      onDelete: "set null",
    }),
    reconciliationItemId: typeIdRef("reconciliation_item_id").references(
      () => channelReconciliationItems.id,
      { onDelete: "set null" },
    ),
    exceptionType: text("exception_type").notNull(),
    severity: channelReconciliationSeverityEnum("severity").notNull().default("warning"),
    status: channelRemittanceExceptionStatusEnum("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_remittance_exceptions_updated").on(table.updatedAt),
    index("idx_channel_remittance_exceptions_channel_updated").on(table.channelId, table.updatedAt),
    index("idx_channel_remittance_exceptions_settlement_item_updated").on(
      table.settlementItemId,
      table.updatedAt,
    ),
    index("idx_channel_remittance_exceptions_reconciliation_item_updated").on(
      table.reconciliationItemId,
      table.updatedAt,
    ),
    index("idx_channel_remittance_exceptions_status_updated").on(table.status, table.updatedAt),
  ],
)

export const channelSettlementApprovals = pgTable(
  "channel_settlement_approvals",
  {
    id: typeId("channel_settlement_approvals"),
    settlementRunId: typeIdRef("settlement_run_id")
      .notNull()
      .references(() => channelSettlementRuns.id, { onDelete: "cascade" }),
    approverUserId: text("approver_user_id"),
    status: channelSettlementApprovalStatusEnum("status").notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_settlement_approvals_updated").on(table.updatedAt),
    index("idx_channel_settlement_approvals_run_updated").on(
      table.settlementRunId,
      table.updatedAt,
    ),
    index("idx_channel_settlement_approvals_status_updated").on(table.status, table.updatedAt),
  ],
)

export type ChannelSettlementRun = typeof channelSettlementRuns.$inferSelect
export type NewChannelSettlementRun = typeof channelSettlementRuns.$inferInsert
export type ChannelSettlementItem = typeof channelSettlementItems.$inferSelect
export type NewChannelSettlementItem = typeof channelSettlementItems.$inferInsert
export type ChannelReconciliationRun = typeof channelReconciliationRuns.$inferSelect
export type NewChannelReconciliationRun = typeof channelReconciliationRuns.$inferInsert
export type ChannelReconciliationItem = typeof channelReconciliationItems.$inferSelect
export type NewChannelReconciliationItem = typeof channelReconciliationItems.$inferInsert
export type ChannelRemittanceException = typeof channelRemittanceExceptions.$inferSelect
export type NewChannelRemittanceException = typeof channelRemittanceExceptions.$inferInsert
export type ChannelSettlementApproval = typeof channelSettlementApprovals.$inferSelect
export type NewChannelSettlementApproval = typeof channelSettlementApprovals.$inferInsert

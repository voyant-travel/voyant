import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import {
  invoiceNumberResetStrategyEnum,
  invoiceNumberSeriesScopeEnum,
  invoiceRenditionFormatEnum,
  invoiceRenditionStatusEnum,
  invoiceTemplateBodyFormatEnum,
} from "./enums.js"
import { invoices } from "./receivables.js"

// ---------- finance_notes ----------

export const financeNotes = pgTable(
  "finance_notes",
  {
    id: typeId("finance_notes"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_finance_notes_invoice").on(table.invoiceId),
    index("idx_finance_notes_invoice_created").on(table.invoiceId, table.createdAt),
  ],
)

export type FinanceNote = typeof financeNotes.$inferSelect
export type NewFinanceNote = typeof financeNotes.$inferInsert

// ---------- invoice_number_series ----------

export const invoiceNumberSeries = pgTable(
  "invoice_number_series",
  {
    id: typeId("invoice_number_series"),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull().default(""),
    separator: text("separator").notNull().default(""),
    padLength: integer("pad_length").notNull().default(4),
    currentSequence: integer("current_sequence").notNull().default(0),
    resetStrategy: invoiceNumberResetStrategyEnum("reset_strategy").notNull().default("never"),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    scope: invoiceNumberSeriesScopeEnum("scope").notNull().default("invoice"),
    isDefault: boolean("is_default").notNull().default(false),
    externalProvider: text("external_provider"),
    externalConfigKey: text("external_config_key"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_number_series_scope").on(table.scope),
    index("idx_invoice_number_series_active").on(table.active),
    index("idx_invoice_number_series_scope_default").on(table.scope, table.isDefault),
    index("idx_invoice_number_series_external_provider").on(table.externalProvider),
    index("idx_invoice_number_series_scope_updated").on(table.scope, table.updatedAt),
    index("idx_invoice_number_series_active_updated").on(table.active, table.updatedAt),
    uniqueIndex("uidx_invoice_number_series_default_scope_active")
      .on(table.scope)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.active} = true AND ${table.isDefault} = true`),
  ],
)

export type InvoiceNumberSeries = typeof invoiceNumberSeries.$inferSelect
export type NewInvoiceNumberSeries = typeof invoiceNumberSeries.$inferInsert

// ---------- invoice_templates ----------

export const invoiceTemplates = pgTable(
  "invoice_templates",
  {
    id: typeId("invoice_templates"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    language: text("language").notNull().default("en"),
    jurisdiction: text("jurisdiction"),
    bodyFormat: invoiceTemplateBodyFormatEnum("body_format").notNull().default("html"),
    body: text("body").notNull(),
    cssStyles: text("css_styles"),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_templates_language").on(table.language),
    index("idx_invoice_templates_language_updated").on(table.language, table.updatedAt),
    index("idx_invoice_templates_jurisdiction").on(table.jurisdiction),
    index("idx_invoice_templates_jurisdiction_updated").on(table.jurisdiction, table.updatedAt),
    index("idx_invoice_templates_default").on(table.isDefault),
    index("idx_invoice_templates_default_updated").on(table.isDefault, table.updatedAt),
    index("idx_invoice_templates_active").on(table.active),
    index("idx_invoice_templates_active_updated").on(table.active, table.updatedAt),
  ],
)

export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect
export type NewInvoiceTemplate = typeof invoiceTemplates.$inferInsert

// ---------- invoice_renditions ----------

export const invoiceRenditions = pgTable(
  "invoice_renditions",
  {
    id: typeId("invoice_renditions"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    templateId: typeIdRef("template_id").references(() => invoiceTemplates.id, {
      onDelete: "set null",
    }),
    format: invoiceRenditionFormatEnum("format").notNull().default("pdf"),
    status: invoiceRenditionStatusEnum("status").notNull().default("pending"),
    storageKey: text("storage_key"),
    fileSize: integer("file_size"),
    checksum: text("checksum"),
    language: text("language"),
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    appProvider: text("app_provider"),
    appIdempotencyDigest: text("app_idempotency_digest"),
    appFileName: text("app_file_name"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_renditions_invoice").on(table.invoiceId),
    index("idx_invoice_renditions_invoice_created").on(table.invoiceId, table.createdAt),
    index("idx_invoice_renditions_template").on(table.templateId),
    index("idx_invoice_renditions_status").on(table.status),
    index("idx_invoice_renditions_format").on(table.format),
    uniqueIndex("uq_invoice_renditions_app_idempotency").on(
      table.invoiceId,
      table.appProvider,
      table.appIdempotencyDigest,
    ),
  ],
)

export type InvoiceRendition = typeof invoiceRenditions.$inferSelect
export type NewInvoiceRendition = typeof invoiceRenditions.$inferInsert

// ---------- invoice_attachments ----------

export const invoiceAttachments = pgTable(
  "invoice_attachments",
  {
    id: typeId("invoice_attachments"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("supporting_document"),
    name: text("name").notNull(),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    storageKey: text("storage_key"),
    checksum: text("checksum"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_attachments_invoice").on(table.invoiceId),
    index("idx_invoice_attachments_invoice_created").on(table.invoiceId, table.createdAt),
  ],
)

export type InvoiceAttachment = typeof invoiceAttachments.$inferSelect
export type NewInvoiceAttachment = typeof invoiceAttachments.$inferInsert

// ---------- invoice_external_refs ----------

export const invoiceExternalRefs = pgTable(
  "invoice_external_refs",
  {
    id: typeId("invoice_external_refs"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id"),
    externalNumber: text("external_number"),
    externalUrl: text("external_url"),
    status: text("status"),
    metadata: jsonb("metadata"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    syncError: text("sync_error"),
    syncState: text("sync_state"),
    syncOperationId: text("sync_operation_id"),
    syncOccurredAt: timestamp("sync_occurred_at", { withTimezone: true }),
    syncErrorCode: text("sync_error_code"),
    syncErrorMessage: text("sync_error_message"),
    syncMetadata: jsonb("sync_metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_external_refs_invoice").on(table.invoiceId),
    index("idx_invoice_external_refs_invoice_created").on(table.invoiceId, table.createdAt),
    index("idx_invoice_external_refs_provider").on(table.provider),
    uniqueIndex("uq_invoice_external_refs_invoice_provider").on(table.invoiceId, table.provider),
  ],
)

export type InvoiceExternalRef = typeof invoiceExternalRefs.$inferSelect
export type NewInvoiceExternalRef = typeof invoiceExternalRefs.$inferInsert

// ---------- invoice_external_sync_observations ----------

export const invoiceExternalSyncObservations = pgTable(
  "invoice_external_sync_observations",
  {
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    operationId: text("operation_id").notNull(),
    status: text("status").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "pk_invoice_external_sync_observations",
      columns: [table.invoiceId, table.provider, table.operationId],
    }),
    index("idx_invoice_external_sync_observations_current").on(
      table.invoiceId,
      table.provider,
      table.occurredAt,
    ),
  ],
)

export type InvoiceExternalSyncObservation = typeof invoiceExternalSyncObservations.$inferSelect

// ---------- invoice_external_lifecycle_operations ----------

export const invoiceExternalLifecycleOperations = pgTable(
  "invoice_external_lifecycle_operations",
  {
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    operationId: text("operation_id").notNull(),
    state: text("state").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    successorInvoiceId: typeIdRef("successor_invoice_id").references(() => invoices.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "pk_invoice_external_lifecycle_operations",
      columns: [table.invoiceId, table.provider, table.operationId],
    }),
    index("idx_invoice_external_lifecycle_current").on(
      table.invoiceId,
      table.provider,
      table.occurredAt,
    ),
    check("ck_invoice_external_lifecycle_state", sql`${table.state} IN ('converted', 'voided')`),
    check(
      "ck_invoice_external_lifecycle_lineage",
      sql`(${table.state} = 'converted' AND ${table.successorInvoiceId} IS NOT NULL) OR (${table.state} = 'voided' AND ${table.successorInvoiceId} IS NULL)`,
    ),
  ],
)

export type InvoiceExternalLifecycleOperation =
  typeof invoiceExternalLifecycleOperations.$inferSelect

// ---------- invoice_external_settlement_observations ----------

export const invoiceExternalSettlementObservations = pgTable(
  "invoice_external_settlement_observations",
  {
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    operationId: text("operation_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    currency: text("currency").notNull(),
    totalCents: integer("total_cents").notNull(),
    paidCents: integer("paid_cents").notNull(),
    balanceDueCents: integer("balance_due_cents").notNull(),
    paymentIdentifiers: jsonb("payment_identifiers").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "pk_invoice_external_settlement_observations",
      columns: [table.invoiceId, table.provider, table.operationId],
    }),
    index("idx_invoice_external_settlement_current").on(
      table.invoiceId,
      table.provider,
      table.occurredAt,
    ),
    check("ck_invoice_external_settlement_status", sql`${table.status} IN ('partial', 'paid')`),
    check(
      "ck_invoice_external_settlement_totals",
      sql`${table.totalCents} >= 0 AND ${table.paidCents} > 0 AND ${table.balanceDueCents} >= 0 AND ${table.paidCents} + ${table.balanceDueCents} = ${table.totalCents}`,
    ),
    check(
      "ck_invoice_external_settlement_state_totals",
      sql`(${table.status} = 'partial' AND ${table.balanceDueCents} > 0) OR (${table.status} = 'paid' AND ${table.balanceDueCents} = 0)`,
    ),
  ],
)

export type InvoiceExternalSettlementObservation =
  typeof invoiceExternalSettlementObservations.$inferSelect

// ---------- invoice_external_payment_identifiers ----------

export const invoiceExternalPaymentIdentifiers = pgTable(
  "invoice_external_payment_identifiers",
  {
    provider: text("provider").notNull(),
    paymentIdentifier: text("payment_identifier").notNull(),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    firstOperationId: text("first_operation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "pk_invoice_external_payment_identifiers",
      columns: [table.provider, table.paymentIdentifier],
    }),
    index("idx_invoice_external_payment_identifiers_invoice").on(table.invoiceId, table.provider),
  ],
)

export type InvoiceExternalPaymentIdentifier = typeof invoiceExternalPaymentIdentifiers.$inferSelect

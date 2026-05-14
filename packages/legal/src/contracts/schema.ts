import { organizations, people } from "@voyantjs/crm/schema"
import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { suppliers } from "@voyantjs/suppliers/schema"
import { relations, sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

// ---------- enums ----------

export const contractScopeEnum = pgEnum("contract_scope", [
  "customer",
  "supplier",
  "partner",
  "channel",
  "other",
])

export const contractStatusValues = [
  "draft",
  "issued",
  "sent",
  "signed",
  "executed",
  "expired",
  "void",
] as const

export const contractStatusEnum = pgEnum("contract_status", contractStatusValues)

export type ContractStatus = (typeof contractStatusValues)[number]

export interface ContractStageHistoryEntry {
  stage: ContractStatus
  previousStage: ContractStatus | null
  transition: "created" | "issued" | "sent" | "signed" | "executed" | "voided"
  enteredAt: string
  actorId?: string | null
}

export const contractSignatureMethodEnum = pgEnum("contract_signature_method", [
  "manual",
  "electronic",
  "docusign",
  "other",
])

export const contractNumberResetStrategyEnum = pgEnum("contract_number_reset_strategy", [
  "never",
  "annual",
  "monthly",
])

export const contractBodyFormatEnum = pgEnum("contract_body_format", [
  "markdown",
  "html",
  "lexical_json",
])

// ---------- contract_templates ----------

export const contractTemplates = pgTable(
  "contract_templates",
  {
    id: typeId("contract_templates"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    scope: contractScopeEnum("scope").notNull(),
    language: text("language").notNull().default("en"),
    description: text("description"),
    body: text("body").notNull(),
    variableSchema: jsonb("variable_schema"),
    currentVersionId: typeIdRef("current_version_id"),
    channelId: typeIdRef("channel_id"),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contract_templates_scope").on(table.scope),
    index("idx_contract_templates_language").on(table.language),
    index("idx_contract_templates_channel").on(table.channelId),
    index("idx_contract_templates_active").on(table.active),
    index("idx_contract_templates_default_selector").on(
      table.scope,
      table.channelId,
      table.language,
      table.isDefault,
      table.active,
    ),
    index("idx_contract_templates_scope_updated").on(table.scope, table.updatedAt),
    index("idx_contract_templates_language_updated").on(table.language, table.updatedAt),
    index("idx_contract_templates_active_updated").on(table.active, table.updatedAt),
    index("idx_contract_templates_scope_active_updated").on(
      table.scope,
      table.active,
      table.updatedAt,
    ),
    uniqueIndex("uq_contract_templates_slug").on(table.slug),
    uniqueIndex("uidx_contract_templates_default_global")
      .on(table.scope, table.language)
      .where(sql`${table.isDefault} = true AND ${table.channelId} IS NULL`),
    uniqueIndex("uidx_contract_templates_default_channel")
      .on(table.scope, table.channelId, table.language)
      .where(sql`${table.isDefault} = true AND ${table.channelId} IS NOT NULL`),
  ],
)

export type ContractTemplate = typeof contractTemplates.$inferSelect
export type NewContractTemplate = typeof contractTemplates.$inferInsert

// ---------- contract_template_versions ----------

export const contractTemplateVersions = pgTable(
  "contract_template_versions",
  {
    id: typeId("contract_template_versions"),
    templateId: typeIdRef("template_id")
      .notNull()
      .references(() => contractTemplates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    body: text("body").notNull(),
    variableSchema: jsonb("variable_schema"),
    changelog: text("changelog"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contract_template_versions_template").on(table.templateId),
    uniqueIndex("uq_contract_template_versions_template_version").on(
      table.templateId,
      table.version,
    ),
  ],
)

export type ContractTemplateVersion = typeof contractTemplateVersions.$inferSelect
export type NewContractTemplateVersion = typeof contractTemplateVersions.$inferInsert

// ---------- contract_number_series ----------

export const contractNumberSeries = pgTable(
  "contract_number_series",
  {
    id: typeId("contract_number_series"),
    name: text("name").notNull(),
    prefix: text("prefix").notNull().default(""),
    separator: text("separator").notNull().default(""),
    padLength: integer("pad_length").notNull().default(4),
    currentSequence: integer("current_sequence").notNull().default(0),
    resetStrategy: contractNumberResetStrategyEnum("reset_strategy").notNull().default("never"),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    scope: contractScopeEnum("scope").notNull().default("customer"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contract_number_series_scope").on(table.scope),
    index("idx_contract_number_series_active").on(table.active),
    index("idx_contract_number_series_scope_updated").on(table.scope, table.updatedAt),
    index("idx_contract_number_series_active_updated").on(table.active, table.updatedAt),
    index("idx_contract_number_series_updated").on(table.updatedAt),
    uniqueIndex("uidx_contract_number_series_prefix_scope_active")
      .on(table.prefix, table.scope)
      .where(sql`${table.active} = true`),
  ],
)

export type ContractNumberSeries = typeof contractNumberSeries.$inferSelect
export type NewContractNumberSeries = typeof contractNumberSeries.$inferInsert

// ---------- contracts ----------

export const contracts = pgTable(
  "contracts",
  {
    id: typeId("contracts"),
    contractNumber: text("contract_number").unique(),
    scope: contractScopeEnum("scope").notNull(),
    status: contractStatusEnum("status").notNull().default("draft"),
    stageHistory: jsonb("stage_history")
      .$type<ContractStageHistoryEntry[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    title: text("title").notNull(),

    templateVersionId: typeIdRef("template_version_id").references(
      () => contractTemplateVersions.id,
      { onDelete: "set null" },
    ),
    seriesId: typeIdRef("series_id").references(() => contractNumberSeries.id, {
      onDelete: "set null",
    }),

    personId: typeIdRef("person_id").references(() => people.id, { onDelete: "set null" }),
    organizationId: typeIdRef("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    supplierId: typeIdRef("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    channelId: typeIdRef("channel_id"),

    bookingId: typeIdRef("booking_id"),
    orderId: typeIdRef("order_id"),

    issuedAt: timestamp("issued_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),

    language: text("language").notNull().default("en"),
    renderedBodyFormat: contractBodyFormatEnum("rendered_body_format").notNull().default("html"),
    renderedBody: text("rendered_body"),
    variables: jsonb("variables"),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contracts_scope").on(table.scope),
    index("idx_contracts_status").on(table.status),
    index("idx_contracts_template_version").on(table.templateVersionId),
    index("idx_contracts_series").on(table.seriesId),
    index("idx_contracts_person").on(table.personId),
    index("idx_contracts_organization").on(table.organizationId),
    index("idx_contracts_supplier").on(table.supplierId),
    index("idx_contracts_booking").on(table.bookingId),
    index("idx_contracts_order").on(table.orderId),
    index("idx_contracts_scope_created").on(table.scope, table.createdAt),
    index("idx_contracts_status_created").on(table.status, table.createdAt),
    index("idx_contracts_person_created").on(table.personId, table.createdAt),
    index("idx_contracts_organization_created").on(table.organizationId, table.createdAt),
    index("idx_contracts_supplier_created").on(table.supplierId, table.createdAt),
    index("idx_contracts_booking_created").on(table.bookingId, table.createdAt),
    index("idx_contracts_order_created").on(table.orderId, table.createdAt),
    index("idx_contracts_contract_number").on(table.contractNumber),
  ],
)

export type Contract = typeof contracts.$inferSelect
export type NewContract = typeof contracts.$inferInsert

// ---------- contract_signatures ----------

export const contractSignatures = pgTable(
  "contract_signatures",
  {
    id: typeId("contract_signatures"),
    contractId: typeIdRef("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email"),
    signerRole: text("signer_role"),
    personId: typeIdRef("person_id").references(() => people.id, { onDelete: "set null" }),
    method: contractSignatureMethodEnum("method").notNull().default("manual"),
    provider: text("provider"),
    externalReference: text("external_reference"),
    signatureData: text("signature_data"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contract_signatures_contract").on(table.contractId),
    index("idx_contract_signatures_contract_signed").on(table.contractId, table.signedAt),
    index("idx_contract_signatures_person").on(table.personId),
    index("idx_contract_signatures_method").on(table.method),
  ],
)

export type ContractSignature = typeof contractSignatures.$inferSelect
export type NewContractSignature = typeof contractSignatures.$inferInsert

// ---------- contract_attachments ----------

export const contractAttachments = pgTable(
  "contract_attachments",
  {
    id: typeId("contract_attachments"),
    contractId: typeIdRef("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("appendix"),
    name: text("name").notNull(),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    storageKey: text("storage_key"),
    checksum: text("checksum"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contract_attachments_contract").on(table.contractId),
    index("idx_contract_attachments_contract_created").on(table.contractId, table.createdAt),
  ],
)

export type ContractAttachment = typeof contractAttachments.$inferSelect
export type NewContractAttachment = typeof contractAttachments.$inferInsert

// ---------- relations ----------

export const contractTemplatesRelations = relations(contractTemplates, ({ many }) => ({
  versions: many(contractTemplateVersions),
}))

export const contractTemplateVersionsRelations = relations(
  contractTemplateVersions,
  ({ one, many }) => ({
    template: one(contractTemplates, {
      fields: [contractTemplateVersions.templateId],
      references: [contractTemplates.id],
    }),
    contracts: many(contracts),
  }),
)

export const contractNumberSeriesRelations = relations(contractNumberSeries, ({ many }) => ({
  contracts: many(contracts),
}))

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  templateVersion: one(contractTemplateVersions, {
    fields: [contracts.templateVersionId],
    references: [contractTemplateVersions.id],
  }),
  series: one(contractNumberSeries, {
    fields: [contracts.seriesId],
    references: [contractNumberSeries.id],
  }),
  person: one(people, { fields: [contracts.personId], references: [people.id] }),
  organization: one(organizations, {
    fields: [contracts.organizationId],
    references: [organizations.id],
  }),
  supplier: one(suppliers, { fields: [contracts.supplierId], references: [suppliers.id] }),
  signatures: many(contractSignatures),
  attachments: many(contractAttachments),
}))

export const contractSignaturesRelations = relations(contractSignatures, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractSignatures.contractId],
    references: [contracts.id],
  }),
  person: one(people, { fields: [contractSignatures.personId], references: [people.id] }),
}))

export const contractAttachmentsRelations = relations(contractAttachments, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractAttachments.contractId],
    references: [contracts.id],
  }),
}))

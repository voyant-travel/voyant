import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { organizations, people } from "./schema-accounts.js"
import {
  entityTypeEnum,
  opportunityStatusEnum,
  participantRoleEnum,
  quoteStatusEnum,
} from "./schema-shared.js"

export const pipelines = pgTable(
  "pipelines",
  {
    id: typeId("pipelines"),
    entityType: entityTypeEnum("entity_type").notNull().default("opportunity"),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pipelines_entity").on(table.entityType),
    index("idx_pipelines_sort").on(table.sortOrder, table.createdAt),
    index("idx_pipelines_entity_sort").on(table.entityType, table.sortOrder, table.createdAt),
    uniqueIndex("uidx_pipelines_entity_name").on(table.entityType, table.name),
  ],
)

export const stages = pgTable(
  "stages",
  {
    id: typeId("stages"),
    pipelineId: typeIdRef("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    probability: integer("probability"),
    isClosed: boolean("is_closed").notNull().default(false),
    isWon: boolean("is_won").notNull().default(false),
    isLost: boolean("is_lost").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stages_pipeline").on(table.pipelineId),
    index("idx_stages_sort").on(table.sortOrder, table.createdAt),
    index("idx_stages_pipeline_sort").on(table.pipelineId, table.sortOrder, table.createdAt),
    uniqueIndex("uidx_stages_pipeline_name").on(table.pipelineId, table.name),
  ],
)

export const opportunities = pgTable(
  "opportunities",
  {
    id: typeId("opportunities"),
    title: text("title").notNull(),
    personId: typeIdRef("person_id").references(() => people.id, { onDelete: "set null" }),
    organizationId: typeIdRef("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    pipelineId: typeIdRef("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "restrict" }),
    stageId: typeIdRef("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "restrict" }),
    ownerId: text("owner_id"),
    status: opportunityStatusEnum("status").notNull().default("open"),
    valueAmountCents: integer("value_amount_cents"),
    valueCurrency: text("value_currency"),
    expectedCloseDate: date("expected_close_date"),
    source: text("source"),
    sourceRef: text("source_ref"),
    lostReason: text("lost_reason"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_opportunities_person").on(table.personId),
    index("idx_opportunities_org").on(table.organizationId),
    index("idx_opportunities_pipeline").on(table.pipelineId),
    index("idx_opportunities_stage").on(table.stageId),
    index("idx_opportunities_owner").on(table.ownerId),
    index("idx_opportunities_status").on(table.status),
    index("idx_opportunities_person_updated").on(table.personId, table.updatedAt),
    index("idx_opportunities_org_updated").on(table.organizationId, table.updatedAt),
    index("idx_opportunities_pipeline_updated").on(table.pipelineId, table.updatedAt),
    index("idx_opportunities_stage_updated").on(table.stageId, table.updatedAt),
    index("idx_opportunities_owner_updated").on(table.ownerId, table.updatedAt),
    index("idx_opportunities_status_updated").on(table.status, table.updatedAt),
  ],
)

export const opportunityParticipants = pgTable(
  "opportunity_participants",
  {
    id: typeId("opportunity_participants"),
    opportunityId: typeIdRef("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    personId: typeIdRef("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    role: participantRoleEnum("role").notNull().default("other"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_opportunity_participants_opportunity").on(table.opportunityId),
    index("idx_opportunity_participants_opportunity_primary").on(
      table.opportunityId,
      table.isPrimary,
      table.createdAt,
    ),
    index("idx_opportunity_participants_person").on(table.personId),
    uniqueIndex("uidx_opportunity_participants_unique").on(table.opportunityId, table.personId),
  ],
)

export const opportunityProducts = pgTable(
  "opportunity_products",
  {
    id: typeId("opportunity_products"),
    opportunityId: typeIdRef("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    productId: text("product_id"),
    supplierServiceId: text("supplier_service_id"),
    nameSnapshot: text("name_snapshot").notNull(),
    description: text("description"),
    quantity: integer("quantity").notNull().default(1),
    unitPriceAmountCents: integer("unit_price_amount_cents"),
    costAmountCents: integer("cost_amount_cents"),
    currency: text("currency"),
    discountAmountCents: integer("discount_amount_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_opportunity_products_opportunity").on(table.opportunityId),
    index("idx_opportunity_products_opportunity_created").on(table.opportunityId, table.createdAt),
    index("idx_opportunity_products_product").on(table.productId),
    index("idx_opportunity_products_supplier_service").on(table.supplierServiceId),
  ],
)

export const quotes = pgTable(
  "quotes",
  {
    id: typeId("quotes"),
    opportunityId: typeIdRef("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    status: quoteStatusEnum("status").notNull().default("draft"),
    validUntil: date("valid_until"),
    currency: text("currency").notNull(),
    subtotalAmountCents: integer("subtotal_amount_cents").notNull().default(0),
    taxAmountCents: integer("tax_amount_cents").notNull().default(0),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_quotes_opportunity").on(table.opportunityId),
    index("idx_quotes_status").on(table.status),
    index("idx_quotes_opportunity_updated").on(table.opportunityId, table.updatedAt),
    index("idx_quotes_status_updated").on(table.status, table.updatedAt),
  ],
)

export const quoteLines = pgTable(
  "quote_lines",
  {
    id: typeId("quote_lines"),
    quoteId: typeIdRef("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    productId: text("product_id"),
    supplierServiceId: text("supplier_service_id"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceAmountCents: integer("unit_price_amount_cents").notNull().default(0),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_quote_lines_quote").on(table.quoteId),
    index("idx_quote_lines_quote_created").on(table.quoteId, table.createdAt),
    index("idx_quote_lines_product").on(table.productId),
    index("idx_quote_lines_supplier_service").on(table.supplierServiceId),
  ],
)

export type Pipeline = typeof pipelines.$inferSelect
export type NewPipeline = typeof pipelines.$inferInsert
export type Stage = typeof stages.$inferSelect
export type NewStage = typeof stages.$inferInsert
export type Opportunity = typeof opportunities.$inferSelect
export type NewOpportunity = typeof opportunities.$inferInsert
export type OpportunityParticipant = typeof opportunityParticipants.$inferSelect
export type NewOpportunityParticipant = typeof opportunityParticipants.$inferInsert
export type OpportunityProduct = typeof opportunityProducts.$inferSelect
export type NewOpportunityProduct = typeof opportunityProducts.$inferInsert
export type Quote = typeof quotes.$inferSelect
export type NewQuote = typeof quotes.$inferInsert
export type QuoteLine = typeof quoteLines.$inferSelect
export type NewQuoteLine = typeof quoteLines.$inferInsert

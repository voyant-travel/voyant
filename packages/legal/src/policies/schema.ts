import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { relations } from "drizzle-orm"
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { legalTargetKindEnum } from "../targets/schema.js"

// ---------- enums ----------

export const policyKindEnum = pgEnum("policy_kind", [
  "cancellation",
  "payment",
  "terms_and_conditions",
  "privacy",
  "refund",
  "commission",
  "guarantee",
  "other",
])

export const policyVersionStatusEnum = pgEnum("policy_version_status", [
  "draft",
  "published",
  "retired",
])

export const policyRuleTypeEnum = pgEnum("policy_rule_type", [
  "window",
  "percentage",
  "flat_amount",
  "date_range",
  "custom",
])

export const policyRefundTypeEnum = pgEnum("policy_refund_type", [
  "cash",
  "credit",
  "cash_or_credit",
  "none",
])

export const policyAssignmentScopeEnum = pgEnum("policy_assignment_scope", [
  "product",
  "channel",
  "supplier",
  "market",
  "organization",
  "global",
])

export const policyAcceptanceMethodEnum = pgEnum("policy_acceptance_method", [
  "implicit",
  "explicit_checkbox",
  "signature",
])

// ---------- policies ----------

export const policies = pgTable(
  "policies",
  {
    id: typeId("policies"),
    kind: policyKindEnum("kind").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    language: text("language").notNull().default("en"),
    currentVersionId: typeIdRef("current_version_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_policies_kind").on(table.kind),
    index("idx_policies_language").on(table.language),
    index("idx_policies_kind_updated").on(table.kind, table.updatedAt),
    index("idx_policies_language_updated").on(table.language, table.updatedAt),
    uniqueIndex("uq_policies_slug").on(table.slug),
  ],
)

export type Policy = typeof policies.$inferSelect
export type NewPolicy = typeof policies.$inferInsert

// ---------- policy_versions ----------

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: typeId("policy_versions"),
    policyId: typeIdRef("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: policyVersionStatusEnum("status").notNull().default("draft"),
    title: text("title").notNull(),
    body: text("body"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by"),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_policy_versions_policy").on(table.policyId),
    index("idx_policy_versions_status").on(table.status),
    uniqueIndex("uq_policy_versions_policy_version").on(table.policyId, table.version),
  ],
)

export type PolicyVersion = typeof policyVersions.$inferSelect
export type NewPolicyVersion = typeof policyVersions.$inferInsert

// ---------- policy_rules ----------

export const policyRules = pgTable(
  "policy_rules",
  {
    id: typeId("policy_rules"),
    policyVersionId: typeIdRef("policy_version_id")
      .notNull()
      .references(() => policyVersions.id, { onDelete: "cascade" }),
    ruleType: policyRuleTypeEnum("rule_type").notNull(),
    label: text("label"),
    // Cancellation-window fields
    daysBeforeDeparture: integer("days_before_departure"),
    refundPercent: integer("refund_percent"),
    refundType: policyRefundTypeEnum("refund_type"),
    flatAmountCents: integer("flat_amount_cents"),
    currency: text("currency"),
    // Generic date range
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    // Evaluation input
    conditions: jsonb("conditions"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_policy_rules_version").on(table.policyVersionId),
    index("idx_policy_rules_version_sort_created").on(
      table.policyVersionId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_policy_rules_type").on(table.ruleType),
    index("idx_policy_rules_sort").on(table.sortOrder),
  ],
)

export type PolicyRule = typeof policyRules.$inferSelect
export type NewPolicyRule = typeof policyRules.$inferInsert

// ---------- policy_assignments ----------

export const policyAssignments = pgTable(
  "policy_assignments",
  {
    id: typeId("policy_assignments"),
    policyId: typeIdRef("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    scope: policyAssignmentScopeEnum("scope").notNull(),
    productId: typeIdRef("product_id"),
    channelId: typeIdRef("channel_id"),
    supplierId: typeIdRef("supplier_id"),
    marketId: typeIdRef("market_id"),
    organizationId: typeIdRef("organization_id"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    priority: integer("priority").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_policy_assignments_policy").on(table.policyId),
    index("idx_policy_assignments_scope").on(table.scope),
    index("idx_policy_assignments_product").on(table.productId),
    index("idx_policy_assignments_channel").on(table.channelId),
    index("idx_policy_assignments_supplier").on(table.supplierId),
    index("idx_policy_assignments_market").on(table.marketId),
    index("idx_policy_assignments_organization").on(table.organizationId),
    index("idx_policy_assignments_priority").on(table.priority),
    index("idx_policy_assignments_policy_priority_created").on(
      table.policyId,
      table.priority,
      table.createdAt,
    ),
    index("idx_policy_assignments_scope_priority_created").on(
      table.scope,
      table.priority,
      table.createdAt,
    ),
    index("idx_policy_assignments_product_priority_created").on(
      table.productId,
      table.priority,
      table.createdAt,
    ),
    index("idx_policy_assignments_channel_priority_created").on(
      table.channelId,
      table.priority,
      table.createdAt,
    ),
    index("idx_policy_assignments_supplier_priority_created").on(
      table.supplierId,
      table.priority,
      table.createdAt,
    ),
    index("idx_policy_assignments_market_priority_created").on(
      table.marketId,
      table.priority,
      table.createdAt,
    ),
    index("idx_policy_assignments_organization_priority_created").on(
      table.organizationId,
      table.priority,
      table.createdAt,
    ),
  ],
)

export type PolicyAssignment = typeof policyAssignments.$inferSelect
export type NewPolicyAssignment = typeof policyAssignments.$inferInsert

// ---------- policy_acceptances ----------

export const policyAcceptances = pgTable(
  "policy_acceptances",
  {
    id: typeId("policy_acceptances"),
    policyVersionId: typeIdRef("policy_version_id")
      .notNull()
      .references(() => policyVersions.id, { onDelete: "restrict" }),
    personId: typeIdRef("person_id"),
    bookingId: typeIdRef("booking_id"),
    targetKind: legalTargetKindEnum("target_kind"),
    targetId: typeIdRef("target_id"),
    targetProvider: text("target_provider"),
    targetSourceRef: text("target_source_ref"),
    legacyTransactionOfferId: typeIdRef("legacy_transaction_offer_id"),
    legacyTransactionOrderId: typeIdRef("legacy_transaction_order_id"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedBy: text("accepted_by"),
    method: policyAcceptanceMethodEnum("method").notNull().default("implicit"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_policy_acceptances_version").on(table.policyVersionId),
    index("idx_policy_acceptances_person").on(table.personId),
    index("idx_policy_acceptances_booking").on(table.bookingId),
    index("idx_policy_acceptances_target").on(table.targetKind, table.targetId),
    index("idx_policy_acceptances_provider_source").on(table.targetProvider, table.targetSourceRef),
    index("idx_policy_acceptances_legacy_transaction_offer").on(table.legacyTransactionOfferId),
    index("idx_policy_acceptances_legacy_transaction_order").on(table.legacyTransactionOrderId),
    index("idx_policy_acceptances_version_accepted").on(table.policyVersionId, table.acceptedAt),
    index("idx_policy_acceptances_person_accepted").on(table.personId, table.acceptedAt),
    index("idx_policy_acceptances_booking_accepted").on(table.bookingId, table.acceptedAt),
    index("idx_policy_acceptances_target_accepted").on(
      table.targetKind,
      table.targetId,
      table.acceptedAt,
    ),
  ],
)

export type PolicyAcceptance = typeof policyAcceptances.$inferSelect
export type NewPolicyAcceptance = typeof policyAcceptances.$inferInsert

// ---------- relations ----------

export const policiesRelations = relations(policies, ({ many }) => ({
  versions: many(policyVersions),
  assignments: many(policyAssignments),
}))

export const policyVersionsRelations = relations(policyVersions, ({ one, many }) => ({
  policy: one(policies, { fields: [policyVersions.policyId], references: [policies.id] }),
  rules: many(policyRules),
  acceptances: many(policyAcceptances),
}))

export const policyRulesRelations = relations(policyRules, ({ one }) => ({
  policyVersion: one(policyVersions, {
    fields: [policyRules.policyVersionId],
    references: [policyVersions.id],
  }),
}))

export const policyAssignmentsRelations = relations(policyAssignments, ({ one }) => ({
  policy: one(policies, { fields: [policyAssignments.policyId], references: [policies.id] }),
}))

export const policyAcceptancesRelations = relations(policyAcceptances, ({ one }) => ({
  policyVersion: one(policyVersions, {
    fields: [policyAcceptances.policyVersionId],
    references: [policyVersions.id],
  }),
}))

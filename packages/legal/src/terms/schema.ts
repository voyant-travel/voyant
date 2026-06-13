import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { contracts } from "../contracts/schema.js"
import { policyVersions } from "../policies/schema.js"
import { legalTargetKindEnum } from "../targets/schema.js"

export const legalTermTypeEnum = pgEnum("legal_term_type", [
  "terms_and_conditions",
  "cancellation",
  "guarantee",
  "payment",
  "pricing",
  "commission",
  "other",
])

export const legalTermAcceptanceStatusEnum = pgEnum("legal_term_acceptance_status", [
  "not_required",
  "pending",
  "accepted",
  "declined",
])

export const legalTerms = pgTable(
  "legal_terms",
  {
    id: typeId("order_terms"),
    contractId: typeIdRef("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    policyVersionId: typeIdRef("policy_version_id").references(() => policyVersions.id, {
      onDelete: "set null",
    }),
    targetKind: legalTargetKindEnum("target_kind"),
    targetId: typeIdRef("target_id"),
    targetProvider: text("target_provider"),
    targetSourceRef: text("target_source_ref"),
    legacyTransactionOfferId: typeIdRef("legacy_transaction_offer_id"),
    legacyTransactionOrderId: typeIdRef("legacy_transaction_order_id"),
    termType: legalTermTypeEnum("term_type").notNull().default("terms_and_conditions"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    language: text("language"),
    required: boolean("required").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    acceptanceStatus: legalTermAcceptanceStatusEnum("acceptance_status")
      .notNull()
      .default("pending"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: text("accepted_by"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_legal_terms_contract_sort").on(table.contractId, table.sortOrder, table.createdAt),
    index("idx_legal_terms_policy_version_sort").on(
      table.policyVersionId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_legal_terms_target_sort").on(
      table.targetKind,
      table.targetId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_legal_terms_provider_source_sort").on(
      table.targetProvider,
      table.targetSourceRef,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_legal_terms_legacy_transaction_offer_sort").on(
      table.legacyTransactionOfferId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_legal_terms_legacy_transaction_order_sort").on(
      table.legacyTransactionOrderId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_legal_terms_type_sort").on(table.termType, table.sortOrder, table.createdAt),
    index("idx_legal_terms_acceptance_sort").on(
      table.acceptanceStatus,
      table.sortOrder,
      table.createdAt,
    ),
  ],
)

export type LegalTerm = typeof legalTerms.$inferSelect
export type NewLegalTerm = typeof legalTerms.$inferInsert

export const legalTermsRelations = relations(legalTerms, ({ one }) => ({
  contract: one(contracts, { fields: [legalTerms.contractId], references: [contracts.id] }),
  policyVersion: one(policyVersions, {
    fields: [legalTerms.policyVersionId],
    references: [policyVersions.id],
  }),
}))

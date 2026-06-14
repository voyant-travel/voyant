import { typeId } from "@voyant-travel/db/lib/typeid-column"
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

import { taxRegimeCodeEnum } from "./enums.js"

// ---------- tax_regimes ----------

export const taxRegimes = pgTable(
  "tax_regimes",
  {
    id: typeId("tax_regimes"),
    code: taxRegimeCodeEnum("code").notNull(),
    name: text("name").notNull(),
    jurisdiction: text("jurisdiction"),
    ratePercent: integer("rate_percent"),
    description: text("description"),
    legalReference: text("legal_reference"),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tax_regimes_code").on(table.code),
    index("idx_tax_regimes_code_updated").on(table.code, table.updatedAt),
    index("idx_tax_regimes_jurisdiction").on(table.jurisdiction),
    index("idx_tax_regimes_jurisdiction_updated").on(table.jurisdiction, table.updatedAt),
    index("idx_tax_regimes_active").on(table.active),
    index("idx_tax_regimes_active_updated").on(table.active, table.updatedAt),
  ],
)

export type TaxRegime = typeof taxRegimes.$inferSelect
export type NewTaxRegime = typeof taxRegimes.$inferInsert

// ---------- tax_classes ----------
//
// Per-product tax-treatment decision. Stacks on top of `tax_regimes`
// (the jurisdictional rate catalog) — a class points at a default
// regime, plus optional regime-per-applies_to overrides for products
// that mix base / addon / accommodation treatments.
//
// Per booking-journey-architecture §9.

export const taxClassAppliesToEnum = pgEnum("tax_class_applies_to", [
  "base",
  "addon",
  "accommodation",
  "all",
])

export const taxPolicySideEnum = pgEnum("tax_policy_side", ["sell", "buy"])

export const taxClasses = pgTable(
  "tax_classes",
  {
    id: typeId("tax_classes"),
    /** Stable code for idempotent seeding (e.g. "vat-standard-ro",
     *  "exempt-art311", "reduced-de"). */
    code: text("code").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    /** Default regime resolved at quote time when no per-line rule
     *  matches. Plain text — cross-domain refs go through link service
     *  per schema-discipline. */
    defaultRegimeId: text("default_regime_id"),
    /**
     * Regime-per-applies_to overrides. Empty / null falls through to
     * `default_regime_id`. Parsed at quote time by the engine.
     */
    lines:
      jsonb("lines").$type<
        Array<{
          regime_id: string
          applies_to: "base" | "addon" | "accommodation" | "all"
        }>
      >(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tax_classes_code").on(table.code),
    index("idx_tax_classes_active").on(table.active),
  ],
)

export type TaxClass = typeof taxClasses.$inferSelect
export type NewTaxClass = typeof taxClasses.$inferInsert

// ---------- tax_policy_profiles ----------
//
// Operator/jurisdiction-specific tax decision profiles. Profiles are
// implementation presets such as "Romanian travel operator"; rules under
// the profile map product/order facts to tax regimes for sell-side and
// buy-side tax decisions.

export const taxPolicyProfiles = pgTable(
  "tax_policy_profiles",
  {
    id: typeId("tax_policy_profiles"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    jurisdiction: text("jurisdiction"),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tax_policy_profiles_code").on(table.code),
    index("idx_tax_policy_profiles_active").on(table.active),
  ],
)

export type TaxPolicyProfile = typeof taxPolicyProfiles.$inferSelect
export type NewTaxPolicyProfile = typeof taxPolicyProfiles.$inferInsert

export const taxPolicyRules = pgTable(
  "tax_policy_rules",
  {
    id: typeId("tax_policy_rules"),
    profileId: text("profile_id").notNull(),
    side: taxPolicySideEnum("side").notNull().default("sell"),
    priority: integer("priority").notNull().default(100),
    name: text("name").notNull(),
    appliesTo: taxClassAppliesToEnum("applies_to").notNull().default("all"),
    condition: jsonb("condition").$type<Record<string, unknown>>(),
    taxRegimeId: text("tax_regime_id").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tax_policy_rules_profile").on(table.profileId),
    index("idx_tax_policy_rules_profile_side_priority").on(
      table.profileId,
      table.side,
      table.priority,
    ),
    index("idx_tax_policy_rules_active").on(table.active),
  ],
)

export type TaxPolicyRule = typeof taxPolicyRules.$inferSelect
export type NewTaxPolicyRule = typeof taxPolicyRules.$inferInsert

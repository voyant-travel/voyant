import { relations } from "drizzle-orm"
import { priceCatalogs, priceSchedules } from "./schema-catalogs.js"
import { pricingCategories, pricingCategoryDependencies } from "./schema-categories.js"
import { departurePriceOverrides } from "./schema-departure-overrides.js"
import {
  dropoffPriceRules,
  extraPriceRules,
  optionPriceRules,
  optionStartTimeRules,
  optionUnitPriceRules,
  optionUnitTiers,
  pickupPriceRules,
} from "./schema-option-rules.js"
import { cancellationPolicies, cancellationPolicyRules } from "./schema-policies.js"

export const pricingCategoriesRelations = relations(pricingCategories, ({ many }) => ({
  childDependencies: many(pricingCategoryDependencies, { relationName: "pricingCategoryChild" }),
  masterDependencies: many(pricingCategoryDependencies, { relationName: "pricingCategoryMaster" }),
  unitPriceRules: many(optionUnitPriceRules),
}))

export const pricingCategoryDependenciesRelations = relations(
  pricingCategoryDependencies,
  ({ one }) => ({
    pricingCategory: one(pricingCategories, {
      relationName: "pricingCategoryChild",
      fields: [pricingCategoryDependencies.pricingCategoryId],
      references: [pricingCategories.id],
    }),
    masterPricingCategory: one(pricingCategories, {
      relationName: "pricingCategoryMaster",
      fields: [pricingCategoryDependencies.masterPricingCategoryId],
      references: [pricingCategories.id],
    }),
  }),
)

export const cancellationPoliciesRelations = relations(cancellationPolicies, ({ many }) => ({
  rules: many(cancellationPolicyRules),
  optionPriceRules: many(optionPriceRules),
}))

export const cancellationPolicyRulesRelations = relations(cancellationPolicyRules, ({ one }) => ({
  cancellationPolicy: one(cancellationPolicies, {
    fields: [cancellationPolicyRules.cancellationPolicyId],
    references: [cancellationPolicies.id],
  }),
}))

export const priceCatalogsRelations = relations(priceCatalogs, ({ many }) => ({
  schedules: many(priceSchedules),
  optionPriceRules: many(optionPriceRules),
  departureOverrides: many(departurePriceOverrides),
}))

export const departurePriceOverridesRelations = relations(departurePriceOverrides, ({ one }) => ({
  priceCatalog: one(priceCatalogs, {
    fields: [departurePriceOverrides.priceCatalogId],
    references: [priceCatalogs.id],
  }),
}))

export const priceSchedulesRelations = relations(priceSchedules, ({ one, many }) => ({
  priceCatalog: one(priceCatalogs, {
    fields: [priceSchedules.priceCatalogId],
    references: [priceCatalogs.id],
  }),
  optionPriceRules: many(optionPriceRules),
}))

export const optionPriceRulesRelations = relations(optionPriceRules, ({ one, many }) => ({
  priceCatalog: one(priceCatalogs, {
    fields: [optionPriceRules.priceCatalogId],
    references: [priceCatalogs.id],
  }),
  priceSchedule: one(priceSchedules, {
    fields: [optionPriceRules.priceScheduleId],
    references: [priceSchedules.id],
  }),
  cancellationPolicy: one(cancellationPolicies, {
    fields: [optionPriceRules.cancellationPolicyId],
    references: [cancellationPolicies.id],
  }),
  unitRules: many(optionUnitPriceRules),
  startTimeRules: many(optionStartTimeRules),
  pickupRules: many(pickupPriceRules),
  dropoffRules: many(dropoffPriceRules),
  extraRules: many(extraPriceRules),
}))

export const optionUnitPriceRulesRelations = relations(optionUnitPriceRules, ({ one, many }) => ({
  optionPriceRule: one(optionPriceRules, {
    fields: [optionUnitPriceRules.optionPriceRuleId],
    references: [optionPriceRules.id],
  }),
  pricingCategory: one(pricingCategories, {
    fields: [optionUnitPriceRules.pricingCategoryId],
    references: [pricingCategories.id],
  }),
  tiers: many(optionUnitTiers),
}))

export const optionStartTimeRulesRelations = relations(optionStartTimeRules, ({ one }) => ({
  optionPriceRule: one(optionPriceRules, {
    fields: [optionStartTimeRules.optionPriceRuleId],
    references: [optionPriceRules.id],
  }),
}))

export const optionUnitTiersRelations = relations(optionUnitTiers, ({ one }) => ({
  optionUnitPriceRule: one(optionUnitPriceRules, {
    fields: [optionUnitTiers.optionUnitPriceRuleId],
    references: [optionUnitPriceRules.id],
  }),
}))

export const pickupPriceRulesRelations = relations(pickupPriceRules, ({ one }) => ({
  optionPriceRule: one(optionPriceRules, {
    fields: [pickupPriceRules.optionPriceRuleId],
    references: [optionPriceRules.id],
  }),
}))

export const dropoffPriceRulesRelations = relations(dropoffPriceRules, ({ one }) => ({
  optionPriceRule: one(optionPriceRules, {
    fields: [dropoffPriceRules.optionPriceRuleId],
    references: [optionPriceRules.id],
  }),
}))

export const extraPriceRulesRelations = relations(extraPriceRules, ({ one }) => ({
  optionPriceRule: one(optionPriceRules, {
    fields: [extraPriceRules.optionPriceRuleId],
    references: [optionPriceRules.id],
  }),
}))

import { availabilitySlots, availabilityStartTimes } from "@voyantjs/availability/schema"
import { productOptions, products } from "@voyantjs/products/schema"
import { suppliers } from "@voyantjs/suppliers/schema"
import { relations } from "drizzle-orm"
import {
  channelReconciliationPolicies,
  channelReleaseSchedules,
  channelSettlementPolicies,
} from "./schema-automation.js"
import {
  channelBookingLinks,
  channelCommissionRules,
  channelContactProjections,
  channelContracts,
  channelProductMappings,
  channels,
  channelWebhookEvents,
} from "./schema-core.js"
import {
  channelReconciliationItems,
  channelReconciliationRuns,
  channelRemittanceExceptions,
  channelSettlementApprovals,
  channelSettlementItems,
  channelSettlementRuns,
} from "./schema-finance.js"
import {
  channelInventoryAllotments,
  channelInventoryAllotmentTargets,
  channelInventoryReleaseExecutions,
  channelInventoryReleaseRules,
} from "./schema-inventory.js"

export const channelsRelations = relations(channels, ({ many, one }) => ({
  contracts: many(channelContracts),
  productMappings: many(channelProductMappings),
  bookingLinks: many(channelBookingLinks),
  webhookEvents: many(channelWebhookEvents),
  inventoryAllotments: many(channelInventoryAllotments),
  settlementRuns: many(channelSettlementRuns),
  reconciliationRuns: many(channelReconciliationRuns),
  settlementPolicies: many(channelSettlementPolicies),
  reconciliationPolicies: many(channelReconciliationPolicies),
  remittanceExceptions: many(channelRemittanceExceptions),
  contactProjection: one(channelContactProjections, {
    fields: [channels.id],
    references: [channelContactProjections.channelId],
  }),
}))

export const channelContactProjectionsRelations = relations(
  channelContactProjections,
  ({ one }) => ({
    channel: one(channels, {
      fields: [channelContactProjections.channelId],
      references: [channels.id],
    }),
  }),
)

export const channelContractsRelations = relations(channelContracts, ({ one, many }) => ({
  channel: one(channels, { fields: [channelContracts.channelId], references: [channels.id] }),
  supplier: one(suppliers, {
    fields: [channelContracts.supplierId],
    references: [suppliers.id],
  }),
  commissionRules: many(channelCommissionRules),
  inventoryAllotments: many(channelInventoryAllotments),
  settlementRuns: many(channelSettlementRuns),
  reconciliationRuns: many(channelReconciliationRuns),
}))

export const channelCommissionRulesRelations = relations(channelCommissionRules, ({ one }) => ({
  contract: one(channelContracts, {
    fields: [channelCommissionRules.contractId],
    references: [channelContracts.id],
  }),
  product: one(products, {
    fields: [channelCommissionRules.productId],
    references: [products.id],
  }),
}))

export const channelProductMappingsRelations = relations(channelProductMappings, ({ one }) => ({
  channel: one(channels, {
    fields: [channelProductMappings.channelId],
    references: [channels.id],
  }),
  product: one(products, {
    fields: [channelProductMappings.productId],
    references: [products.id],
  }),
}))

export const channelBookingLinksRelations = relations(channelBookingLinks, ({ one }) => ({
  channel: one(channels, {
    fields: [channelBookingLinks.channelId],
    references: [channels.id],
  }),
}))

export const channelInventoryAllotmentsRelations = relations(
  channelInventoryAllotments,
  ({ one, many }) => ({
    channel: one(channels, {
      fields: [channelInventoryAllotments.channelId],
      references: [channels.id],
    }),
    contract: one(channelContracts, {
      fields: [channelInventoryAllotments.contractId],
      references: [channelContracts.id],
    }),
    product: one(products, {
      fields: [channelInventoryAllotments.productId],
      references: [products.id],
    }),
    option: one(productOptions, {
      fields: [channelInventoryAllotments.optionId],
      references: [productOptions.id],
    }),
    startTime: one(availabilityStartTimes, {
      fields: [channelInventoryAllotments.startTimeId],
      references: [availabilityStartTimes.id],
    }),
    targets: many(channelInventoryAllotmentTargets),
    releaseRules: many(channelInventoryReleaseRules),
    releaseExecutions: many(channelInventoryReleaseExecutions),
  }),
)

export const channelInventoryAllotmentTargetsRelations = relations(
  channelInventoryAllotmentTargets,
  ({ one }) => ({
    allotment: one(channelInventoryAllotments, {
      fields: [channelInventoryAllotmentTargets.allotmentId],
      references: [channelInventoryAllotments.id],
    }),
    slot: one(availabilitySlots, {
      fields: [channelInventoryAllotmentTargets.slotId],
      references: [availabilitySlots.id],
    }),
    startTime: one(availabilityStartTimes, {
      fields: [channelInventoryAllotmentTargets.startTimeId],
      references: [availabilityStartTimes.id],
    }),
  }),
)

export const channelInventoryReleaseRulesRelations = relations(
  channelInventoryReleaseRules,
  ({ one, many }) => ({
    allotment: one(channelInventoryAllotments, {
      fields: [channelInventoryReleaseRules.allotmentId],
      references: [channelInventoryAllotments.id],
    }),
    schedules: many(channelReleaseSchedules),
  }),
)

export const channelSettlementRunsRelations = relations(channelSettlementRuns, ({ one, many }) => ({
  channel: one(channels, {
    fields: [channelSettlementRuns.channelId],
    references: [channels.id],
  }),
  contract: one(channelContracts, {
    fields: [channelSettlementRuns.contractId],
    references: [channelContracts.id],
  }),
  items: many(channelSettlementItems),
  approvals: many(channelSettlementApprovals),
}))

export const channelSettlementItemsRelations = relations(channelSettlementItems, ({ one }) => ({
  settlementRun: one(channelSettlementRuns, {
    fields: [channelSettlementItems.settlementRunId],
    references: [channelSettlementRuns.id],
  }),
  bookingLink: one(channelBookingLinks, {
    fields: [channelSettlementItems.bookingLinkId],
    references: [channelBookingLinks.id],
  }),
  commissionRule: one(channelCommissionRules, {
    fields: [channelSettlementItems.commissionRuleId],
    references: [channelCommissionRules.id],
  }),
}))

export const channelReconciliationRunsRelations = relations(
  channelReconciliationRuns,
  ({ one, many }) => ({
    channel: one(channels, {
      fields: [channelReconciliationRuns.channelId],
      references: [channels.id],
    }),
    contract: one(channelContracts, {
      fields: [channelReconciliationRuns.contractId],
      references: [channelContracts.id],
    }),
    items: many(channelReconciliationItems),
  }),
)

export const channelReconciliationItemsRelations = relations(
  channelReconciliationItems,
  ({ one }) => ({
    reconciliationRun: one(channelReconciliationRuns, {
      fields: [channelReconciliationItems.reconciliationRunId],
      references: [channelReconciliationRuns.id],
    }),
    bookingLink: one(channelBookingLinks, {
      fields: [channelReconciliationItems.bookingLinkId],
      references: [channelBookingLinks.id],
    }),
  }),
)

export const channelInventoryReleaseExecutionsRelations = relations(
  channelInventoryReleaseExecutions,
  ({ one }) => ({
    allotment: one(channelInventoryAllotments, {
      fields: [channelInventoryReleaseExecutions.allotmentId],
      references: [channelInventoryAllotments.id],
    }),
    releaseRule: one(channelInventoryReleaseRules, {
      fields: [channelInventoryReleaseExecutions.releaseRuleId],
      references: [channelInventoryReleaseRules.id],
    }),
    target: one(channelInventoryAllotmentTargets, {
      fields: [channelInventoryReleaseExecutions.targetId],
      references: [channelInventoryAllotmentTargets.id],
    }),
    slot: one(availabilitySlots, {
      fields: [channelInventoryReleaseExecutions.slotId],
      references: [availabilitySlots.id],
    }),
  }),
)

export const channelSettlementPoliciesRelations = relations(
  channelSettlementPolicies,
  ({ one }) => ({
    channel: one(channels, {
      fields: [channelSettlementPolicies.channelId],
      references: [channels.id],
    }),
    contract: one(channelContracts, {
      fields: [channelSettlementPolicies.contractId],
      references: [channelContracts.id],
    }),
  }),
)

export const channelReconciliationPoliciesRelations = relations(
  channelReconciliationPolicies,
  ({ one }) => ({
    channel: one(channels, {
      fields: [channelReconciliationPolicies.channelId],
      references: [channels.id],
    }),
    contract: one(channelContracts, {
      fields: [channelReconciliationPolicies.contractId],
      references: [channelContracts.id],
    }),
  }),
)

export const channelReleaseSchedulesRelations = relations(channelReleaseSchedules, ({ one }) => ({
  releaseRule: one(channelInventoryReleaseRules, {
    fields: [channelReleaseSchedules.releaseRuleId],
    references: [channelInventoryReleaseRules.id],
  }),
}))

export const channelRemittanceExceptionsRelations = relations(
  channelRemittanceExceptions,
  ({ one }) => ({
    channel: one(channels, {
      fields: [channelRemittanceExceptions.channelId],
      references: [channels.id],
    }),
    settlementItem: one(channelSettlementItems, {
      fields: [channelRemittanceExceptions.settlementItemId],
      references: [channelSettlementItems.id],
    }),
    reconciliationItem: one(channelReconciliationItems, {
      fields: [channelRemittanceExceptions.reconciliationItemId],
      references: [channelReconciliationItems.id],
    }),
  }),
)

export const channelSettlementApprovalsRelations = relations(
  channelSettlementApprovals,
  ({ one }) => ({
    settlementRun: one(channelSettlementRuns, {
      fields: [channelSettlementApprovals.settlementRunId],
      references: [channelSettlementRuns.id],
    }),
  }),
)

export const channelWebhookEventsRelations = relations(channelWebhookEvents, ({ one }) => ({
  channel: one(channels, {
    fields: [channelWebhookEvents.channelId],
    references: [channels.id],
  }),
}))

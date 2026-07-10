import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { externalRefsHonoModule } from "./external-refs/index.js"
import { distributionRoutes } from "./routes.js"
import { distributionService } from "./service.js"
import { suppliersHonoModule } from "./suppliers/index.js"

export type { DistributionRoutes } from "./routes.js"

export const distributionModule: Module = {
  name: "distribution",
}

export const distributionHonoModule: HonoModule = {
  module: distributionModule,
  adminRoutes: distributionRoutes,
}

export const distributionHonoModules = [
  externalRefsHonoModule,
  distributionHonoModule,
  suppliersHonoModule,
] as const

export * from "./booking-extension.js"
export * from "./channel-push/index.js"
export {
  classifyMappingUpdate,
  emitProductPublicationChanged,
  PRODUCT_PUBLICATION_CHANGED_EVENT,
  type ProductPublicationChangedEvent,
  type ProductPublicationOperation,
} from "./events.js"
export * from "./external-refs/index.js"
export type {
  DistributionCounterpartyEntityType,
  DistributionCounterpartyRecord,
  DistributionCounterpartyReference,
  DistributionCounterpartyRole,
  DistributionExternalReferenceInput,
  LinkExternalReferenceInput,
  LinkExternalReferenceOutcome,
  ReconcileCounterpartyActivityInput,
  ReconcileCounterpartyActivityOutcome,
  ResolveCounterpartyOutcome,
  RouteCounterpartyEventInput,
  RouteCounterpartyEventOutcome,
} from "./interface.js"
export {
  counterpartyEntityTypeToRole,
  counterpartyRoleToEntityType,
  linkExternalReference,
  reconcileCounterpartyActivity,
  resolveCounterparty,
  routeCounterpartyEvent,
} from "./interface.js"
export {
  type EnqueueGraphWebhookEventOptions,
  enqueueGraphWebhookEvent,
} from "./outbound-webhooks.js"
export {
  type AcquireTokenAcquired,
  type AcquireTokenDenied,
  type AcquireTokenResult,
  acquireToken,
  type ChannelPushPriority,
  channelScopeKey,
  DEFAULT_PRIORITY_GATES,
  drainBucket,
  type RateLimitConfig,
} from "./rate-limit.js"
export type {
  Channel,
  ChannelBookingLink,
  ChannelCommissionRule,
  ChannelContactProjection,
  ChannelContract,
  ChannelInventoryAllotment,
  ChannelInventoryAllotmentTarget,
  ChannelInventoryReleaseExecution,
  ChannelInventoryReleaseRule,
  ChannelProductMapping,
  ChannelReconciliationItem,
  ChannelReconciliationPolicy,
  ChannelReconciliationRun,
  ChannelReleaseSchedule,
  ChannelRemittanceException,
  ChannelSettlementApproval,
  ChannelSettlementItem,
  ChannelSettlementPolicy,
  ChannelSettlementRun,
  ChannelWebhookEvent,
  NewChannel,
  NewChannelBookingLink,
  NewChannelCommissionRule,
  NewChannelContactProjection,
  NewChannelContract,
  NewChannelInventoryAllotment,
  NewChannelInventoryAllotmentTarget,
  NewChannelInventoryReleaseExecution,
  NewChannelInventoryReleaseRule,
  NewChannelProductMapping,
  NewChannelReconciliationItem,
  NewChannelReconciliationPolicy,
  NewChannelReconciliationRun,
  NewChannelReleaseSchedule,
  NewChannelRemittanceException,
  NewChannelSettlementApproval,
  NewChannelSettlementItem,
  NewChannelSettlementPolicy,
  NewChannelSettlementRun,
  NewChannelWebhookEvent,
} from "./schema.js"
export {
  channelBookingLinks,
  channelCommissionRules,
  channelContactProjections,
  channelContracts,
  channelInventoryAllotments,
  channelInventoryAllotmentTargets,
  channelInventoryReleaseExecutions,
  channelInventoryReleaseRules,
  channelProductMappings,
  channelReconciliationItems,
  channelReconciliationPolicies,
  channelReconciliationPolicyFrequencyEnum,
  channelReconciliationRuns,
  channelReleaseScheduleKindEnum,
  channelReleaseSchedules,
  channelRemittanceExceptionStatusEnum,
  channelRemittanceExceptions,
  channelSettlementApprovalStatusEnum,
  channelSettlementApprovals,
  channelSettlementItems,
  channelSettlementPolicies,
  channelSettlementPolicyFrequencyEnum,
  channelSettlementRuns,
  channels,
  channelWebhookEvents,
} from "./schema.js"
export type {
  ChannelAvailabilityPushIntent,
  ChannelContentPushIntent,
  NewChannelAvailabilityPushIntent,
  NewChannelContentPushIntent,
} from "./schema-push-intents.js"
export {
  channelAvailabilityPushIntents,
  channelContentPushIntents,
} from "./schema-push-intents.js"
export * from "./suppliers/index.js"
export {
  channelBookingLinkListQuerySchema,
  channelCommissionRuleListQuerySchema,
  channelContractListQuerySchema,
  channelInventoryAllotmentListQuerySchema,
  channelInventoryAllotmentTargetListQuerySchema,
  channelInventoryReleaseExecutionListQuerySchema,
  channelInventoryReleaseRuleListQuerySchema,
  channelListQuerySchema,
  channelProductMappingListQuerySchema,
  channelReconciliationItemListQuerySchema,
  channelReconciliationPolicyFrequencySchema,
  channelReconciliationPolicyListQuerySchema,
  channelReconciliationRunListQuerySchema,
  channelReleaseScheduleKindSchema,
  channelReleaseScheduleListQuerySchema,
  channelRemittanceExceptionListQuerySchema,
  channelRemittanceExceptionStatusSchema,
  channelSettlementApprovalListQuerySchema,
  channelSettlementApprovalStatusSchema,
  channelSettlementItemListQuerySchema,
  channelSettlementPolicyFrequencySchema,
  channelSettlementPolicyListQuerySchema,
  channelSettlementRunListQuerySchema,
  channelWebhookEventListQuerySchema,
  insertChannelBookingLinkSchema,
  insertChannelCommissionRuleSchema,
  insertChannelContractSchema,
  insertChannelInventoryAllotmentSchema,
  insertChannelInventoryAllotmentTargetSchema,
  insertChannelInventoryReleaseExecutionSchema,
  insertChannelInventoryReleaseRuleSchema,
  insertChannelProductMappingSchema,
  insertChannelReconciliationItemSchema,
  insertChannelReconciliationPolicySchema,
  insertChannelReconciliationRunSchema,
  insertChannelReleaseScheduleSchema,
  insertChannelRemittanceExceptionSchema,
  insertChannelSchema,
  insertChannelSettlementApprovalSchema,
  insertChannelSettlementItemSchema,
  insertChannelSettlementPolicySchema,
  insertChannelSettlementRunSchema,
  insertChannelWebhookEventSchema,
  updateChannelBookingLinkSchema,
  updateChannelCommissionRuleSchema,
  updateChannelContractSchema,
  updateChannelInventoryAllotmentSchema,
  updateChannelInventoryAllotmentTargetSchema,
  updateChannelInventoryReleaseExecutionSchema,
  updateChannelInventoryReleaseRuleSchema,
  updateChannelProductMappingSchema,
  updateChannelReconciliationItemSchema,
  updateChannelReconciliationPolicySchema,
  updateChannelReconciliationRunSchema,
  updateChannelReleaseScheduleSchema,
  updateChannelRemittanceExceptionSchema,
  updateChannelSchema,
  updateChannelSettlementApprovalSchema,
  updateChannelSettlementItemSchema,
  updateChannelSettlementPolicySchema,
  updateChannelSettlementRunSchema,
  updateChannelWebhookEventSchema,
} from "./validation.js"
export {
  enqueueOutboundEnvelope,
  type OutboundEnvelopeInput,
  type OutboundEnvelopeResultInput,
  type PreparedEnvelope,
  prepareOutboundEnvelope,
  redactBodyPii,
  redactHeaders,
  redactStringPii,
} from "./webhook-deliveries.js"
export { distributionService }

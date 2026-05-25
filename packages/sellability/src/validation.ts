import { booleanQueryParam } from "@voyantjs/db/helpers"
import { z } from "zod"

export const requestedUnitSchema = z.object({
  requestRef: z.string().min(1).max(100).optional(),
  unitId: z.string().nullable().optional(),
  pricingCategoryId: z.string().nullable().optional(),
  quantity: z.number().int().min(1),
})

export const sellabilityResolveQuerySchema = z.object({
  productId: z.string().optional(),
  optionId: z.string().optional(),
  slotId: z.string().optional(),
  dateLocal: z.string().date().optional(),
  startTimeId: z.string().optional(),
  marketId: z.string().optional(),
  channelId: z.string().optional(),
  pickupPointId: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  requestedUnits: z.array(requestedUnitSchema).default([]),
  limit: z.number().int().min(1).max(100).default(25),
})

export const sellabilitySnapshotStatusSchema = z.enum(["resolved", "offer_constructed", "expired"])
export const sellabilityPolicyScopeSchema = z.enum([
  "global",
  "product",
  "option",
  "market",
  "channel",
])
export const sellabilityPolicyTypeSchema = z.enum([
  "capability",
  "occupancy",
  "pickup",
  "question",
  "allotment",
  "availability_window",
  "currency",
  "custom",
])
export const sellabilityPolicyResultStatusSchema = z.enum([
  "passed",
  "blocked",
  "warning",
  "adjusted",
])
export const offerRefreshRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "expired",
])
export const offerExpirationEventStatusSchema = z.enum([
  "scheduled",
  "expired",
  "cancelled",
  "superseded",
])
export const sellabilityExplanationTypeSchema = z.enum([
  "sellable",
  "blocked",
  "warning",
  "pricing",
  "allotment",
  "pickup",
  "policy",
])

export const sellabilityOfferParticipantSchema = z.object({
  personId: z.string().nullable().optional(),
  participantType: z.enum(["traveler", "occupant", "staff", "other"]).default("traveler"),
  travelerCategory: z.enum(["adult", "child", "infant", "senior", "other"]).nullable().optional(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  preferredLanguage: z.string().max(35).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  nationality: z.string().max(2).nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  requestedUnitRefs: z.array(z.string().min(1).max(100)).default([]),
  assignToAllItems: z.boolean().default(false),
  itemParticipantRole: z
    .enum(["traveler", "occupant", "beneficiary", "service_assignee", "other"])
    .optional(),
})

export const sellabilityOfferContactAssignmentSchema = z.object({
  personId: z.string().nullable().optional(),
  role: z.enum(["primary_contact", "other"]).default("primary_contact"),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  preferredLanguage: z.string().max(35).nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  requestedUnitRefs: z.array(z.string().min(1).max(100)).default([]),
  assignToAllItems: z.boolean().default(false),
})

export const sellabilityConstructOfferSchema = z.object({
  query: sellabilityResolveQuerySchema.omit({ limit: true }).extend({
    slotId: z.string(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  offer: z.object({
    offerNumber: z.string().min(1).max(50).optional(),
    title: z.string().min(1).max(255).optional(),
    status: z
      .enum(["draft", "published", "sent", "accepted", "expired", "withdrawn", "converted"])
      .default("published"),
    personId: z.string().nullable().optional(),
    organizationId: z.string().nullable().optional(),
    opportunityId: z.string().nullable().optional(),
    quoteId: z.string().nullable().optional(),
    contactFirstName: z.string().max(255).nullable().optional(),
    contactLastName: z.string().max(255).nullable().optional(),
    contactEmail: z.string().email().nullable().optional(),
    contactPhone: z.string().max(50).nullable().optional(),
    contactPreferredLanguage: z.string().max(35).nullable().optional(),
    contactCountry: z.string().max(100).nullable().optional(),
    contactRegion: z.string().max(255).nullable().optional(),
    contactCity: z.string().max(255).nullable().optional(),
    contactAddressLine1: z.string().max(255).nullable().optional(),
    contactAddressLine2: z.string().max(255).nullable().optional(),
    contactPostalCode: z.string().max(50).nullable().optional(),
    validFrom: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
  participants: z.array(sellabilityOfferParticipantSchema).default([]),
  contactAssignments: z.array(sellabilityOfferContactAssignmentSchema).default([]),
})

export const sellabilityPersistSnapshotSchema = z.object({
  query: sellabilityResolveQuerySchema,
  expiresAt: z.string().datetime().nullable().optional(),
})

export const sellabilitySnapshotListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  offerId: z.string().optional(),
  marketId: z.string().optional(),
  channelId: z.string().optional(),
  productId: z.string().optional(),
  optionId: z.string().optional(),
  slotId: z.string().optional(),
  status: sellabilitySnapshotStatusSchema.optional(),
})

export const sellabilitySnapshotItemListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  snapshotId: z.string().optional(),
  productId: z.string().optional(),
  optionId: z.string().optional(),
  slotId: z.string().optional(),
  unitId: z.string().optional(),
})

export const sellabilityPolicyCoreSchema = z.object({
  name: z.string().min(1).max(255),
  scope: sellabilityPolicyScopeSchema.default("global"),
  policyType: sellabilityPolicyTypeSchema.default("custom"),
  productId: z.string().nullable().optional(),
  optionId: z.string().nullable().optional(),
  marketId: z.string().nullable().optional(),
  channelId: z.string().nullable().optional(),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
  conditions: z.record(z.string(), z.unknown()).default({}),
  effects: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
export const insertSellabilityPolicySchema = sellabilityPolicyCoreSchema
export const updateSellabilityPolicySchema = sellabilityPolicyCoreSchema.partial()
export const sellabilityPolicyListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  scope: sellabilityPolicyScopeSchema.optional(),
  policyType: sellabilityPolicyTypeSchema.optional(),
  productId: z.string().optional(),
  optionId: z.string().optional(),
  marketId: z.string().optional(),
  channelId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const sellabilityPolicyResultCoreSchema = z.object({
  snapshotId: z.string(),
  snapshotItemId: z.string().nullable().optional(),
  policyId: z.string().nullable().optional(),
  candidateIndex: z.number().int().min(0).default(0),
  status: sellabilityPolicyResultStatusSchema.default("passed"),
  message: z.string().nullable().optional(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
})
export const insertSellabilityPolicyResultSchema = sellabilityPolicyResultCoreSchema
export const updateSellabilityPolicyResultSchema = sellabilityPolicyResultCoreSchema.partial()
export const sellabilityPolicyResultListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  snapshotId: z.string().optional(),
  snapshotItemId: z.string().optional(),
  policyId: z.string().optional(),
  status: sellabilityPolicyResultStatusSchema.optional(),
})

export const offerRefreshRunCoreSchema = z.object({
  offerId: z.string(),
  snapshotId: z.string().nullable().optional(),
  status: offerRefreshRunStatusSchema.default("pending"),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
export const insertOfferRefreshRunSchema = offerRefreshRunCoreSchema
export const updateOfferRefreshRunSchema = offerRefreshRunCoreSchema.partial()
export const offerRefreshRunListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  offerId: z.string().optional(),
  snapshotId: z.string().optional(),
  status: offerRefreshRunStatusSchema.optional(),
})

export const offerExpirationEventCoreSchema = z.object({
  offerId: z.string(),
  snapshotId: z.string().nullable().optional(),
  expiresAt: z.string().datetime(),
  expiredAt: z.string().datetime().nullable().optional(),
  status: offerExpirationEventStatusSchema.default("scheduled"),
  reason: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
export const insertOfferExpirationEventSchema = offerExpirationEventCoreSchema
export const updateOfferExpirationEventSchema = offerExpirationEventCoreSchema.partial()
export const offerExpirationEventListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  offerId: z.string().optional(),
  snapshotId: z.string().optional(),
  status: offerExpirationEventStatusSchema.optional(),
})

export const sellabilityExplanationCoreSchema = z.object({
  snapshotId: z.string(),
  snapshotItemId: z.string().nullable().optional(),
  candidateIndex: z.number().int().min(0).default(0),
  explanationType: sellabilityExplanationTypeSchema.default("policy"),
  code: z.string().nullable().optional(),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
})
export const insertSellabilityExplanationSchema = sellabilityExplanationCoreSchema
export const updateSellabilityExplanationSchema = sellabilityExplanationCoreSchema.partial()
export const sellabilityExplanationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  snapshotId: z.string().optional(),
  snapshotItemId: z.string().optional(),
  explanationType: sellabilityExplanationTypeSchema.optional(),
})

export type SellabilityResolveQuery = z.infer<typeof sellabilityResolveQuerySchema>
export type SellabilityConstructOfferInput = z.infer<typeof sellabilityConstructOfferSchema>
export type SellabilityPersistSnapshotInput = z.infer<typeof sellabilityPersistSnapshotSchema>

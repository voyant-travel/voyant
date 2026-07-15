import { z } from "zod"

import {
  tripComponentKindSchema,
  tripComponentStatusSchema,
  tripEnvelopeStatusSchema,
} from "./validation.js"

const isoTimestamp = z.string()
const jsonObject = z.record(z.string(), z.unknown())

export const tripEnvelopeToolSchema = z.object({
  id: z.string(),
  status: tripEnvelopeStatusSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  travelerParty: jsonObject,
  constraints: jsonObject,
  aggregateCurrency: z.string().nullable(),
  aggregateSubtotalAmountCents: z.number().int().nullable(),
  aggregateTaxAmountCents: z.number().int().nullable(),
  aggregateTotalAmountCents: z.number().int().nullable(),
  aggregatePricingSnapshot: z.unknown().nullable(),
  currentPriceExpiresAt: isoTimestamp.nullable(),
  bookingGroupId: z.string().nullable(),
  orderId: z.string().nullable(),
  paymentSessionId: z.string().nullable(),
  reserveIdempotencyKey: z.string().nullable(),
  reserveStartedAt: isoTimestamp.nullable(),
  reservedAt: isoTimestamp.nullable(),
  checkoutIdempotencyKey: z.string().nullable(),
  checkoutStartedAt: isoTimestamp.nullable(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

export const tripComponentToolSchema = z.object({
  id: z.string(),
  envelopeId: z.string(),
  sequence: z.number().int(),
  kind: tripComponentKindSchema,
  status: tripComponentStatusSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  entityModule: z.string().nullable(),
  entityId: z.string().nullable(),
  sourceKind: z.string().nullable(),
  sourceConnectionId: z.string().nullable(),
  sourceRef: z.string().nullable(),
  bookingDraftId: z.string().nullable(),
  catalogQuoteId: z.string().nullable(),
  bookingId: z.string().nullable(),
  bookingGroupId: z.string().nullable(),
  orderId: z.string().nullable(),
  paymentSessionId: z.string().nullable(),
  providerRef: z.string().nullable(),
  supplierRef: z.string().nullable(),
  componentCurrency: z.string().nullable(),
  componentSubtotalAmountCents: z.number().int().nullable(),
  componentTaxAmountCents: z.number().int().nullable(),
  componentTotalAmountCents: z.number().int().nullable(),
  pricingSnapshot: z.unknown().nullable(),
  taxLines: z.array(z.unknown()).nullable(),
  cancellationSnapshot: z.unknown().nullable(),
  holdToken: z.string().nullable(),
  holdExpiresAt: isoTimestamp.nullable(),
  priceExpiresAt: isoTimestamp.nullable(),
  warningCodes: z.array(z.string()),
  metadata: jsonObject,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

export const createTripResultSchema = z.object({
  envelope: tripEnvelopeToolSchema,
  components: z.array(tripComponentToolSchema),
})

export const reviseTripResultSchema = z.object({
  envelopeId: z.string(),
  added: z.array(tripComponentToolSchema),
  removed: z.array(tripComponentToolSchema),
})

export const priceTripResultSchema = createTripResultSchema.extend({
  pricing: z.object({
    currency: z.string(),
    subtotalAmountCents: z.number().int(),
    taxAmountCents: z.number().int(),
    totalAmountCents: z.number().int(),
    componentCount: z.number().int().nonnegative(),
    pricedComponentCount: z.number().int().nonnegative(),
    warnings: z.array(z.string()).optional(),
  }),
  warnings: z.array(z.string()),
  failures: z.array(z.object({ componentId: z.string(), reason: z.string() })),
})

const reservationFailureSchema = z.object({
  componentId: z.string(),
  reason: z.string(),
  code: z.string().optional(),
  details: jsonObject.optional(),
})

export const reserveTripResultSchema = createTripResultSchema.extend({
  reservationPlanId: z.string().nullable().optional(),
  reserved: z.array(
    z.object({
      componentId: z.string(),
      status: z.enum(["held", "booked"]),
    }),
  ),
  failures: z.array(reservationFailureSchema),
  compensations: z.array(
    z.object({
      componentId: z.string(),
      status: z.enum(["released", "release_failed", "release_not_configured"]),
      reason: z.string().optional(),
    }),
  ),
  warnings: z.array(z.string()),
})

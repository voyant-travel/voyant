import {
  insertSellabilityPolicySchema,
  sellabilityPolicyScopeSchema,
  sellabilityPolicyTypeSchema,
} from "@voyant-travel/commerce/validation"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

export const paginatedEnvelope = listResponseSchema

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const successEnvelope = z.object({ success: z.boolean() })

export const sellabilityPolicyRecordSchema = insertSellabilityPolicySchema.extend({
  id: z.string(),
  scope: sellabilityPolicyScopeSchema,
  policyType: sellabilityPolicyTypeSchema,
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  marketId: z.string().nullable(),
  channelId: z.string().nullable(),
  conditions: z.record(z.string(), z.unknown()),
  effects: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type SellabilityPolicyRecord = z.infer<typeof sellabilityPolicyRecordSchema>

export const sellabilityPolicyListResponse = paginatedEnvelope(sellabilityPolicyRecordSchema)
export const sellabilityPolicySingleResponse = singleEnvelope(sellabilityPolicyRecordSchema)

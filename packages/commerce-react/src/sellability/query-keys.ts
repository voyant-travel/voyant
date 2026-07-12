import type {
  sellabilityPolicyScopeSchema,
  sellabilityPolicyTypeSchema,
} from "@voyant-travel/commerce/validation"
import type { z } from "zod"

export interface SellabilityPoliciesListFilters {
  scope?: z.infer<typeof sellabilityPolicyScopeSchema> | undefined
  policyType?: z.infer<typeof sellabilityPolicyTypeSchema> | undefined
  productId?: string | undefined
  optionId?: string | undefined
  marketId?: string | undefined
  channelId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const sellabilityQueryKeys = {
  all: ["voyant", "sellability"] as const,

  policies: () => [...sellabilityQueryKeys.all, "policies"] as const,
  policiesList: (filters: SellabilityPoliciesListFilters) =>
    [...sellabilityQueryKeys.policies(), "list", filters] as const,
  policy: (id: string) => [...sellabilityQueryKeys.policies(), "detail", id] as const,
} as const

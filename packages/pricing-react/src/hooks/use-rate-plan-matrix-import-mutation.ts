"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { type RatePlanMatrixImportInput, ratePlanMatrixImportResponseSchema } from "../schemas.js"

export function useRatePlanMatrixImportMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RatePlanMatrixImportInput) =>
      fetchWithValidation(
        "/v1/pricing/rate-plan-matrix/import",
        ratePlanMatrixImportResponseSchema,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.priceSchedules() })
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.pricingCategories() })
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionPriceRules() })
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionUnitPriceRules() })
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.departurePriceOverrides() })

      if (variables.priceCatalogId) {
        void queryClient.invalidateQueries({
          queryKey: pricingQueryKeys.priceSchedulesList({
            priceCatalogId: variables.priceCatalogId,
          }),
        })
      }
      if (variables.optionId) {
        void queryClient.invalidateQueries({
          queryKey: pricingQueryKeys.pricingCategoriesList({ optionId: variables.optionId }),
        })
        void queryClient.invalidateQueries({
          queryKey: pricingQueryKeys.optionPriceRulesList({ optionId: variables.optionId }),
        })
      }
    },
  })
}

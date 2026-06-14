"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  optionUnitListResponse,
  type ProductOptionRecord,
  productOptionSingleResponse,
} from "../schemas.js"
import { useOptionUnitMutation } from "./use-option-unit-mutation.js"
import { useProductOptionMutation } from "./use-product-option-mutation.js"

export interface DuplicateProductOptionInput {
  sourceOptionId: string
  productId?: string
  name?: string
  code?: string | null
  description?: string | null
  status?: ProductOptionRecord["status"]
  isDefault?: boolean
  sortOrder?: number
  availableFrom?: string | null
  availableTo?: string | null
}

export interface DuplicateProductOptionResult {
  option: ProductOptionRecord
  unitIdMap: Record<string, string>
}

function defaultDuplicateName(name: string) {
  return `${name} Copy`
}

export function useDuplicateProductOptionMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()
  const { create: createOption } = useProductOptionMutation()
  const { create: createUnit } = useOptionUnitMutation()

  return useMutation({
    mutationFn: async ({
      sourceOptionId,
      productId,
      name,
      code,
      description,
      status,
      isDefault,
      sortOrder,
      availableFrom,
      availableTo,
    }: DuplicateProductOptionInput): Promise<DuplicateProductOptionResult> => {
      const [{ data: sourceOption }, { data: sourceUnits }] = await Promise.all([
        fetchWithValidation(`/v1/products/options/${sourceOptionId}`, productOptionSingleResponse, {
          baseUrl,
          fetcher,
        }),
        fetchWithValidation(
          `/v1/products/option-units?optionId=${encodeURIComponent(sourceOptionId)}&limit=100`,
          optionUnitListResponse,
          { baseUrl, fetcher },
        ),
      ])

      const duplicatedOption = await createOption.mutateAsync({
        productId: productId ?? sourceOption.productId,
        name: name ?? defaultDuplicateName(sourceOption.name),
        code: code === undefined ? null : code,
        description: description ?? sourceOption.description,
        status: status ?? sourceOption.status,
        isDefault: isDefault ?? false,
        sortOrder: sortOrder ?? sourceOption.sortOrder + 1,
        availableFrom: availableFrom ?? sourceOption.availableFrom,
        availableTo: availableTo ?? sourceOption.availableTo,
      })

      const unitIdMap: Record<string, string> = {}
      for (const unit of [...sourceUnits].sort((a, b) => a.sortOrder - b.sortOrder)) {
        const duplicatedUnit = await createUnit.mutateAsync({
          optionId: duplicatedOption.id,
          name: unit.name,
          code: unit.code,
          description: unit.description,
          unitType: unit.unitType,
          minQuantity: unit.minQuantity,
          maxQuantity: unit.maxQuantity,
          minAge: unit.minAge,
          maxAge: unit.maxAge,
          occupancyMin: unit.occupancyMin,
          occupancyMax: unit.occupancyMax,
          isRequired: unit.isRequired,
          isHidden: unit.isHidden,
          sortOrder: unit.sortOrder,
        })
        unitIdMap[unit.id] = duplicatedUnit.id
      }

      return { option: duplicatedOption, unitIdMap }
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productOptions() })
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.optionUnits() })
      queryClient.setQueryData(productsQueryKeys.productOption(data.option.id), data.option)
    },
  })
}

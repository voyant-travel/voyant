"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import type { UsePriceCatalogsOptions } from "../hooks/use-price-catalogs.js"
import type { UsePricingCategoriesOptions } from "../hooks/use-pricing-categories.js"
import type { UsePricingCategoryDependenciesOptions } from "../hooks/use-pricing-category-dependencies.js"
import { pricingQueryKeys } from "../query-keys.js"
import {
  priceCatalogListResponse,
  priceCatalogSingleResponse,
  pricingCategoryDependencyListResponse,
  pricingCategoryListResponse,
  pricingCategorySingleResponse,
} from "../schemas.js"

export function getPricingCategoryQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: pricingQueryKeys.pricingCategory(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/pricing-categories/${id}`,
        pricingCategorySingleResponse,
        client,
      )
      return data
    },
  })
}

export function getPricingCategoriesQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePricingCategoriesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.pricingCategoriesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.unitId) params.set("unitId", filters.unitId)
      if (filters.categoryType) params.set("categoryType", filters.categoryType)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/pricing-categories${qs ? `?${qs}` : ""}`,
        pricingCategoryListResponse,
        client,
      )
    },
  })
}

export function getPricingCategoryDependenciesQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePricingCategoryDependenciesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.pricingCategoryDependenciesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.pricingCategoryId) params.set("pricingCategoryId", filters.pricingCategoryId)
      if (filters.masterPricingCategoryId) {
        params.set("masterPricingCategoryId", filters.masterPricingCategoryId)
      }
      if (filters.dependencyType) params.set("dependencyType", filters.dependencyType)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/pricing-category-dependencies${qs ? `?${qs}` : ""}`,
        pricingCategoryDependencyListResponse,
        client,
      )
    },
  })
}

export function getPriceCatalogsQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePriceCatalogsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.priceCatalogsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/price-catalogs${qs ? `?${qs}` : ""}`,
        priceCatalogListResponse,
        client,
      )
    },
  })
}

export function getPriceCatalogQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: [...pricingQueryKeys.priceCatalogs(), "detail", id] as const,
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/price-catalogs/${id}`,
        priceCatalogSingleResponse,
        client,
      )
      return data
    },
  })
}

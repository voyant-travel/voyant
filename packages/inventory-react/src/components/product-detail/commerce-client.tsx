"use client"

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"

import { type ProductDetailApi, useOptionalProductDetailHost, useProductDetailApi } from "./host.js"

export interface PaginatedEnvelope<T> {
  data: T[]
  total?: number
  limit?: number
  offset?: number
}

export interface SingleEnvelope<T> {
  data: T
}

export type PricingCategoryRecord = {
  id: string
  productId: string | null
  optionId: string | null
  unitId: string | null
  code: string | null
  name: string
  categoryType:
    | "adult"
    | "child"
    | "infant"
    | "senior"
    | "group"
    | "room"
    | "vehicle"
    | "service"
    | "other"
  seatOccupancy: number
  groupSize: number | null
  isAgeQualified: boolean
  minAge: number | null
  maxAge: number | null
  internalUseOnly: boolean
  active: boolean
  sortOrder: number
  metadata?: Record<string, unknown> | null
  createdAt?: string
  updatedAt?: string
}

export type PriceCatalogRecord = {
  id: string
  code: string
  name: string
  currencyCode: string | null
  catalogType: string
  isDefault: boolean
  active: boolean
  notes: string | null
}

export type PriceScheduleRecord = {
  id: string
  priceCatalogId: string
  code: string | null
  name: string
  active: boolean
}

export type CancellationPolicyRecord = {
  id: string
  name: string
  code: string | null
  active: boolean
}

export type OptionPriceRuleRecord = {
  id: string
  productId: string
  optionId: string
  priceCatalogId: string
  priceScheduleId: string | null
  cancellationPolicyId: string | null
  code: string | null
  name: string
  description: string | null
  pricingMode: "per_person" | "per_booking" | "starting_from" | "free" | "on_request"
  baseSellAmountCents: number | null
  baseCostAmountCents: number | null
  minPerBooking: number | null
  maxPerBooking: number | null
  allPricingCategories: boolean
  isDefault: boolean
  active: boolean
  notes: string | null
}

export type OptionUnitPriceRuleRecord = {
  id: string
  optionPriceRuleId: string
  optionId: string
  unitId: string
  pricingCategoryId: string | null
  pricingMode: "per_unit" | "per_person" | "per_booking" | "included" | "free" | "on_request"
  sellAmountCents: number | null
  costAmountCents: number | null
  minQuantity: number | null
  maxQuantity: number | null
  sortOrder: number
  active: boolean
  notes: string | null
}

export type ExtraPriceRuleRecord = {
  id: string
  optionPriceRuleId: string
  optionId: string
  productExtraId: string | null
  optionExtraConfigId: string | null
  pricingMode: "included" | "per_person" | "per_booking" | "on_request" | "unavailable"
  sellAmountCents: number | null
  costAmountCents: number | null
  active: boolean
  sortOrder: number
  notes: string | null
  metadata?: Record<string, unknown> | null
}

export type DeparturePriceOverrideRecord = {
  id: string
  departureId: string
  optionId: string
  optionUnitId: string
  priceCatalogId: string
  sellAmountCents: number
  costAmountCents: number | null
  notes: string | null
  active: boolean
  metadata?: Record<string, unknown> | null
}

export type MarketRecord = {
  id: string
  name: string
  defaultLanguageTag: string
  status?: string
}

export type MarketProductRuleRecord = {
  id: string
  marketId: string
  productId: string
  optionId: string | null
  priceCatalogId: string | null
  visibility: "public" | "private" | "hidden"
  sellability: "sellable" | "on_request" | "unavailable"
  channelScope: string
  active: boolean
  availableFrom: string | null
  availableTo: string | null
  notes: string | null
}

export type ProductResourceTemplateRecord = {
  optionId: string
  templates: Array<{
    kind: string
    refType: string | null
    refId: string | null
    capacity: number
    defaultCount: number | null
    namePattern: string
    flags: Record<string, unknown>
  }>
}

const commerceQueryKeys = {
  pricing: ["inventory-product-detail", "commerce", "pricing"] as const,
  markets: ["inventory-product-detail", "commerce", "markets"] as const,
  operations: ["inventory-product-detail", "operations"] as const,
}

function toQueryString(filters: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

async function list<T>(
  api: ProductDetailApi,
  path: string,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return api.get<PaginatedEnvelope<T>>(`${path}${toQueryString(filters)}`)
}

async function createRecord<T>(api: ProductDetailApi, path: string, input: unknown) {
  const response = await api.post<SingleEnvelope<T>>(path, input)
  return response.data
}

async function updateRecord<T>(api: ProductDetailApi, path: string, id: string, input: unknown) {
  const response = await api.patch<SingleEnvelope<T>>(`${path}/${id}`, input)
  return response.data
}

async function deleteRecord(api: ProductDetailApi, path: string, id: string) {
  return api.delete(`${path}/${id}`)
}

export function getOptionPriceRulesQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.pricing, "option-price-rules", filters] as const,
    queryFn: () => list<OptionPriceRuleRecord>(api, "/v1/pricing/option-price-rules", filters),
  })
}

export function getOptionUnitPriceRulesQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.pricing, "option-unit-price-rules", filters] as const,
    queryFn: () =>
      list<OptionUnitPriceRuleRecord>(api, "/v1/pricing/option-unit-price-rules", filters),
  })
}

export function getPricingCategoriesQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.pricing, "pricing-categories", filters] as const,
    queryFn: () => list<PricingCategoryRecord>(api, "/v1/pricing/pricing-categories", filters),
  })
}

export function getPriceCatalogsQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.pricing, "price-catalogs", filters] as const,
    queryFn: () => list<PriceCatalogRecord>(api, "/v1/pricing/price-catalogs", filters),
  })
}

export function getPriceSchedulesQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.pricing, "price-schedules", filters] as const,
    queryFn: () => list<PriceScheduleRecord>(api, "/v1/pricing/price-schedules", filters),
  })
}

export function getCancellationPoliciesQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.pricing, "cancellation-policies", filters] as const,
    queryFn: () =>
      list<CancellationPolicyRecord>(api, "/v1/pricing/cancellation-policies", filters),
  })
}

export function getExtraPriceRulesQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.pricing, "extra-price-rules", filters] as const,
    queryFn: () => list<ExtraPriceRuleRecord>(api, "/v1/pricing/extra-price-rules", filters),
  })
}

export function getDeparturePriceOverridesQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.pricing, "departure-price-overrides", filters] as const,
    queryFn: () =>
      list<DeparturePriceOverrideRecord>(api, "/v1/pricing/departure-price-overrides", filters),
  })
}

export function getMarketsQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.markets, "markets", filters] as const,
    queryFn: () => list<MarketRecord>(api, "/v1/markets/markets", filters),
  })
}

export function getMarketProductRulesQueryOptions(
  api: ProductDetailApi,
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.markets, "product-rules", filters] as const,
    queryFn: () => list<MarketProductRuleRecord>(api, "/v1/markets/product-rules", filters),
  })
}

export function getProductResourceTemplatesQueryOptions(api: ProductDetailApi, productId: string) {
  return queryOptions({
    queryKey: [...commerceQueryKeys.operations, "resource-templates", productId] as const,
    queryFn: () =>
      api.get<PaginatedEnvelope<ProductResourceTemplateRecord>>(
        `/v1/admin/operations/availability/products/${productId}/allocation/resource-templates`,
      ),
  })
}

function useApiMutation<TRecord>(path: string, cacheKey: readonly unknown[]) {
  const api = useProductDetailApi()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: cacheKey })

  const create = useMutation({
    mutationFn: (input: unknown) => createRecord<TRecord>(api, path, input),
    onSuccess: () => void invalidate(),
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) =>
      updateRecord<TRecord>(api, path, id, input),
    onSuccess: () => void invalidate(),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteRecord(api, path, id),
    onSuccess: () => void invalidate(),
  })

  return { create, update, remove }
}

export function useOptionPriceRuleMutation() {
  return useApiMutation<OptionPriceRuleRecord>("/v1/pricing/option-price-rules", [
    ...commerceQueryKeys.pricing,
    "option-price-rules",
  ])
}

export function useOptionUnitPriceRuleMutation() {
  return useApiMutation<OptionUnitPriceRuleRecord>("/v1/pricing/option-unit-price-rules", [
    ...commerceQueryKeys.pricing,
    "option-unit-price-rules",
  ])
}

export function usePriceCatalogMutation() {
  return useApiMutation<PriceCatalogRecord>("/v1/pricing/price-catalogs", [
    ...commerceQueryKeys.pricing,
    "price-catalogs",
  ])
}

export function usePricingCategoryMutation() {
  return useApiMutation<PricingCategoryRecord>("/v1/pricing/pricing-categories", [
    ...commerceQueryKeys.pricing,
    "pricing-categories",
  ])
}

export function useExtraPriceRuleMutation() {
  return useApiMutation<ExtraPriceRuleRecord>("/v1/pricing/extra-price-rules", [
    ...commerceQueryKeys.pricing,
    "extra-price-rules",
  ])
}

export function useDeparturePriceOverrideMutation() {
  return useApiMutation<DeparturePriceOverrideRecord>("/v1/pricing/departure-price-overrides", [
    ...commerceQueryKeys.pricing,
    "departure-price-overrides",
  ])
}

export function useMarketProductRuleMutation() {
  return useApiMutation<MarketProductRuleRecord>("/v1/markets/product-rules", [
    ...commerceQueryKeys.markets,
    "product-rules",
  ])
}

export function useExtraPriceRules(
  filters: Record<string, string | number | boolean | null | undefined> = {},
) {
  const api = useProductDetailApi()
  return useQuery(getExtraPriceRulesQueryOptions(api, filters))
}

export function useMarkets(filters: Record<string, string | number | boolean | null | undefined>) {
  const api = useProductDetailApi()
  return useQuery(getMarketsQueryOptions(api, filters))
}

export function useMarketProductRules(
  filters: Record<string, string | number | boolean | null | undefined>,
) {
  const api = useProductDetailApi()
  return useQuery(getMarketProductRulesQueryOptions(api, filters))
}

export function useProductResourceTemplates(productId: string) {
  const api = useProductDetailApi()
  return useQuery({
    ...getProductResourceTemplatesQueryOptions(api, productId),
    enabled: Boolean(productId),
  })
}

export function useDuplicateOptionPricingMutation(api?: ProductDetailApi) {
  const host = useOptionalProductDetailHost()
  const resolvedApi = api ?? host?.api
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sourceOptionId,
      targetOptionId,
      productId,
      unitIdMap,
    }: {
      sourceOptionId: string
      targetOptionId: string
      productId: string
      unitIdMap: Record<string, string>
    }) => {
      if (!resolvedApi) return
      const sourceRules = await list<OptionPriceRuleRecord>(
        resolvedApi,
        "/v1/pricing/option-price-rules",
        { optionId: sourceOptionId, limit: 100 },
      )
      for (const rule of sourceRules.data) {
        const createdRule = await createRecord<OptionPriceRuleRecord>(
          resolvedApi,
          "/v1/pricing/option-price-rules",
          {
            productId,
            optionId: targetOptionId,
            priceCatalogId: rule.priceCatalogId,
            priceScheduleId: rule.priceScheduleId,
            cancellationPolicyId: rule.cancellationPolicyId,
            code: rule.code ? `${rule.code}-copy` : null,
            name: rule.name,
            description: rule.description,
            pricingMode: rule.pricingMode,
            baseSellAmountCents: rule.baseSellAmountCents,
            baseCostAmountCents: rule.baseCostAmountCents,
            minPerBooking: rule.minPerBooking,
            maxPerBooking: rule.maxPerBooking,
            allPricingCategories: rule.allPricingCategories,
            isDefault: rule.isDefault,
            active: rule.active,
            notes: rule.notes,
          },
        )
        const unitRules = await list<OptionUnitPriceRuleRecord>(
          resolvedApi,
          "/v1/pricing/option-unit-price-rules",
          { optionPriceRuleId: rule.id, limit: 100 },
        )
        for (const unitRule of unitRules.data) {
          const targetUnitId = unitIdMap[unitRule.unitId]
          if (!targetUnitId) continue
          await createRecord<OptionUnitPriceRuleRecord>(
            resolvedApi,
            "/v1/pricing/option-unit-price-rules",
            {
              optionPriceRuleId: createdRule.id,
              optionId: targetOptionId,
              unitId: targetUnitId,
              pricingCategoryId: unitRule.pricingCategoryId,
              pricingMode: unitRule.pricingMode,
              sellAmountCents: unitRule.sellAmountCents,
              costAmountCents: unitRule.costAmountCents,
              minQuantity: unitRule.minQuantity,
              maxQuantity: unitRule.maxQuantity,
              sortOrder: unitRule.sortOrder,
              active: unitRule.active,
              notes: unitRule.notes,
            },
          )
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commerceQueryKeys.pricing })
    },
  })
}

interface IdSelectProps {
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
}

function SelectById<T extends { id: string; name: string; code?: string | null }>({
  value,
  onChange,
  placeholder,
  disabled,
  items,
}: IdSelectProps & { items: T[] }) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(next) => onChange(next || null)}
      disabled={disabled}
      items={items.map((item) => ({
        value: item.id,
        label: item.code ? `${item.name} (${item.code})` : item.name,
      }))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.code ? `${item.name} (${item.code})` : item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function PriceCatalogCombobox(props: IdSelectProps) {
  const api = useProductDetailApi()
  const query = useQuery(getPriceCatalogsQueryOptions(api, { limit: 100 }))
  return <SelectById {...props} items={query.data?.data ?? []} />
}

export function PriceScheduleCombobox({
  priceCatalogId,
  ...props
}: IdSelectProps & { priceCatalogId?: string | null }) {
  const api = useProductDetailApi()
  const query = useQuery(
    getPriceSchedulesQueryOptions(api, { priceCatalogId: priceCatalogId || undefined, limit: 100 }),
  )
  return (
    <SelectById
      {...props}
      disabled={props.disabled || !priceCatalogId}
      items={query.data?.data ?? []}
    />
  )
}

export function CancellationPolicyCombobox(props: IdSelectProps) {
  const api = useProductDetailApi()
  const query = useQuery(getCancellationPoliciesQueryOptions(api, { limit: 100 }))
  return <SelectById {...props} items={query.data?.data ?? []} />
}

export function PricingCategoryCombobox(props: IdSelectProps) {
  const api = useProductDetailApi()
  const query = useQuery(getPricingCategoriesQueryOptions(api, { active: true, limit: 100 }))
  return <SelectById {...props} items={query.data?.data ?? []} />
}

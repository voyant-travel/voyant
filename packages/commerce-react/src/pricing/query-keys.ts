export interface PricingCategoriesListFilters {
  productId?: string | undefined
  optionId?: string | undefined
  unitId?: string | undefined
  categoryType?: string | undefined
  active?: boolean | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PricingCategoryDependenciesListFilters {
  pricingCategoryId?: string | undefined
  masterPricingCategoryId?: string | undefined
  dependencyType?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PriceCatalogsListFilters {
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface CancellationPoliciesListFilters {
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface CancellationPolicyRulesListFilters {
  cancellationPolicyId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PriceSchedulesListFilters {
  priceCatalogId?: string | undefined
  active?: boolean | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface OptionPriceRulesListFilters {
  productId?: string | undefined
  optionId?: string | undefined
  priceCatalogId?: string | undefined
  priceScheduleId?: string | undefined
  cancellationPolicyId?: string | undefined
  pricingMode?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface OptionUnitPriceRulesListFilters {
  optionPriceRuleId?: string | undefined
  optionId?: string | undefined
  unitId?: string | undefined
  pricingCategoryId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface OptionUnitTiersListFilters {
  optionUnitPriceRuleId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PickupPriceRulesListFilters {
  optionPriceRuleId?: string | undefined
  optionId?: string | undefined
  pickupPointId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface DropoffPriceRulesListFilters {
  optionPriceRuleId?: string | undefined
  optionId?: string | undefined
  facilityId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface ExtraPriceRulesListFilters {
  optionPriceRuleId?: string | undefined
  optionId?: string | undefined
  productExtraId?: string | undefined
  optionExtraConfigId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface DeparturePriceOverridesListFilters {
  departureId?: string | undefined
  optionId?: string | undefined
  optionUnitId?: string | undefined
  priceCatalogId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface OptionStartTimeRulesListFilters {
  optionPriceRuleId?: string | undefined
  optionId?: string | undefined
  startTimeId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const pricingQueryKeys = {
  all: ["voyant", "pricing"] as const,

  pricingCategories: () => [...pricingQueryKeys.all, "pricing-categories"] as const,
  pricingCategoriesList: (filters: PricingCategoriesListFilters) =>
    [...pricingQueryKeys.pricingCategories(), "list", filters] as const,
  pricingCategory: (id: string) => [...pricingQueryKeys.pricingCategories(), "detail", id] as const,

  pricingCategoryDependencies: () =>
    [...pricingQueryKeys.all, "pricing-category-dependencies"] as const,
  pricingCategoryDependenciesList: (filters: PricingCategoryDependenciesListFilters) =>
    [...pricingQueryKeys.pricingCategoryDependencies(), "list", filters] as const,
  pricingCategoryDependency: (id: string) =>
    [...pricingQueryKeys.pricingCategoryDependencies(), "detail", id] as const,

  priceCatalogs: () => [...pricingQueryKeys.all, "price-catalogs"] as const,
  priceCatalogsList: (filters: PriceCatalogsListFilters) =>
    [...pricingQueryKeys.priceCatalogs(), "list", filters] as const,
  priceCatalog: (id: string) => [...pricingQueryKeys.priceCatalogs(), "detail", id] as const,

  priceSchedules: () => [...pricingQueryKeys.all, "price-schedules"] as const,
  priceSchedulesList: (filters: PriceSchedulesListFilters) =>
    [...pricingQueryKeys.priceSchedules(), "list", filters] as const,
  priceSchedule: (id: string) => [...pricingQueryKeys.priceSchedules(), "detail", id] as const,

  optionPriceRules: () => [...pricingQueryKeys.all, "option-price-rules"] as const,
  optionPriceRulesList: (filters: OptionPriceRulesListFilters) =>
    [...pricingQueryKeys.optionPriceRules(), "list", filters] as const,
  optionPriceRule: (id: string) => [...pricingQueryKeys.optionPriceRules(), "detail", id] as const,

  optionUnitPriceRules: () => [...pricingQueryKeys.all, "option-unit-price-rules"] as const,
  optionUnitPriceRulesList: (filters: OptionUnitPriceRulesListFilters) =>
    [...pricingQueryKeys.optionUnitPriceRules(), "list", filters] as const,
  optionUnitPriceRule: (id: string) =>
    [...pricingQueryKeys.optionUnitPriceRules(), "detail", id] as const,

  optionUnitTiers: () => [...pricingQueryKeys.all, "option-unit-tiers"] as const,
  optionUnitTiersList: (filters: OptionUnitTiersListFilters) =>
    [...pricingQueryKeys.optionUnitTiers(), "list", filters] as const,
  optionUnitTier: (id: string) => [...pricingQueryKeys.optionUnitTiers(), "detail", id] as const,

  pickupPriceRules: () => [...pricingQueryKeys.all, "pickup-price-rules"] as const,
  pickupPriceRulesList: (filters: PickupPriceRulesListFilters) =>
    [...pricingQueryKeys.pickupPriceRules(), "list", filters] as const,
  pickupPriceRule: (id: string) => [...pricingQueryKeys.pickupPriceRules(), "detail", id] as const,

  dropoffPriceRules: () => [...pricingQueryKeys.all, "dropoff-price-rules"] as const,
  dropoffPriceRulesList: (filters: DropoffPriceRulesListFilters) =>
    [...pricingQueryKeys.dropoffPriceRules(), "list", filters] as const,
  dropoffPriceRule: (id: string) =>
    [...pricingQueryKeys.dropoffPriceRules(), "detail", id] as const,

  extraPriceRules: () => [...pricingQueryKeys.all, "extra-price-rules"] as const,
  extraPriceRulesList: (filters: ExtraPriceRulesListFilters) =>
    [...pricingQueryKeys.extraPriceRules(), "list", filters] as const,
  extraPriceRule: (id: string) => [...pricingQueryKeys.extraPriceRules(), "detail", id] as const,

  departurePriceOverrides: () => [...pricingQueryKeys.all, "departure-price-overrides"] as const,
  departurePriceOverridesList: (filters: DeparturePriceOverridesListFilters) =>
    [...pricingQueryKeys.departurePriceOverrides(), "list", filters] as const,
  departurePriceOverride: (id: string) =>
    [...pricingQueryKeys.departurePriceOverrides(), "detail", id] as const,

  optionStartTimeRules: () => [...pricingQueryKeys.all, "option-start-time-rules"] as const,
  optionStartTimeRulesList: (filters: OptionStartTimeRulesListFilters) =>
    [...pricingQueryKeys.optionStartTimeRules(), "list", filters] as const,
  optionStartTimeRule: (id: string) =>
    [...pricingQueryKeys.optionStartTimeRules(), "detail", id] as const,

  cancellationPolicies: () => [...pricingQueryKeys.all, "cancellation-policies"] as const,
  cancellationPoliciesList: (filters: CancellationPoliciesListFilters) =>
    [...pricingQueryKeys.cancellationPolicies(), "list", filters] as const,
  cancellationPolicy: (id: string) =>
    [...pricingQueryKeys.cancellationPolicies(), "detail", id] as const,

  cancellationPolicyRules: () => [...pricingQueryKeys.all, "cancellation-policy-rules"] as const,
  cancellationPolicyRulesList: (filters: CancellationPolicyRulesListFilters) =>
    [...pricingQueryKeys.cancellationPolicyRules(), "list", filters] as const,
  cancellationPolicyRule: (id: string) =>
    [...pricingQueryKeys.cancellationPolicyRules(), "detail", id] as const,
} as const

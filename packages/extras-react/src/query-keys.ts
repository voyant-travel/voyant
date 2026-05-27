export interface ProductExtrasListFilters {
  productId?: string | undefined
  active?: boolean | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const extrasQueryKeys = {
  all: ["voyant", "extras"] as const,

  productExtras: () => [...extrasQueryKeys.all, "product-extras"] as const,
  productExtrasList: (filters: ProductExtrasListFilters) =>
    [...extrasQueryKeys.productExtras(), "list", filters] as const,
  productExtra: (id: string) => [...extrasQueryKeys.productExtras(), "detail", id] as const,
  slotManifests: () => [...extrasQueryKeys.all, "slot-manifests"] as const,
  slotManifest: (slotId: string) => [...extrasQueryKeys.slotManifests(), slotId] as const,
} as const

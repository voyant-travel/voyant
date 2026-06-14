export interface ProductsListFilters {
  status?: "draft" | "awaiting_review" | "live" | "archived" | undefined
  lineSupplierId?: string | undefined
  region?: string | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface VoyagesListFilters {
  productId?: string | undefined
  yachtId?: string | undefined
  dateFrom?: string | undefined
  dateTo?: string | undefined
  salesStatus?: "open" | "on_request" | "wait_list" | "sold_out" | "closed" | undefined
  bookingMode?: "per_suite" | "whole_yacht" | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface YachtsListFilters {
  lineSupplierId?: string | undefined
  yachtClass?: "luxury_motor" | "luxury_sailing" | "expedition" | "small_cruise" | undefined
  isActive?: boolean | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PublicProductsListFilters {
  region?: string | undefined
  theme?: string | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

/**
 * Hierarchical TanStack query keys for the charters module. Following the
 * convention from cruises-react / relationships-react: all keys are tuples rooted at
 * `["voyant", "charters", ...]` so a single invalidation can wipe everything
 * charters-related, and finer-grained invalidations target specific resources.
 *
 * `key` parameters accept both local TypeIDs (`chrt_*`, `chrv_*`, `chry_*`)
 * and external `<provider>:<ref>` keys — the server dispatches on its end.
 */
export const chartersQueryKeys = {
  all: ["voyant", "charters"] as const,

  // Products
  products: () => [...chartersQueryKeys.all, "products"] as const,
  productsList: (filters: ProductsListFilters) =>
    [...chartersQueryKeys.products(), "list", filters] as const,
  product: (key: string, include?: ReadonlyArray<"voyages" | "yacht">) =>
    [...chartersQueryKeys.products(), "detail", key, include ?? []] as const,
  productVoyages: (key: string) => [...chartersQueryKeys.product(key), "voyages"] as const,

  // Voyages
  voyages: () => [...chartersQueryKeys.all, "voyages"] as const,
  voyagesList: (filters: VoyagesListFilters) =>
    [...chartersQueryKeys.voyages(), "list", filters] as const,
  voyage: (key: string, include?: ReadonlyArray<"suites" | "schedule">) =>
    [...chartersQueryKeys.voyages(), "detail", key, include ?? []] as const,

  // Yachts
  yachts: () => [...chartersQueryKeys.all, "yachts"] as const,
  yachtsList: (filters: YachtsListFilters) =>
    [...chartersQueryKeys.yachts(), "list", filters] as const,
  yacht: (key: string) => [...chartersQueryKeys.yachts(), "detail", key] as const,

  // Public surface (anonymous browse + quote)
  public: () => [...chartersQueryKeys.all, "public"] as const,
  publicProductsList: (filters: PublicProductsListFilters) =>
    [...chartersQueryKeys.public(), "products", "list", filters] as const,
  publicProduct: (key: string) =>
    [...chartersQueryKeys.public(), "products", "detail", key] as const,
  publicVoyage: (key: string) => [...chartersQueryKeys.public(), "voyages", "detail", key] as const,
  publicYacht: (key: string) => [...chartersQueryKeys.public(), "yachts", "detail", key] as const,
} as const

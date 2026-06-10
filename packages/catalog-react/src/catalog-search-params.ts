import { z } from "zod"

/**
 * Catalog browse search state — the URL/query shape shared by every catalog
 * surface (grid/list + sort + facet/range filters). Lives in the data layer
 * (no router imports) so route files and templates parse/validate the same
 * contract; the operator binds it to TanStack Router's `validateSearch`.
 */

export const catalogViewModes = ["grid", "list"] as const
export type CatalogViewMode = (typeof catalogViewModes)[number]

export const catalogSortOptions = [
  "relevance",
  "price-asc",
  "price-desc",
  "departure-asc",
  "newest",
] as const
export type CatalogSortOption = (typeof catalogSortOptions)[number]

export const catalogFiltersSchema = z.object({
  facets: z.record(z.string(), z.array(z.union([z.string(), z.number()]))).optional(),
  ranges: z
    .record(z.string(), z.object({ gte: z.number().optional(), lte: z.number().optional() }))
    .optional(),
})
export type CatalogFilterSelections = z.infer<typeof catalogFiltersSchema>

export const catalogSearchSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  market: z.string().optional(),
  locale: z.string().optional(),
  view: z.enum(catalogViewModes).optional(),
  sort: z.enum(catalogSortOptions).optional(),
  filters: catalogFiltersSchema.optional(),
})

export type CatalogSearchParams = z.infer<typeof catalogSearchSchema>

import { z } from "zod"

export const catalogViewModes = ["grid", "list"] as const
export const catalogSortOptions = [
  "relevance",
  "price-asc",
  "price-desc",
  "departure-asc",
  "newest",
] as const

const catalogFiltersSchema = z.object({
  facets: z.record(z.string(), z.array(z.union([z.string(), z.number()]))).optional(),
  ranges: z
    .record(z.string(), z.object({ gte: z.number().optional(), lte: z.number().optional() }))
    .optional(),
})

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

// Catalog "surfaces" that have a dedicated, new-tab detail page. Excursions and
// tours are scheduled PRODUCTS (own surface for browse), but their detail data
// comes from the products content route — see `catalogSurfaceVertical`.
export const catalogDetailSurfaces = [
  "products",
  "cruises",
  "accommodations",
  "excursions",
  "tours",
] as const
export type CatalogDetailSurface = (typeof catalogDetailSurfaces)[number]

/** Catalog/content vertical backing a surface (excursions/tours → products). */
export function catalogSurfaceVertical(
  surface: CatalogDetailSurface,
): "products" | "cruises" | "accommodations" {
  if (surface === "cruises") return "cruises"
  if (surface === "accommodations") return "accommodations"
  return "products"
}

/** URL of a surface's dedicated detail page (opened in a new tab). */
export function catalogDetailHref(surface: CatalogDetailSurface, id: string): string {
  return `/catalog/${surface}/${encodeURIComponent(id)}`
}

/** Open a surface's detail page in a new tab (keeps the search/list in place). */
export function openCatalogDetail(surface: CatalogDetailSurface, id: string): void {
  if (typeof window !== "undefined") {
    window.open(catalogDetailHref(surface, id), "_blank", "noopener,noreferrer")
  }
}

export const catalogVerticalPageIds = ["products", "cruises", "accommodations"] as const

export type CatalogVerticalPageId = (typeof catalogVerticalPageIds)[number]

export function catalogVerticalPath(vertical: string) {
  switch (vertical) {
    case "cruises":
      return "/catalog/cruises" as const
    case "accommodations":
      return "/catalog/accommodations" as const
    default:
      return "/catalog/products" as const
  }
}

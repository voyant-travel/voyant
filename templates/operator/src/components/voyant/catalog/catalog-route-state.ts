// Catalog surface taxonomy (which surfaces have a dedicated detail page, and
// the content vertical backing each) now lives in catalog-ui; the search-state
// contract lives in catalog-react. Imported for local use + re-exported for the
// operator's existing import paths.
import {
  type CatalogDetailSurface,
  catalogDetailSurfaces,
  catalogSurfaceVertical,
} from "@voyantjs/catalog-ui"

export {
  type CatalogFilterSelections,
  type CatalogSearchParams,
  type CatalogSortOption,
  type CatalogViewMode,
  catalogSearchSchema,
  catalogSortOptions,
  catalogViewModes,
} from "@voyantjs/catalog-react"
export { type CatalogDetailSurface, catalogDetailSurfaces, catalogSurfaceVertical }

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

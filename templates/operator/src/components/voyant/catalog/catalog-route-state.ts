// Catalog surface taxonomy (which surfaces have a dedicated detail page, the
// content vertical backing each, and the browse-grid vertical ids) lives in
// catalog-ui; the search-state contract lives in catalog-react. The catalog
// PAGES are package-delivered too (`@voyantjs/catalog-react/admin` hosts) —
// what's left here is the operator's own route-tree knowledge: detail hrefs
// for new-tab openers and the journey's return path.
import {
  type CatalogDetailSurface,
  type CatalogVerticalPageId,
  catalogDetailSurfaces,
  catalogSurfaceVertical,
  catalogVerticalPageIds,
} from "@voyantjs/catalog-react/ui"

export {
  type CatalogFilterSelections,
  type CatalogSearchParams,
  type CatalogSortOption,
  type CatalogViewMode,
  catalogSearchSchema,
  catalogSortOptions,
  catalogViewModes,
} from "@voyantjs/catalog-react"
export {
  type CatalogDetailSurface,
  type CatalogVerticalPageId,
  catalogDetailSurfaces,
  catalogSurfaceVertical,
  catalogVerticalPageIds,
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

/**
 * Catalog "surfaces" that have a dedicated, full-page detail view. Excursions
 * and tours are scheduled PRODUCTS (their own browse surface), but their detail
 * content comes from the products content route — see `catalogSurfaceVertical`.
 */
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

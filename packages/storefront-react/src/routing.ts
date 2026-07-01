/**
 * Verticals that have a working customer detail + booking page in the
 * storefront. Search and the customer detail route derive their accepted
 * verticals from this list, so a vertical only surfaces once it can render a
 * detail page and take a booking (voyant#2640).
 *
 * Cruises are intentionally excluded (voyant#2639): the public cruise content
 * endpoint (`GET /v1/public/cruises/:id/content`) serves SOURCED cruises only
 * — it reads a catalog sourced-entry row and has no owned-cruise content
 * projector (unlike products' `buildOwnedProductContent`). The operator seeds
 * OWNED cruises (`source.kind = "owned"`, `cru_*` ids) and indexes them into
 * customer search, so surfacing cruises produced result cards linking to a
 * detail page that 404s (owned ids) or 400s (non-sourced demo ids). Re-add
 * `"cruises"` once owned cruises can render public content end-to-end.
 */
export const storefrontCustomerBookableProductVerticals = ["products", "accommodations"] as const

export type StorefrontCustomerBookableProductVertical =
  (typeof storefrontCustomerBookableProductVerticals)[number]

export function isStorefrontCustomerBookableProductVertical(
  vertical: string,
): vertical is StorefrontCustomerBookableProductVertical {
  return storefrontCustomerBookableProductVerticals.includes(
    vertical as StorefrontCustomerBookableProductVertical,
  )
}

export function getStorefrontCustomerProductDetailRoute(
  entityModule: string,
  entityId: string,
): {
  to: "/shop/products/$entityModule/$entityId"
  params: { entityModule: StorefrontCustomerBookableProductVertical; entityId: string }
} | null {
  if (!isStorefrontCustomerBookableProductVertical(entityModule)) {
    return null
  }

  return {
    to: "/shop/products/$entityModule/$entityId",
    params: { entityModule, entityId },
  }
}

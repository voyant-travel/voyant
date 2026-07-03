/**
 * Verticals that have a working customer detail + booking page in the
 * storefront. Search and the customer detail route derive their accepted
 * verticals from this list, so a vertical only surfaces once it can render a
 * detail page and take a booking (voyant#2640).
 */
export const storefrontCustomerBookableProductVerticals = [
  "products",
  "accommodations",
  "cruises",
] as const

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
  if (entityModule === "cruises" && !isOwnedCruiseId(entityId)) {
    return null
  }

  return {
    to: "/shop/products/$entityModule/$entityId",
    params: { entityModule, entityId },
  }
}

function isOwnedCruiseId(entityId: string): boolean {
  return entityId.startsWith("cru_")
}

export const storefrontCustomerBookableProductVerticals = [
  "products",
  "cruises",
  "accommodations",
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

  return {
    to: "/shop/products/$entityModule/$entityId",
    params: { entityModule, entityId },
  }
}

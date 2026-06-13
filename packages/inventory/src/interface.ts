import type { LinkableDefinition, Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"
import { productLinkable, productsBookingExtension, productsHonoModule } from "@voyantjs/products"
import { publicProductRoutes } from "@voyantjs/products/public-routes"
import { productRoutes } from "@voyantjs/products/routes"

export const inventoryProductLinkable: LinkableDefinition = {
  module: "inventory",
  entity: "product",
  table: "products",
  idPrefix: "prod",
}

export const inventoryModule: Module = {
  name: "inventory",
  linkable: {
    product: inventoryProductLinkable,
  },
}

/**
 * Compatibility Hono module for the first Inventory slice.
 *
 * Routes intentionally keep the existing `products` mount name so deployed
 * `/v1/admin/products` and `/v1/public/products` clients do not break while
 * Inventory becomes the operated authoring package target.
 */
export const inventoryHonoModule: HonoModule = productsHonoModule

export const inventoryProductRoutes = productRoutes
export const publicInventoryProductRoutes = publicProductRoutes
export const inventoryBookingExtension = productsBookingExtension
export const inventoryProductCompatibilityLinkable = productLinkable

export type InventoryAuthoringSurface =
  | "product-structure"
  | "product-version"
  | "product-internal-component"
  | "owned-publication-lifecycle"
  | "operated-extras-configuration"

export interface InventoryInterfaceDescriptor {
  module: "inventory"
  operatedEntityModule: "products"
  compatibilityPackages: readonly ["@voyantjs/products", "@voyantjs/products-react"]
  authoringSurfaces: readonly InventoryAuthoringSurface[]
  catalogResponsibilities: readonly [
    "projection",
    "search",
    "overlay",
    "snapshot",
    "source-governance",
  ]
}

export const inventoryInterfaceDescriptor: InventoryInterfaceDescriptor = {
  module: "inventory",
  operatedEntityModule: "products",
  compatibilityPackages: ["@voyantjs/products", "@voyantjs/products-react"],
  authoringSurfaces: [
    "product-structure",
    "product-version",
    "product-internal-component",
    "owned-publication-lifecycle",
    "operated-extras-configuration",
  ],
  catalogResponsibilities: ["projection", "search", "overlay", "snapshot", "source-governance"],
}

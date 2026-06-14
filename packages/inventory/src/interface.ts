import type { LinkableDefinition, Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { productsBookingExtension } from "./booking-extension.js"
import { productRoutes } from "./routes.js"
import { publicProductRoutes } from "./routes-public.js"

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

export const inventoryProductCompatibilityLinkable: LinkableDefinition = {
  module: "products",
  entity: "product",
  table: "products",
  idPrefix: "prod",
}

const productsCompatibilityModule: Module = {
  name: "products",
  linkable: {
    product: inventoryProductCompatibilityLinkable,
  },
}

/**
 * Compatibility Hono module for the Inventory-owned Product runtime.
 *
 * Routes intentionally keep the existing `products` mount name so deployed
 * `/v1/admin/products` and `/v1/public/products` clients do not break.
 */
export const inventoryHonoModule: HonoModule = {
  module: productsCompatibilityModule,
  adminRoutes: productRoutes,
  publicRoutes: publicProductRoutes,
  routes: productRoutes,
}

export const inventoryProductRoutes = productRoutes
export const publicInventoryProductRoutes = publicProductRoutes
export const inventoryBookingExtension = productsBookingExtension

export type InventoryAuthoringSurface =
  | "product-structure"
  | "product-version"
  | "product-internal-component"
  | "owned-publication-lifecycle"
  | "operated-extras-configuration"

export interface InventoryInterfaceDescriptor {
  module: "inventory"
  operatedEntityModule: "products"
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
  authoringSurfaces: [
    "product-structure",
    "product-version",
    "product-internal-component",
    "owned-publication-lifecycle",
    "operated-extras-configuration",
  ],
  catalogResponsibilities: ["projection", "search", "overlay", "snapshot", "source-governance"],
}

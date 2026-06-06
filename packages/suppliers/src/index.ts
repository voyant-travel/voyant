import type { LinkableDefinition, Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { supplierRoutes } from "./routes.js"
import { suppliersService } from "./service.js"

export type { SupplierRoutes } from "./routes.js"

export const supplierLinkable: LinkableDefinition = {
  module: "suppliers",
  entity: "supplier",
  table: "suppliers",
  idPrefix: "supp",
}

export const suppliersLinkable = {
  supplier: supplierLinkable,
}

export const suppliersModule: Module = {
  name: "suppliers",
  linkable: suppliersLinkable,
}

export const suppliersHonoModule: HonoModule = {
  module: suppliersModule,
  adminRoutes: supplierRoutes,
  routes: supplierRoutes,
}

export type {
  NewSupplier,
  NewSupplierAvailabilityEntry,
  NewSupplierContract,
  NewSupplierDirectoryProjection,
  NewSupplierNote,
  NewSupplierRate,
  NewSupplierService,
  Supplier,
  SupplierAvailabilityEntry,
  SupplierContract,
  SupplierDirectoryProjection,
  SupplierNote,
  SupplierRate,
  SupplierService,
} from "./schema.js"
export {
  supplierAvailability,
  supplierContracts,
  supplierDirectoryProjections,
  supplierNotes,
  supplierRates,
  supplierServices,
  suppliers,
} from "./schema.js"
export {
  availabilityQuerySchema,
  insertAvailabilitySchema,
  insertContractSchema,
  insertRateSchema,
  insertServiceSchema,
  insertSupplierNoteSchema,
  insertSupplierSchema,
  selectSupplierSchema,
  supplierListQuerySchema,
  updateContractSchema,
  updateRateSchema,
  updateServiceSchema,
  updateSupplierSchema,
} from "./validation.js"
export { suppliersService }

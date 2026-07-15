import type { Module } from "@voyant-travel/core"
import type { ApiModule } from "@voyant-travel/hono/module"

import { suppliersLinkable } from "./linkables.js"
import { suppliersAdminRoutes } from "./routes.js"
import { suppliersService } from "./service.js"

export { supplierLinkable, suppliersLinkable } from "./linkables.js"
export type { SupplierRoutes } from "./routes.js"

export const suppliersModule: Module = {
  name: "suppliers",
  linkable: suppliersLinkable,
}

export const suppliersApiModule: ApiModule = {
  module: suppliersModule,
  adminRoutes: suppliersAdminRoutes,
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
  supplierAggregatesQuerySchema,
  supplierListQuerySchema,
  updateContractSchema,
  updateRateSchema,
  updateServiceSchema,
  updateSupplierSchema,
} from "./validation.js"
export { suppliersService }

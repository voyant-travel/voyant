import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { identityRoutes } from "./routes.js"
import { identityService } from "./service.js"

export type { IdentityRoutes } from "./routes.js"

export const identityModule: Module = {
  name: "identity",
}

export const identityHonoModule: HonoModule = {
  module: identityModule,
  // Dual-mount (voyant#2114): the same `OpenAPIHono` instance is mounted on the
  // legacy `/v1/identity/*` surface (the dashboard still calls those paths) AND
  // the documented staff surface at `/v1/admin/identity/*` (picked up by the
  // admin OpenAPI spec).
  routes: identityRoutes,
  adminRoutes: identityRoutes,
}

export type {
  IdentityAddress,
  IdentityContactPoint,
  IdentityNamedContact,
  NewIdentityAddress,
  NewIdentityContactPoint,
  NewIdentityNamedContact,
} from "./schema.js"
export {
  addressLabelEnum,
  contactPointKindEnum,
  identityAddresses,
  identityContactPoints,
  identityNamedContacts,
  namedContactRoleEnum,
} from "./schema.js"
export {
  addressLabelSchema,
  addressListQuerySchema,
  contactPointKindSchema,
  contactPointListQuerySchema,
  insertAddressForEntitySchema,
  insertAddressSchema,
  insertContactPointForEntitySchema,
  insertContactPointSchema,
  insertNamedContactForEntitySchema,
  insertNamedContactSchema,
  namedContactListQuerySchema,
  namedContactRoleSchema,
  selectAddressSchema,
  selectContactPointSchema,
  selectNamedContactSchema,
  updateAddressSchema,
  updateContactPointSchema,
  updateNamedContactSchema,
} from "./validation.js"
export { identityService }

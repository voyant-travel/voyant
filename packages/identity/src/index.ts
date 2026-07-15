import type { Module } from "@voyant-travel/core"
import type { ApiModule } from "@voyant-travel/hono/module"

import { identityRoutes } from "./routes.js"
import { identityService } from "./service.js"

export type { IdentityRoutes } from "./routes.js"

export const identityModule: Module = {
  name: "identity",
}

export const identityApiModule: ApiModule = {
  module: identityModule,
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

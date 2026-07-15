import type { Module } from "@voyant-travel/core"
import type { ApiModule } from "@voyant-travel/hono/module"

import { externalRefsRoutes } from "./routes.js"
import { externalRefsService } from "./service.js"

export type { ExternalRefsRoutes } from "./routes.js"

export const externalRefsModule: Module = {
  name: "external-refs",
}

export const externalRefsApiModule: ApiModule = {
  module: externalRefsModule,
  adminRoutes: externalRefsRoutes,
}

export type { ExternalRef, NewExternalRef } from "./schema.js"
export { externalRefStatusEnum, externalRefs } from "./schema.js"
export {
  externalRefListQuerySchema,
  externalRefStatusSchema,
  insertExternalRefForEntitySchema,
  insertExternalRefSchema,
  selectExternalRefSchema,
  updateExternalRefSchema,
} from "./validation.js"
export { externalRefsService }

import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { externalRefsRoutes } from "./routes.js"
import { externalRefsService } from "./service.js"

export type { ExternalRefsRoutes } from "./routes.js"

export const externalRefsModule: Module = {
  name: "external-refs",
}

export const externalRefsHonoModule: HonoModule = {
  module: externalRefsModule,
  // Dual-mount (voyant#2114): same `OpenAPIHono` instance on the legacy
  // `/v1/external-refs/*` surface AND the documented `/v1/admin/external-refs/*`.
  routes: externalRefsRoutes,
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

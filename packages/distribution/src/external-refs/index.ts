import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { externalRefsRoutes } from "./routes.js"
import { externalRefsService } from "./service.js"

export type { ExternalRefsRoutes } from "./routes.js"

export const externalRefsModule: Module = {
  name: "external-refs",
}

export const externalRefsHonoModule: HonoModule = {
  module: externalRefsModule,
  routes: externalRefsRoutes,
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

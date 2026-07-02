import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { miceLinkable } from "./linkables.js"
import type { MiceRouteRuntimeOptions } from "./route-runtime.js"
import { createMiceAdminRoutes } from "./routes.js"

/**
 * The MICE spine is operator-local (niche) — registered in the deployment, NOT
 * the framework standard set. The allotment primitives it links to (room
 * blocks, function spaces) are standard and package-owned. See RFC voyant#1489.
 */
export {
  bidLinkable,
  delegateLinkable,
  miceLinkable,
  programLinkable,
  rfpLinkable,
  roomingAssignmentLinkable,
  sessionLinkable,
} from "./linkables.js"

export const miceModule: Module = {
  name: "mice",
  // Enrollment, rooming-delegate replace, and session-inclusion set run inside
  // db.transaction(...) — route /v1/admin/mice/* to the transactional DB.
  requiresTransactionalDb: true,
  linkable: miceLinkable,
}

export interface MiceHonoModuleOptions extends MiceRouteRuntimeOptions {}

export function createMiceHonoModule(options: MiceHonoModuleOptions = {}): HonoModule {
  return {
    module: miceModule,
    adminRoutes: createMiceAdminRoutes(options),
  }
}

export const miceHonoModule: HonoModule = createMiceHonoModule()

export const miceHonoModules = [miceHonoModule] as const

export type {
  MiceRouteRuntime,
  MiceRouteRuntimeOptions,
  ResolveMiceDelegatePersonById,
} from "./route-runtime.js"
export type { MiceAdminRoutes } from "./routes.js"
export { createMiceAdminRoutes, miceAdminRoutes } from "./routes.js"
export * from "./schema.js"
export * from "./service.js"
export * from "./service-commercials.js"
export * from "./service-delegates.js"
export * from "./service-rfp.js"
export * from "./service-rooming.js"
export * from "./service-sessions.js"
export * from "./validation.js"
export * from "./validation-delegates.js"
export * from "./validation-rfp.js"
export * from "./validation-rooming.js"
export * from "./validation-sessions.js"

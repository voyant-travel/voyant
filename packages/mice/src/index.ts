import type { Module } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { ApiModule } from "@voyant-travel/hono/module"

import { miceLinkable } from "./linkables.js"
import type { MiceRouteRuntimeOptions } from "./route-runtime.js"
import { createMiceAdminRoutes } from "./routes.js"
import { miceRuntimePort } from "./runtime-port.js"

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

export interface MiceApiModuleOptions extends MiceRouteRuntimeOptions {}

export function createMiceApiModule(options: MiceApiModuleOptions = {}): ApiModule {
  return {
    module: miceModule,
    adminRoutes: createMiceAdminRoutes(options),
  }
}

/** Package-owned adapter from graph runtime ports to the MICE route factory. */
export const createMiceVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) =>
  createMiceApiModule(await getPort(miceRuntimePort)),
)

export type { MiceRuntime } from "./runtime-port.js"
export { miceRuntimePort } from "./runtime-port.js"

export const miceApiModule: ApiModule = createMiceApiModule()

export const miceApiModules = [miceApiModule] as const

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

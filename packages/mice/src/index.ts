import type { LinkableDefinition, Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { miceAdminRoutes } from "./routes.js"

/**
 * The MICE spine is operator-local (niche) — registered in the deployment, NOT
 * the framework standard set. The allotment primitives it links to (room
 * blocks, function spaces) are standard and package-owned. See RFC voyant#1489.
 */
export const programLinkable: LinkableDefinition = {
  module: "mice",
  entity: "program",
  table: "mice_programs",
  idPrefix: "prog",
}

export const sessionLinkable: LinkableDefinition = {
  module: "mice",
  entity: "session",
  table: "mice_program_sessions",
  idPrefix: "mpss",
}

export const miceLinkable = {
  program: programLinkable,
  session: sessionLinkable,
}

export const miceModule: Module = {
  name: "mice",
  linkable: miceLinkable,
}

export const miceHonoModule: HonoModule = {
  module: miceModule,
  adminRoutes: miceAdminRoutes,
}

export const miceHonoModules = [miceHonoModule] as const

export type { MiceAdminRoutes } from "./routes.js"
export { miceAdminRoutes } from "./routes.js"
export * from "./schema.js"
export * from "./service.js"
export * from "./service-sessions.js"
export * from "./validation.js"
export * from "./validation-sessions.js"

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

export const delegateLinkable: LinkableDefinition = {
  module: "mice",
  entity: "delegate",
  table: "mice_program_delegates",
  idPrefix: "mpdl",
}

export const roomingAssignmentLinkable: LinkableDefinition = {
  module: "mice",
  entity: "roomingAssignment",
  table: "mice_rooming_assignments",
  idPrefix: "mrma",
}

export const miceLinkable = {
  program: programLinkable,
  session: sessionLinkable,
  delegate: delegateLinkable,
  roomingAssignment: roomingAssignmentLinkable,
}

export const miceModule: Module = {
  name: "mice",
  // Enrollment, rooming-delegate replace, and session-inclusion set run inside
  // db.transaction(...) — route /v1/admin/mice/* to the transactional DB.
  requiresTransactionalDb: true,
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
export * from "./service-delegates.js"
export * from "./service-rooming.js"
export * from "./service-sessions.js"
export * from "./validation.js"
export * from "./validation-delegates.js"
export * from "./validation-rooming.js"
export * from "./validation-sessions.js"

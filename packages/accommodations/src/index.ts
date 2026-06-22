import type { LinkableDefinition, Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { roomBlockAdminRoutes } from "./routes-room-blocks.js"

/**
 * Room blocks are the accommodations module's first linkable surface — a
 * standard, package-owned allotment primitive that any deployment can use
 * (the MICE spine merely links to it). See RFC voyant#1489.
 */
export const roomBlockLinkable: LinkableDefinition = {
  module: "accommodations",
  entity: "roomBlock",
  table: "room_blocks",
  idPrefix: "hrbl",
}

export const accommodationsLinkable = {
  roomBlock: roomBlockLinkable,
}

export const accommodationsModule: Module = {
  name: "accommodations",
  // Pickup / reversal / cutoff mutate per-night counters under a transaction.
  requiresTransactionalDb: true,
  linkable: accommodationsLinkable,
}

export const accommodationsHonoModule: HonoModule = {
  module: accommodationsModule,
  adminRoutes: roomBlockAdminRoutes,
}

export const accommodationsHonoModules = [accommodationsHonoModule] as const

export * from "./booking-engine/index.js"
export * from "./catalog-policy.js"
export * from "./content-shape.js"
export * from "./draft-shape.js"
export type { RoomBlockAdminRoutes } from "./routes-room-blocks.js"
export { roomBlockAdminRoutes } from "./routes-room-blocks.js"
export * from "./service-catalog-plane.js"
export * from "./service-content.js"
export * from "./service-content-synthesizer.js"
export * from "./service-room-blocks.js"
export * from "./validation-room-blocks.js"

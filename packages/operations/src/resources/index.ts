import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { resourcesRoutes } from "./routes.js"
import { resourcesService } from "./service.js"

export type { ResourcesRoutes } from "./routes.js"

export const resourcesModule: Module = {
  name: "resources",
}

export const resourcesHonoModule: HonoModule = {
  module: resourcesModule,
  routes: resourcesRoutes,
}

export type {
  NewResource,
  NewResourceAllocation,
  NewResourceCloseout,
  NewResourcePool,
  NewResourcePoolMember,
  NewResourceRequirement,
  NewResourceSlotAssignment,
  Resource,
  ResourceAllocation,
  ResourceCloseout,
  ResourcePool,
  ResourcePoolMember,
  ResourceRequirement,
  ResourceSlotAssignment,
} from "./schema.js"
export {
  resourceAllocations,
  resourceCloseouts,
  resourcePoolMembers,
  resourcePools,
  resourceRequirements,
  resourceSlotAssignments,
  resources,
} from "./schema.js"
export {
  insertResourceAllocationSchema,
  insertResourceCloseoutSchema,
  insertResourcePoolMemberSchema,
  insertResourcePoolSchema,
  insertResourceRequirementSchema,
  insertResourceSchema,
  insertResourceSlotAssignmentSchema,
  resourceAllocationListQuerySchema,
  resourceCloseoutListQuerySchema,
  resourceListQuerySchema,
  resourcePoolListQuerySchema,
  resourcePoolMemberListQuerySchema,
  resourceRequirementListQuerySchema,
  resourceSlotAssignmentListQuerySchema,
  updateResourceAllocationSchema,
  updateResourceCloseoutSchema,
  updateResourcePoolSchema,
  updateResourceRequirementSchema,
  updateResourceSchema,
  updateResourceSlotAssignmentSchema,
} from "./validation.js"
export { resourcesService }

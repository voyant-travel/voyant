/**
 * Relationships (CRM) agent tools on the framework tool contract. Thin, read-only
 * wrappers over the existing relationships service (people + organizations); the
 * service is injected on the tool context by intersection so this module stays
 * deployment-agnostic. Gated on the `crm` api-key resource.
 */
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { z } from "zod"

import { organizationListQuerySchema, personListQuerySchema } from "./validation.js"

export interface RelationshipsToolServices {
  listPeople(query: z.infer<typeof personListQuerySchema>): Promise<unknown>
  getPersonById(id: string): Promise<unknown>
  listOrganizations(query: z.infer<typeof organizationListQuerySchema>): Promise<unknown>
  getOrganizationById(id: string): Promise<unknown>
}

export type RelationshipsToolContext = ToolContext & { relationships?: RelationshipsToolServices }

function crm(ctx: RelationshipsToolContext): RelationshipsToolServices {
  return requireService(ctx.relationships, "relationships")
}

export const listPeopleTool = defineTool<
  z.infer<typeof personListQuerySchema>,
  unknown,
  RelationshipsToolContext
>({
  name: "list_people",
  description: "List CRM people with filters and pagination. Read-only.",
  inputSchema: personListQuerySchema,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["crm:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return crm(ctx).listPeople(query)
  },
})

const getByIdArgs = z.object({ id: z.string().min(1).describe("The record id.") })

export const getPersonTool = defineTool<
  z.infer<typeof getByIdArgs>,
  unknown,
  RelationshipsToolContext
>({
  name: "get_person",
  description: "Read a single CRM person by id. Read-only.",
  inputSchema: getByIdArgs,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["crm:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    return crm(ctx).getPersonById(id)
  },
})

export const listOrganizationsTool = defineTool<
  z.infer<typeof organizationListQuerySchema>,
  unknown,
  RelationshipsToolContext
>({
  name: "list_organizations",
  description: "List CRM organizations with filters and pagination. Read-only.",
  inputSchema: organizationListQuerySchema,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["crm:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return crm(ctx).listOrganizations(query)
  },
})

export const getOrganizationTool = defineTool<
  z.infer<typeof getByIdArgs>,
  unknown,
  RelationshipsToolContext
>({
  name: "get_organization",
  description: "Read a single CRM organization by id. Read-only.",
  inputSchema: getByIdArgs,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["crm:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    return crm(ctx).getOrganizationById(id)
  },
})

export const relationshipsTools = [
  listPeopleTool,
  getPersonTool,
  listOrganizationsTool,
  getOrganizationTool,
] as const

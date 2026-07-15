import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook, parseJsonBody, type VoyantDb } from "@voyant-travel/hono"
import type { Context } from "hono"

import { TeamManagementError } from "./team-management-policy.js"
import type {
  TeamManagementRequestContext,
  TeamManagementRuntimeProvider,
} from "./team-management-runtime-port.js"

type TeamEnv = {
  Bindings: Record<string, unknown>
  Variables: { userId?: string; db: VoyantDb }
}
type TeamRouteContext = Context<TeamEnv>

const inviteSchema = z.object({
  email: z.string().email(),
  roleId: z.string().trim().min(1).max(120),
  expiresInDays: z.number().int().min(1).max(30).optional(),
})
const roleSchema = z.object({ roleId: z.string().trim().min(1).max(120) })

const teamAdminApiId = "@voyant-travel/auth#team.api.admin"
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
})
const responses = (...statuses: number[]) =>
  Object.fromEntries(statuses.map((status) => [status, { description: `HTTP ${status}` }]))
const teamRoute = <M extends "get" | "post" | "put" | "delete", P extends string>(config: {
  method: M
  path: P
  operationId: string
  request?: Record<string, unknown>
  statuses: number[]
}) =>
  createRoute({
    method: config.method,
    path: config.path,
    operationId: config.operationId,
    "x-voyant-api-id": teamAdminApiId,
    ...(config.request ? { request: config.request } : {}),
    responses: responses(...config.statuses),
  })

const capabilitiesRoute = teamRoute({
  method: "get",
  path: "/capabilities",
  operationId: "getTeamManagementCapabilities",
  statuses: [200, 401, 403, 501],
})
const listMembersRoute = teamRoute({
  method: "get",
  path: "/members",
  operationId: "listTeamMembers",
  statuses: [200, 401, 403, 501],
})
const listRolesRoute = teamRoute({
  method: "get",
  path: "/roles",
  operationId: "listTeamRoles",
  statuses: [200, 401, 403, 501],
})
const listInvitationsRoute = teamRoute({
  method: "get",
  path: "/invitations",
  operationId: "listTeamInvitations",
  statuses: [200, 401, 403, 501],
})
const createInvitationRoute = teamRoute({
  method: "post",
  path: "/invitations",
  operationId: "createTeamInvitation",
  request: { body: jsonBody(inviteSchema) },
  statuses: [201, 400, 401, 403, 404, 409, 501],
})
const revokeInvitationRoute = teamRoute({
  method: "delete",
  path: "/invitations/{invitationId}",
  operationId: "revokeTeamInvitation",
  request: { params: z.object({ invitationId: z.string() }) },
  statuses: [204, 401, 403, 404, 501],
})
const updateRoleRoute = teamRoute({
  method: "put",
  path: "/members/{memberId}/role",
  operationId: "updateTeamMemberRole",
  request: {
    params: z.object({ memberId: z.string() }),
    body: jsonBody(roleSchema),
  },
  statuses: [200, 400, 401, 403, 404, 409, 501],
})
const deactivateMemberRoute = teamRoute({
  method: "delete",
  path: "/members/{memberId}",
  operationId: "deactivateTeamMember",
  request: { params: z.object({ memberId: z.string() }) },
  statuses: [200, 401, 403, 404, 409, 501],
})

function requestContext(c: TeamRouteContext): TeamManagementRequestContext | Response {
  const userId = c.get("userId")
  if (!userId) return c.json({ error: "Unauthorized" }, 401)
  return { bindings: c.env, db: c.get("db"), userId }
}

function handleError(c: TeamRouteContext, error: unknown): Response {
  if (error instanceof TeamManagementError) {
    return c.json({ error: error.message, code: error.code }, error.status)
  }
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return c.json({ error: error.message }, error.status as 400)
  }
  throw error
}

export function createTeamAdminRoutes(runtime: TeamManagementRuntimeProvider) {
  const routes = new OpenAPIHono<TeamEnv>({ defaultHook: openApiValidationHook })

  const run = async <T>(
    c: TeamRouteContext,
    operation: (context: TeamManagementRequestContext) => Promise<T>,
  ): Promise<T | Response> => {
    const context = requestContext(c)
    if (context instanceof Response) return context
    try {
      return await operation(context)
    } catch (error) {
      return handleError(c, error)
    }
  }

  routes.openapi(capabilitiesRoute, async (c) => {
    const result = await run(c, (context) => runtime.getCapabilities(context))
    return result instanceof Response ? result : c.json({ data: result })
  })
  routes.openapi(listMembersRoute, async (c) => {
    const result = await run(c, (context) => runtime.listMembers(context))
    return result instanceof Response ? result : c.json({ data: result })
  })
  routes.openapi(listRolesRoute, async (c) => {
    const result = await run(c, (context) => runtime.listRoles(context))
    return result instanceof Response ? result : c.json({ data: result })
  })
  routes.openapi(listInvitationsRoute, async (c) => {
    const result = await run(c, (context) => runtime.listInvitations(context))
    return result instanceof Response ? result : c.json({ data: result })
  })
  routes.openapi(createInvitationRoute, async (c) => {
    const input = await parseJsonBody(c, inviteSchema)
    const result = await run(c, (context) => runtime.inviteMember(context, input))
    return result instanceof Response ? result : c.json({ data: result }, 201)
  })
  routes.openapi(revokeInvitationRoute, async (c) => {
    const result = await run(c, (context) =>
      runtime.revokeInvitation(context, c.req.valid("param").invitationId),
    )
    return result instanceof Response ? result : c.body(null, 204)
  })
  routes.openapi(updateRoleRoute, async (c) => {
    const input = await parseJsonBody(c, roleSchema)
    const result = await run(c, (context) =>
      runtime.updateMemberRole(context, c.req.valid("param").memberId, input.roleId),
    )
    return result instanceof Response ? result : c.json({ data: result })
  })
  routes.openapi(deactivateMemberRoute, async (c) => {
    const result = await run(c, (context) =>
      runtime.deactivateMember(context, c.req.valid("param").memberId),
    )
    return result instanceof Response ? result : c.json({ data: result })
  })

  return routes
}

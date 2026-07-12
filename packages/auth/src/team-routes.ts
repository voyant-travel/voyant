import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { cloudAuthUserLinks } from "@voyant-travel/db/schema/iam"
import { openApiValidationHook, parseJsonBody, type VoyantDb } from "@voyant-travel/hono"
import { eq } from "drizzle-orm"
import type { Context } from "hono"

import {
  type CloudAdminMembersConfig,
  CloudAdminMembersError,
  inviteCloudAdminMember,
  listCloudAdminInvitations,
  listCloudAdminMemberRoles,
  listCloudAdminMembers,
  revokeCloudAdminInvitation,
  setCloudAdminMemberAccess,
  setCloudAdminMemberPermissions,
} from "./cloud-broker.js"
import type { IdentityAccessRuntimeProvider } from "./identity-access-runtime-port.js"

type IdentityAccessEnv = {
  Bindings: Record<string, unknown>
  Variables: { userId?: string; db: VoyantDb }
}
type TeamContext = { config: CloudAdminMembersConfig; actingWorkosUserId: string }
type TeamRouteContext = Context<IdentityAccessEnv>

const inviteSchema = z.object({
  email: z.string().email(),
  roleSlug: z.string().trim().min(1).max(120).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
})
const accessSchema = z.object({ hasAccess: z.boolean() })
const permissionsSchema = z.object({
  permissions: z.array(z.string().trim().min(1).max(120)).max(200),
})

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

const listMembersRoute = teamRoute({
  method: "get",
  path: "/members",
  operationId: "listTeamMembers",
  statuses: [200, 401, 403, 404, 501],
})
const listRolesRoute = teamRoute({
  method: "get",
  path: "/roles",
  operationId: "listTeamRoles",
  statuses: [200, 401, 403, 404, 501],
})
const listTeamInvitationsRoute = teamRoute({
  method: "get",
  path: "/invitations",
  operationId: "listTeamInvitations",
  statuses: [200, 401, 403, 404, 501],
})
const createTeamInvitationRoute = teamRoute({
  method: "post",
  path: "/invitations",
  operationId: "createTeamInvitation",
  request: { body: jsonBody(inviteSchema) },
  statuses: [201, 400, 401, 403, 404, 501],
})
const revokeTeamInvitationRoute = teamRoute({
  method: "delete",
  path: "/invitations/{invitationId}",
  operationId: "revokeTeamInvitation",
  request: { params: z.object({ invitationId: z.string() }) },
  statuses: [204, 401, 403, 404, 501],
})
const setTeamMemberAccessRoute = teamRoute({
  method: "put",
  path: "/members/{membershipId}/access",
  operationId: "setTeamMemberAccess",
  request: {
    params: z.object({ membershipId: z.string() }),
    body: jsonBody(accessSchema),
  },
  statuses: [200, 400, 401, 403, 404, 501],
})
const setTeamMemberPermissionsRoute = teamRoute({
  method: "put",
  path: "/members/{membershipId}/permissions",
  operationId: "setTeamMemberPermissions",
  request: {
    params: z.object({ membershipId: z.string() }),
    body: jsonBody(permissionsSchema),
  },
  statuses: [200, 400, 401, 403, 404, 501],
})

async function resolveActingWorkosUserId(db: VoyantDb, userId: string): Promise<string | null> {
  const [link] = await db
    .select({ providerAccountId: cloudAuthUserLinks.providerAccountId })
    .from(cloudAuthUserLinks)
    .where(eq(cloudAuthUserLinks.userId, userId))
    .limit(1)
  return link?.providerAccountId ?? null
}

export function createTeamAdminRoutes(runtime: IdentityAccessRuntimeProvider) {
  const routes = new OpenAPIHono<IdentityAccessEnv>({ defaultHook: openApiValidationHook })

  const resolveContext = async (c: TeamRouteContext): Promise<TeamContext | Response> => {
    const deployment = runtime.resolveDeployment(c.env)
    if (deployment.authMode !== "voyant-cloud") return c.json({ error: "Not found" }, 404)

    const userId = c.get("userId")
    if (!userId) return c.json({ error: "Unauthorized" }, 401)
    if (!deployment.cloudAdminMembers) {
      return c.json({ error: "Voyant Cloud member management is not configured" }, 501)
    }

    const actingWorkosUserId = await resolveActingWorkosUserId(c.get("db"), userId)
    if (!actingWorkosUserId) {
      return c.json({ error: "No Voyant Cloud identity for this session" }, 403)
    }
    return { config: deployment.cloudAdminMembers, actingWorkosUserId }
  }

  const handleError = (c: TeamRouteContext, error: unknown): Response => {
    if (error instanceof CloudAdminMembersError) {
      return c.json({ error: error.reason ?? error.message }, error.status as 403)
    }
    throw error
  }

  routes.openapi(listMembersRoute, async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    try {
      return c.json({ data: await listCloudAdminMembers(context) })
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.openapi(listRolesRoute, async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    try {
      return c.json({ data: await listCloudAdminMemberRoles(context) })
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.openapi(listTeamInvitationsRoute, async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    try {
      return c.json({ data: await listCloudAdminInvitations(context) })
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.openapi(createTeamInvitationRoute, async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    const input = await parseJsonBody(c, inviteSchema)
    try {
      return c.json({ data: await inviteCloudAdminMember({ ...context, input }) }, 201)
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.openapi(revokeTeamInvitationRoute, async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    try {
      await revokeCloudAdminInvitation({
        ...context,
        invitationId: c.req.param("invitationId"),
      })
      return c.body(null, 204)
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.openapi(setTeamMemberAccessRoute, async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    const input = await parseJsonBody(c, accessSchema)
    try {
      return c.json({
        data: await setCloudAdminMemberAccess({
          ...context,
          membershipId: c.req.param("membershipId"),
          hasAccess: input.hasAccess,
        }),
      })
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.openapi(setTeamMemberPermissionsRoute, async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    const input = await parseJsonBody(c, permissionsSchema)
    try {
      return c.json({
        data: await setCloudAdminMemberPermissions({
          ...context,
          membershipId: c.req.param("membershipId"),
          permissions: input.permissions,
        }),
      })
    } catch (error) {
      return handleError(c, error)
    }
  })

  return routes
}

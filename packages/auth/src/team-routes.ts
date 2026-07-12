import { cloudAuthUserLinks } from "@voyant-travel/db/schema/iam"
import { parseJsonBody, type VoyantDb } from "@voyant-travel/hono"
import { eq } from "drizzle-orm"
import { type Context, Hono } from "hono"
import { z } from "zod"

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

async function resolveActingWorkosUserId(db: VoyantDb, userId: string): Promise<string | null> {
  const [link] = await db
    .select({ providerAccountId: cloudAuthUserLinks.providerAccountId })
    .from(cloudAuthUserLinks)
    .where(eq(cloudAuthUserLinks.userId, userId))
    .limit(1)
  return link?.providerAccountId ?? null
}

export function createTeamAdminRoutes(runtime: IdentityAccessRuntimeProvider) {
  const routes = new Hono<IdentityAccessEnv>()

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

  routes.get("/members", async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    try {
      return c.json({ data: await listCloudAdminMembers(context) })
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.get("/roles", async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    try {
      return c.json({ data: await listCloudAdminMemberRoles(context) })
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.get("/invitations", async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    try {
      return c.json({ data: await listCloudAdminInvitations(context) })
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.post("/invitations", async (c) => {
    const context = await resolveContext(c)
    if (context instanceof Response) return context
    const input = await parseJsonBody(c, inviteSchema)
    try {
      return c.json({ data: await inviteCloudAdminMember({ ...context, input }) }, 201)
    } catch (error) {
      return handleError(c, error)
    }
  })
  routes.delete("/invitations/:invitationId", async (c) => {
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
  routes.put("/members/:membershipId/access", async (c) => {
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
  routes.put("/members/:membershipId/permissions", async (c) => {
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

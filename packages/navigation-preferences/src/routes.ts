import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  ForbiddenApiError,
  openApiValidationHook,
  parseJsonBody,
  requireUserId,
  type VoyantDb,
} from "@voyant-travel/hono"
import { hasApiKeyPermission, permissionStringsToPermissions } from "@voyant-travel/types/api-keys"

import {
  navigationPreferencesSnapshotSchema,
  navigationVisibilityMapSchema,
  updateNavigationPreferencesSchema,
} from "./contracts.js"
import {
  getNavigationPreferences,
  setMemberNavigationPreferences,
  setOrganizationNavigationPreferences,
} from "./service.js"

const apiId = "@voyant-travel/navigation-preferences#api.admin"
const resource = "admin-navigation"

type Env = {
  Bindings: Record<string, unknown>
  Variables: { db: VoyantDb; userId?: string; scopes?: string[] }
}

export interface NavigationPreferencesRouteService {
  get: typeof getNavigationPreferences
  setOrganization: typeof setOrganizationNavigationPreferences
  setMember: typeof setMemberNavigationPreferences
}

export interface CreateNavigationPreferencesRoutesOptions {
  service?: NavigationPreferencesRouteService
}

const visibilityResponseSchema = z.object({
  data: z.object({ visibility: navigationVisibilityMapSchema }),
})
const snapshotResponseSchema = z.object({ data: navigationPreferencesSnapshotSchema })
const errorResponseSchema = z.object({ error: z.unknown() })

const jsonContent = <T extends z.ZodTypeAny>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
})
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
})
const errors = {
  400: jsonContent(errorResponseSchema, "Invalid request"),
  401: jsonContent(errorResponseSchema, "Authentication required"),
  403: jsonContent(errorResponseSchema, "Organization administrator access required"),
} as const

const getPreferencesRoute = createRoute({
  method: "get",
  path: "/v1/admin/navigation-preferences",
  operationId: "getNavigationPreferences",
  "x-voyant-api-id": apiId,
  responses: {
    200: jsonContent(snapshotResponseSchema, "Navigation preferences"),
    401: errors[401],
  },
})
const putOrganizationRoute = createRoute({
  method: "put",
  path: "/v1/admin/navigation-preferences/organization",
  operationId: "setOrganizationNavigationPreferences",
  "x-voyant-api-id": apiId,
  request: { body: jsonBody(updateNavigationPreferencesSchema) },
  responses: { 200: jsonContent(visibilityResponseSchema, "Organization defaults"), ...errors },
})
const putMemberRoute = createRoute({
  method: "put",
  path: "/v1/admin/navigation-preferences/me",
  operationId: "setOwnNavigationPreferences",
  "x-voyant-api-id": apiId,
  request: { body: jsonBody(updateNavigationPreferencesSchema) },
  responses: {
    200: jsonContent(visibilityResponseSchema, "Member overrides"),
    400: errors[400],
    401: errors[401],
  },
})

const defaultService: NavigationPreferencesRouteService = {
  get: getNavigationPreferences,
  setOrganization: setOrganizationNavigationPreferences,
  setMember: setMemberNavigationPreferences,
}

export function createNavigationPreferencesRoutes(
  options: CreateNavigationPreferencesRoutesOptions = {},
) {
  const routes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  const service = options.service ?? defaultService

  routes.openapi(getPreferencesRoute, async (c) => {
    const memberId = requireUserId(c)
    const preferences = await service.get(c.get("db"), memberId)
    return c.json(
      {
        data: { ...preferences, canManageOrganization: canManageOrganization(c.get("scopes")) },
      },
      200,
    )
  })

  routes.openapi(putOrganizationRoute, async (c) => {
    requireOrganizationWrite(c.get("scopes"))
    const input = await parseJsonBody(c, updateNavigationPreferencesSchema)
    const visibility = await service.setOrganization(c.get("db"), input.visibility)
    return c.json({ data: { visibility } }, 200)
  })

  routes.openapi(putMemberRoute, async (c) => {
    const memberId = requireUserId(c)
    const input = await parseJsonBody(c, updateNavigationPreferencesSchema)
    const visibility = await service.setMember(c.get("db"), memberId, input.visibility)
    return c.json({ data: { visibility } }, 200)
  })

  return routes
}

function canManageOrganization(scopes: string[] | undefined): boolean {
  return hasApiKeyPermission(permissionStringsToPermissions(scopes ?? []), resource, "write")
}

function requireOrganizationWrite(scopes: string[] | undefined): void {
  if (!canManageOrganization(scopes)) throw new ForbiddenApiError()
}

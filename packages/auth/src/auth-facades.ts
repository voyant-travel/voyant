import type { getDb } from "@voyant-travel/db"
import { authMember, authSession, authUser } from "@voyant-travel/db/schema/iam"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import { and, asc, eq } from "drizzle-orm"

import { ApiTokenValidationError, buildApiTokenCreateBody, pickFields } from "./api-token-create.js"
import {
  type ApiTokenRotationOptions,
  type ApiTokenRotationStore,
  rotateApiTokenSecret,
} from "./api-token-rotation.js"
import {
  type CurrentUser,
  type UpdateCurrentUserProfileInput,
  updateCurrentUserProfile,
} from "./workspace.js"

type BetterAuthApiKeySession = {
  user: {
    id: string
  }
  session?: {
    id?: string
    activeOrganizationId?: string | null
  }
}

type BetterAuthApiKeyApi = {
  getSession: (args: { headers: Headers }) => Promise<BetterAuthApiKeySession | null>
  listApiKeys: (args: { query?: Record<string, unknown>; headers: Headers }) => Promise<unknown>
  createApiKey: (args: { body: Record<string, unknown>; headers?: Headers }) => Promise<unknown>
  updateApiKey: (args: { body: Record<string, unknown>; headers?: Headers }) => Promise<unknown>
  deleteApiKey: (args: { body: Record<string, unknown>; headers: Headers }) => Promise<unknown>
}

export type BetterAuthApiTokenManagement = {
  api: BetterAuthApiKeyApi
}

export interface HandleApiTokenManagementRequestOptions extends ApiTokenRotationOptions {
  /**
   * Auth route mount path. Voyant operator APIs mount Better Auth under
   * `/auth`, which makes the facade routes `/auth/api-tokens`.
   */
  basePath?: string
  accessCatalog?: AccessCatalog
}

export interface HandleAccountProfileRequestOptions {
  /**
   * Auth route mount path. Voyant operator APIs mount Better Auth under
   * `/auth`, which makes the account profile route `/auth/me`.
   */
  basePath?: string
  db: ReturnType<typeof getDb>
  updateProfile?: AccountProfileUpdateHandler
}

export type AccountProfileUpdateHandler = (
  db: ReturnType<typeof getDb>,
  input: UpdateCurrentUserProfileInput,
) => Promise<CurrentUser | null>

export interface OrganizationMembersListInput {
  userId: string
  organizationId?: string
  activeOrganizationId?: string | null
  sessionId?: string
}

export type OrganizationMemberRecord = {
  id: string
  userId: string
  organizationId: string
  role: string
  createdAt: string
  user: {
    id: string
    email: string | null
    name?: string | null
    image?: string | null
  }
}

export type OrganizationMembersListHandler = (
  db: ReturnType<typeof getDb>,
  input: OrganizationMembersListInput,
) => Promise<OrganizationMemberRecord[]>

export interface HandleOrganizationMembersRequestOptions {
  /**
   * Auth route mount path. Voyant operator APIs mount Better Auth under
   * `/auth`, which makes the organization member route
   * `/auth/organization/list-members`.
   */
  basePath?: string
  db: ReturnType<typeof getDb>
  listOrganizationMembers?: OrganizationMembersListHandler
}

type ApiTokenErrorStatus = 400 | 401 | 403 | 404 | 405 | 429 | 500

const API_TOKEN_QUERY_FIELDS = [
  "configId",
  "organizationId",
  "limit",
  "offset",
  "sortBy",
  "sortDirection",
] as const

const API_TOKEN_UPDATE_FIELDS = [
  "configId",
  "name",
  "enabled",
  "expiresIn",
  "metadata",
  "permissions",
] as const

export type { ApiTokenRotationStore }

function normalizeApiTokenErrorStatus(status: number | undefined): ApiTokenErrorStatus {
  if (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 405 ||
    status === 429 ||
    status === 500
  ) {
    return status
  }
  return 400
}

function authApiErrorResponse(error: unknown): Response {
  const candidate = error as { status?: number; statusCode?: number; message?: string }
  const status = normalizeApiTokenErrorStatus(candidate.status ?? candidate.statusCode)
  return jsonResponse({ error: candidate.message ?? "API token request failed" }, status)
}

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers })
}

function methodNotAllowed(allowed: string[]): Response {
  return jsonResponse({ error: "Method not allowed" }, 405, { Allow: allowed.join(", ") })
}

function apiTokenFacadePath(pathname: string, basePath: string): string | null {
  const trimmedBase = basePath.replace(/^\/+|\/+$/g, "")
  const normalizedBase = trimmedBase ? `/${trimmedBase}` : ""
  const normalizedPath = pathname.replace(/\/+$/g, "") || "/"

  if (normalizedPath === `${normalizedBase}/api-tokens`) {
    return "/api-tokens"
  }

  if (normalizedPath.startsWith(`${normalizedBase}/api-tokens/`)) {
    return normalizedPath.slice(normalizedBase.length)
  }

  return null
}

function accountProfileFacadePath(pathname: string, basePath: string): string | null {
  const trimmedBase = basePath.replace(/^\/+|\/+$/g, "")
  const normalizedBase = trimmedBase ? `/${trimmedBase}` : ""
  const normalizedPath = pathname.replace(/\/+$/g, "") || "/"

  return normalizedPath === `${normalizedBase}/me` ? "/me" : null
}

function organizationMembersFacadePath(pathname: string, basePath: string): string | null {
  const trimmedBase = basePath.replace(/^\/+|\/+$/g, "")
  const normalizedBase = trimmedBase ? `/${trimmedBase}` : ""
  const normalizedPath = pathname.replace(/\/+$/g, "") || "/"

  return normalizedPath === `${normalizedBase}/organization/list-members` ? "/list-members" : null
}

function readApiKeyQuery(request: Request): Record<string, unknown> {
  const query: Record<string, unknown> = {}
  const params = new URL(request.url).searchParams

  for (const key of API_TOKEN_QUERY_FIELDS) {
    const value = params.get(key)
    if (value === null) continue
    query[key] = key === "limit" || key === "offset" ? Number(value) : value
  }

  return query
}

function readProfileUpdate(
  body: Record<string, unknown>,
): Omit<UpdateCurrentUserProfileInput, "userId"> {
  const input: Omit<UpdateCurrentUserProfileInput, "userId"> = {}

  for (const field of [
    "firstName",
    "lastName",
    "locale",
    "timezone",
    "profilePictureUrl",
  ] as const) {
    const value = body[field]
    if (value === undefined) continue

    if (value !== null && typeof value !== "string") {
      throw Object.assign(new Error(`${field} must be a string or null`), { status: 400 })
    }

    const maxLength =
      field === "locale"
        ? 10
        : field === "timezone"
          ? 64
          : field === "profilePictureUrl"
            ? 2048
            : 200
    if (typeof value === "string" && value.length > maxLength) {
      throw Object.assign(new Error(`${field} must be ${maxLength} characters or fewer`), {
        status: 400,
      })
    }

    input[field] = value
  }

  return input
}

async function readOptionalJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (!text) return {}

  const parsed = JSON.parse(text) as unknown
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {}
}

async function requireApiTokenSession(auth: BetterAuthApiTokenManagement, headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 })
  }
  return session
}

async function requireAccountProfileSession(auth: BetterAuthApiTokenManagement, headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 })
  }
  return session
}

async function requireOrganizationMembersSession(
  auth: BetterAuthApiTokenManagement,
  headers: Headers,
) {
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 })
  }
  return session
}

function readOrganizationMembersQuery(request: Request) {
  const params = new URL(request.url).searchParams
  const organizationId = params.get("organizationId")?.trim()
  return {
    organizationId: organizationId || undefined,
  }
}

function serializeMemberCreatedAt(createdAt: Date | string | null | undefined): string {
  if (createdAt instanceof Date) return createdAt.toISOString()
  if (typeof createdAt === "string" && createdAt.length > 0) return createdAt
  return new Date(0).toISOString()
}

async function resolveOrganizationIdForMemberList(
  db: ReturnType<typeof getDb>,
  input: OrganizationMembersListInput,
): Promise<string | null> {
  if (input.organizationId) return input.organizationId
  if (input.activeOrganizationId) return input.activeOrganizationId

  if (input.sessionId) {
    const [session] = await db
      .select({ activeOrganizationId: authSession.activeOrganizationId })
      .from(authSession)
      .where(eq(authSession.id, input.sessionId))
      .limit(1)
    if (session?.activeOrganizationId) return session.activeOrganizationId
  }

  const [membership] = await db
    .select({ organizationId: authMember.organizationId })
    .from(authMember)
    .where(eq(authMember.userId, input.userId))
    .limit(1)

  return membership?.organizationId ?? null
}

async function listOrganizationMembersFromDb(
  db: ReturnType<typeof getDb>,
  input: OrganizationMembersListInput,
): Promise<OrganizationMemberRecord[]> {
  const organizationId = await resolveOrganizationIdForMemberList(db, input)
  if (!organizationId) return []

  const [currentMember] = await db
    .select({ id: authMember.id })
    .from(authMember)
    .where(and(eq(authMember.organizationId, organizationId), eq(authMember.userId, input.userId)))
    .limit(1)

  if (!currentMember) {
    throw Object.assign(new Error("Forbidden"), { status: 403 })
  }

  const rows = await db
    .select({
      id: authMember.id,
      userId: authMember.userId,
      organizationId: authMember.organizationId,
      role: authMember.role,
      createdAt: authMember.createdAt,
      userIdValue: authUser.id,
      userEmail: authUser.email,
      userName: authUser.name,
      userImage: authUser.image,
    })
    .from(authMember)
    .innerJoin(authUser, eq(authUser.id, authMember.userId))
    .where(eq(authMember.organizationId, organizationId))
    .orderBy(asc(authMember.createdAt))

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role,
    createdAt: serializeMemberCreatedAt(row.createdAt),
    user: {
      id: row.userIdValue,
      email: row.userEmail,
      name: row.userName,
      image: row.userImage,
    },
  }))
}

/** Handles Voyant's stable `PATCH /auth/me` account-profile facade. */
export async function handleAccountProfileRequest(
  request: Request,
  auth: { api: unknown },
  options: HandleAccountProfileRequestOptions,
): Promise<Response | null> {
  const path = accountProfileFacadePath(new URL(request.url).pathname, options.basePath ?? "/auth")
  if (path === null) return null

  try {
    if (request.method !== "PATCH") return null

    const session = await requireAccountProfileSession(
      { api: auth.api as BetterAuthApiKeyApi },
      request.headers,
    )
    const body = await readOptionalJson(request)
    const profile = await (options.updateProfile ?? updateCurrentUserProfile)(options.db, {
      userId: session.user.id,
      ...readProfileUpdate(body),
    })

    if (!profile) {
      return jsonResponse({ error: "User not found" }, 404)
    }

    return jsonResponse(profile)
  } catch (error) {
    return authApiErrorResponse(error)
  }
}

/** Handles Voyant's stable `GET /auth/organization/list-members` facade. */
export async function handleOrganizationMembersRequest(
  request: Request,
  auth: { api: unknown },
  options: HandleOrganizationMembersRequestOptions,
): Promise<Response | null> {
  const path = organizationMembersFacadePath(
    new URL(request.url).pathname,
    options.basePath ?? "/auth",
  )
  if (path === null) return null

  try {
    if (request.method !== "GET") return methodNotAllowed(["GET"])

    const session = await requireOrganizationMembersSession(
      { api: auth.api as BetterAuthApiKeyApi },
      request.headers,
    )
    const query = readOrganizationMembersQuery(request)
    const members = await (options.listOrganizationMembers ?? listOrganizationMembersFromDb)(
      options.db,
      {
        userId: session.user.id,
        sessionId: session.session?.id,
        activeOrganizationId: session.session?.activeOrganizationId,
        organizationId: query.organizationId,
      },
    )

    return jsonResponse({ members })
  } catch (error) {
    return authApiErrorResponse(error)
  }
}

/**
 * Handles Voyant's stable `/auth/api-tokens` management facade, including
 * create, list, update, delete, and secret rotation.
 */
export async function handleApiTokenManagementRequest(
  request: Request,
  auth: { api: unknown },
  options: HandleApiTokenManagementRequestOptions = {},
): Promise<Response | null> {
  const path = apiTokenFacadePath(new URL(request.url).pathname, options.basePath ?? "/auth")
  if (path === null) return null

  const api = auth.api as BetterAuthApiKeyApi
  const rotateMatch = path.match(/^\/api-tokens\/([^/]+)\/rotate$/)
  const keyMatch = path.match(/^\/api-tokens\/([^/]+)$/)

  try {
    if (path === "/api-tokens") {
      if (request.method === "GET") {
        const result = await api.listApiKeys({
          query: readApiKeyQuery(request),
          headers: request.headers,
        })
        return jsonResponse(result)
      }

      if (request.method === "POST") {
        const body = await readOptionalJson(request)
        const session = await requireApiTokenSession({ api }, request.headers)
        let createBody: Record<string, unknown>
        try {
          createBody = buildApiTokenCreateBody(body, options.accessCatalog)
        } catch (error) {
          if (error instanceof ApiTokenValidationError) {
            return jsonResponse({ error: error.message }, 400)
          }
          throw error
        }
        const result = await api.createApiKey({
          body: {
            ...createBody,
            userId: session.user.id,
          },
        })
        return jsonResponse(result, 201)
      }

      return methodNotAllowed(["GET", "POST"])
    }

    if (rotateMatch?.[1]) {
      if (request.method !== "POST") return methodNotAllowed(["POST"])

      const keyId = decodeURIComponent(rotateMatch[1])
      const body = await readOptionalJson(request)
      const session = await requireApiTokenSession({ api }, request.headers)
      const result = await rotateApiTokenSecret({
        keyId,
        body,
        userId: session.user.id,
        options,
        authorize: async ({ configId, enabled, keyId, userId }) => {
          await api.updateApiKey({
            body: {
              ...(configId ? { configId } : {}),
              keyId,
              enabled,
              userId,
            },
          })
        },
      })

      return jsonResponse(result)
    }

    if (keyMatch?.[1]) {
      const keyId = decodeURIComponent(keyMatch[1])

      if (request.method === "POST") {
        const body = await readOptionalJson(request)
        const session = await requireApiTokenSession({ api }, request.headers)
        const result = await api.updateApiKey({
          body: {
            ...pickFields(body, API_TOKEN_UPDATE_FIELDS),
            keyId,
            userId: session.user.id,
          },
        })
        return jsonResponse(result)
      }

      if (request.method === "DELETE") {
        const body = await readOptionalJson(request)
        const result = await api.deleteApiKey({
          body: { ...pickFields(body, ["configId"]), keyId },
          headers: request.headers,
        })
        return jsonResponse(result)
      }

      return methodNotAllowed(["POST", "DELETE"])
    }

    return jsonResponse({ error: "Not found" }, 404)
  } catch (error) {
    return authApiErrorResponse(error)
  }
}

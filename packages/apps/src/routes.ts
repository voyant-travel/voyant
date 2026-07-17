import { parseJsonBody, parseQuery, RequestValidationError } from "@voyant-travel/hono"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"
import {
  appCredentialRevocationSchema,
  appListQuerySchema,
  appOAuthAuthorizeQuerySchema,
  appOAuthTokenSchema,
  createCustomAppRegistrationSchema,
  releaseManifestFetchSchema,
  releaseManifestUploadSchema,
} from "./contracts.js"
import { createAppOAuthService } from "./oauth-service.js"
import { type AppsServiceOptions, createAppsService } from "./service.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const appIdParamSchema = z.object({ appId: z.string().min(1) })

export interface AppsAdminRouteOptions extends AppsServiceOptions {
  oauth?: {
    accessCatalog: AccessCatalog
    deploymentId: string
  }
}

export function createAppsAdminRoutes(options: AppsAdminRouteOptions = {}) {
  const routes = new Hono<Env>()
  const service = createAppsService(options)
  const oauth = options.oauth ? createAppOAuthService(options.oauth) : null

  routes.get("/", async (c) => {
    const query = parseQuery(c, appListQuerySchema)
    return c.json(await service.list(c.get("db"), query), 200)
  })

  routes.post("/", async (c) => {
    const body = await parseJsonBody(c, createCustomAppRegistrationSchema)
    const app = await service.createCustomApp(c.get("db"), body)
    return c.json({ data: app }, 201)
  })

  routes.get("/oauth/authorize", async (c) => {
    if (!oauth) return c.json({ error: "App OAuth is not configured" }, 501)
    const query = parseQuery(c, appOAuthAuthorizeQuerySchema)
    const result = await oauth.authorize(c.get("db"), {
      appId: query.client_id,
      releaseId: query.release_id,
      redirectUri: query.redirect_uri,
      state: query.state,
      codeChallenge: query.code_challenge,
      codeChallengeMethod: query.code_challenge_method,
      actorId: query.actor_id,
      operatorGrantedScopes: splitScopes(query.operator_scopes),
      grantedOptionalScopes: splitScopes(query.optional_scopes),
    })
    const redirectUrl = new URL(result.redirectUri)
    redirectUrl.searchParams.set("code", result.code)
    redirectUrl.searchParams.set("state", result.state)
    return c.redirect(redirectUrl.toString(), 302)
  })

  routes.post("/oauth/token", async (c) => {
    if (!oauth) return c.json({ error: "App OAuth is not configured" }, 501)
    const body = await parseJsonBody(c, appOAuthTokenSchema)
    const token =
      body.grant_type === "authorization_code"
        ? await oauth.token(c.get("db"), {
            grantType: "authorization_code",
            code: body.code,
            redirectUri: body.redirect_uri,
            codeVerifier: body.code_verifier,
            clientId: body.client_id,
            clientSecret: body.client_secret,
          })
        : body.grant_type === "refresh_token"
          ? await oauth.token(c.get("db"), {
              grantType: "refresh_token",
              refreshToken: body.refresh_token,
              clientId: body.client_id,
              clientSecret: body.client_secret,
            })
          : await oauth.token(c.get("db"), {
              grantType: "urn:voyant:params:oauth:grant-type:actor-token-exchange",
              installationId: body.installation_id,
              viewerId: body.viewer_id,
              viewerScopes: body.viewer_scopes,
              contextualScopes: body.contextual_scopes,
              clientId: body.client_id,
              clientSecret: body.client_secret,
            })
    return c.json(token, 200)
  })

  routes.post("/oauth/revoke-installation", async (c) => {
    if (!oauth) return c.json({ error: "App OAuth is not configured" }, 501)
    const body = await parseJsonBody(c, appCredentialRevocationSchema)
    const result = await oauth.revokeInstallationCredentials(
      c.get("db"),
      body.installationId,
      body.actorId,
    )
    return c.json(result, 200)
  })

  routes.get("/:appId", async (c) => {
    const { appId } = parseParams(c.req.param())
    const app = await service.get(c.get("db"), appId)
    return app ? c.json({ data: app }, 200) : c.json({ error: "App not found" }, 404)
  })

  routes.post("/:appId/releases", async (c) => {
    const { appId } = parseParams(c.req.param())
    const body = await parseJsonBody(c, releaseManifestUploadSchema)
    const result = await service.releaseFromUpload(c.get("db"), appId, body)
    return c.json({ data: result.release, digest: result.digest, created: result.created }, 201)
  })

  routes.post("/:appId/releases/fetch", async (c) => {
    const { appId } = parseParams(c.req.param())
    const body = await parseJsonBody(c, releaseManifestFetchSchema)
    const result = await service.releaseFromFetch(c.get("db"), appId, body)
    return c.json({ data: result.release, digest: result.digest, created: result.created }, 201)
  })

  return routes
}

function splitScopes(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean)
}

function parseParams(input: Record<string, string | undefined>) {
  const parsed = appIdParamSchema.safeParse(input)
  if (!parsed.success) throw new RequestValidationError("Invalid route parameters")
  return parsed.data
}

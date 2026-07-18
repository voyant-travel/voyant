import {
  parseJsonBody,
  parseQuery,
  RequestValidationError,
  requireUserId,
} from "@voyant-travel/hono"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"
import {
  appCredentialRevocationSchema,
  appListQuerySchema,
  appOAuthAuthorizeQuerySchema,
  appOAuthTokenSchema,
  appSessionTokenExchangeSchema,
  appSessionTokenIssueSchema,
  appWebhookReplaySchema,
  createCustomAppRegistrationSchema,
  releaseManifestFetchSchema,
  releaseManifestUploadSchema,
} from "./contracts.js"
import { createAppOAuthService } from "./oauth-service.js"
import { type AppsServiceOptions, createAppsService } from "./service.js"
import { createAppSessionTokenService } from "./session-token-service.js"
import { listAppWebhookHealth, replayAppWebhookDelivery } from "./webhook-delivery.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const appIdParamSchema = z.object({ appId: z.string().min(1) })
const installationIdParamSchema = z.object({ installationId: z.string().min(1) })

export interface AppsAdminRouteOptions extends AppsServiceOptions {
  oauth?: {
    accessCatalog: AccessCatalog
    deploymentId: string
  }
  /**
   * Enables the iframe session-token broker. Requires {@link oauth} for the
   * deployment audience and the actor-token-exchange primitive. `secret` is the
   * root secret the signing key is HKDF-derived from.
   */
  sessionToken?: {
    secret: string
    ttlSeconds?: number
  }
}

export function createAppsAdminRoutes(options: AppsAdminRouteOptions = {}) {
  const routes = new Hono<Env>()
  const service = createAppsService(options)
  const oauth = options.oauth ? createAppOAuthService(options.oauth) : null
  const sessionTokens =
    oauth && options.oauth && options.sessionToken
      ? createAppSessionTokenService({
          secret: options.sessionToken.secret,
          ttlSeconds: options.sessionToken.ttlSeconds,
          deploymentId: options.oauth.deploymentId,
          oauth,
        })
      : null

  routes.get("/", async (c) => {
    const query = parseQuery(c, appListQuerySchema)
    return c.json(await service.list(c.get("db"), query), 200)
  })

  routes.post("/", async (c) => {
    const body = await parseJsonBody(c, createCustomAppRegistrationSchema)
    const app = await service.createCustomApp(c.get("db"), body)
    return c.json({ data: app }, 201)
  })

  // Consent approval mutates state (installation, grants, authorization code),
  // so it must never be reachable through read-scoped GET requests. The admin
  // consent UI submits the approval and performs the redirect itself.
  routes.post("/oauth/authorize", async (c) => {
    if (!oauth) return c.json({ error: "App OAuth is not configured" }, 501)
    const body = await parseJsonBody(c, appOAuthAuthorizeQuerySchema)
    const result = await oauth.authorize(c.get("db"), {
      appId: body.client_id,
      releaseId: body.release_id,
      redirectUri: body.redirect_uri,
      state: body.state,
      codeChallenge: body.code_challenge,
      codeChallengeMethod: body.code_challenge_method,
      actorId: body.actor_id,
      operatorGrantedScopes: splitScopes(body.operator_scopes),
      grantedOptionalScopes: splitScopes(body.optional_scopes),
    })
    const redirectUrl = new URL(result.redirectUri)
    redirectUrl.searchParams.set("code", result.code)
    redirectUrl.searchParams.set("state", result.state)
    return c.json({ data: { redirectUrl: redirectUrl.toString(), state: result.state } }, 200)
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

  // Staff-authenticated: the admin host requests a short-lived session token for
  // the current viewer + entity/slot context. The viewer is taken from the
  // authenticated session, never from the frame.
  routes.post("/installations/:installationId/session-token", async (c) => {
    if (!sessionTokens) return c.json({ error: "App session tokens are not configured" }, 501)
    const { installationId } = parseInstallationParams(c.req.param())
    const viewerId = requireUserId(c)
    const body = await parseJsonBody(c, appSessionTokenIssueSchema)
    const issued = await sessionTokens.issue(c.get("db"), {
      installationId,
      viewerId,
      entity: body.entity ?? null,
      slot: body.slot ?? null,
    })
    return c.json({ data: issued }, 201)
  })

  // App-backend-facing: exchange a presented session token for online actor
  // access. Client-authenticated; bounded by viewer ∩ app grants.
  routes.post("/oauth/session-token/exchange", async (c) => {
    if (!sessionTokens) return c.json({ error: "App session tokens are not configured" }, 501)
    const body = await parseJsonBody(c, appSessionTokenExchangeSchema)
    const token = await sessionTokens.exchange(c.get("db"), {
      token: body.session_token,
      clientId: body.client_id,
      clientSecret: body.client_secret,
      viewerScopes: body.viewer_scopes,
      contextualScopes: body.contextual_scopes,
    })
    return c.json(token, 200)
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

  routes.get("/installations/:installationId/webhooks", async (c) => {
    const { installationId } = parseInstallationParams(c.req.param())
    return c.json(await listAppWebhookHealth(c.get("db"), installationId), 200)
  })

  routes.post("/installations/:installationId/webhooks/replay", async (c) => {
    parseInstallationParams(c.req.param())
    const body = await parseJsonBody(c, appWebhookReplaySchema)
    const delivery = await replayAppWebhookDelivery(c.get("db"), {
      deliveryId: body.deliveryId,
      actorId: body.actorId,
      signingKey: { id: body.signingKeyId, secret: body.signingSecret },
    })
    return c.json({ data: delivery }, 202)
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

function parseInstallationParams(input: Record<string, string | undefined>) {
  const parsed = installationIdParamSchema.safeParse(input)
  if (!parsed.success) throw new RequestValidationError("Invalid route parameters")
  return parsed.data
}

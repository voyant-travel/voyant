import { OpenAPIHono } from "@hono/zod-openapi"
import type { EventBus } from "@voyant-travel/core/events"
import type { createCustomFieldsService } from "@voyant-travel/custom-fields"
import {
  openApiValidationHook,
  parseJsonBody,
  parseQuery,
  RequestValidationError,
  requireUserId,
} from "@voyant-travel/hono"
import {
  type AccessCatalog,
  hasApiKeyPermission,
  permissionStringsToPermissions,
} from "@voyant-travel/types/api-keys"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"
import { grantableRemoteAppScopes } from "./consent.js"
import {
  activateInstallationBodySchema,
  appCredentialRevocationSchema,
  appInstallationAuditQuerySchema,
  appInstallationListQuerySchema,
  appListQuerySchema,
  appOAuthAuthorizeQuerySchema,
  appOAuthTokenSchema,
  appSessionTokenExchangeSchema,
  appSessionTokenIssueSchema,
  appWebhookReplaySchema,
  createCustomAppRegistrationSchema,
  installAppSchema,
  lifecycleActionBodySchema,
  releaseManifestFetchSchema,
  releaseManifestUploadSchema,
} from "./contracts.js"
import {
  listAppReleases,
  listInstallationAudit,
  listInstallationSummaries,
  loadInstallationDetail,
} from "./installation-read-model.js"
import { createAppInstallationService } from "./installation-service.js"
import {
  createMarketplaceAcquisitionService,
  resolveMarketplaceInstallIntentSchema,
} from "./marketplace-acquisition.js"
import { createAppOAuthService } from "./oauth-service.js"
import {
  activateAppInstallationRoute,
  authorizeAppOAuthRoute,
  createAppReleaseRoute,
  createCustomAppRoute,
  createMarketplaceSetupHandoffRoute,
  exchangeAppSessionTokenRoute,
  fetchAppReleaseRoute,
  getAppInstallationRoute,
  getAppRoute,
  installAppRoute,
  issueAppOAuthTokenRoute,
  issueAppSessionTokenRoute,
  listAppInstallationAuditRoute,
  listAppInstallationsRoute,
  listAppReleasesRoute,
  listAppsRoute,
  listAppWebhooksRoute,
  pauseAppInstallationRoute,
  previewAppInstallationPurgeRoute,
  replayAppWebhookRoute,
  resolveMarketplaceInstallIntentRoute,
  resumeAppInstallationRoute,
  revokeAppInstallationCredentialsRoute,
  uninstallAppInstallationRoute,
} from "./routes-openapi.js"
import type {
  ManagedAppInstallationAuthority,
  ManagedMarketplaceAcquisitionResolver,
} from "./runtime-port.js"
import { type AppsServiceOptions, createAppsService } from "./service.js"
import { createAppSessionTokenService } from "./session-token-service.js"
import { listAppWebhookHealth, replayAppWebhookDelivery } from "./webhook-delivery.js"

type CustomFieldsService = ReturnType<typeof createCustomFieldsService>

type Env = {
  Variables: { db: PostgresJsDatabase; scopes?: string[] }
}

const appIdParamSchema = z.object({ appId: z.string().min(1) })
const installationIdParamSchema = z.object({ installationId: z.string().min(1) })

export interface AppsAdminRouteOptions extends AppsServiceOptions {
  oauth?: {
    accessCatalog: AccessCatalog
    deploymentId: string
    managedInstallation?: ManagedAppInstallationAuthority
    clientAuthentication?: "optional" | "required"
  }
  /**
   * Enables the iframe session-token broker. Requires {@link oauth} for the
   * deployment audience and the actor-token-exchange primitive. `secret` is the
   * root secret the signing key is HKDF-derived from.
   */
  sessionToken?: {
    secret: string
    managedInstallation?: ManagedAppInstallationAuthority
    ttlSeconds?: number
  }
  /**
   * Deployment identity used when installing over HTTP. Falls back to
   * {@link oauth}'s deployment id when omitted.
   */
  deploymentId?: string
  /** Platform API version used to gate release compatibility. */
  platformApiVersion?: string
  eventBus?: EventBus
  customFields?: CustomFieldsService
  /** Host-verified Marketplace acquisition and setup authority. */
  managedMarketplace?: ManagedMarketplaceAcquisitionResolver
}

export function createAppsAdminRoutes(options: AppsAdminRouteOptions = {}) {
  const routes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  const service = createAppsService(options)
  const marketplace = options.managedMarketplace
    ? createMarketplaceAcquisitionService({
        eventCatalog: options.eventCatalog,
        resolveAcquisitionIntent: options.managedMarketplace.resolveAcquisitionIntent,
        createSetupHandoff: options.managedMarketplace.createSetupHandoff,
      })
    : null
  const installations = createAppInstallationService({
    deploymentId: options.oauth?.deploymentId ?? options.deploymentId,
    managedInstallation: options.oauth?.managedInstallation,
    platformApiVersion: options.platformApiVersion,
    eventBus: options.eventBus,
    customFields: options.customFields,
  })
  const oauth = options.oauth ? createAppOAuthService(options.oauth) : null
  const oauthAccessCatalog = options.oauth?.accessCatalog
  const sessionTokens =
    oauth && options.oauth && options.sessionToken
      ? createAppSessionTokenService({
          secret: options.sessionToken.secret,
          ttlSeconds: options.sessionToken.ttlSeconds,
          deploymentId: options.oauth.deploymentId,
          managedInstallation:
            options.sessionToken.managedInstallation ?? options.oauth.managedInstallation,
          oauth,
        })
      : null

  routes.openapi(listAppsRoute, async (c) => {
    const query = parseQuery(c, appListQuerySchema)
    return c.json(await service.list(c.get("db"), query), 200)
  })

  routes.openapi(createCustomAppRoute, async (c) => {
    const body = await parseJsonBody(c, createCustomAppRegistrationSchema)
    const app = await service.createCustomApp(c.get("db"), body)
    return c.json({ data: app }, 201)
  })

  // Consent approval mutates state (installation, grants, authorization code),
  // so it must never be reachable through read-scoped GET requests. The admin
  // consent UI submits the approval and performs the redirect itself.
  routes.openapi(authorizeAppOAuthRoute, async (c) => {
    if (!oauth || !oauthAccessCatalog) {
      return c.json({ error: "App OAuth is not configured" }, 501)
    }
    const body = await parseJsonBody(c, appOAuthAuthorizeQuerySchema)
    const result = await oauth.authorize(c.get("db"), {
      appId: body.client_id,
      releaseId: body.release_id,
      redirectUri: body.redirect_uri,
      state: body.state,
      codeChallenge: body.code_challenge,
      codeChallengeMethod: body.code_challenge_method,
      actorId: requireUserId(c),
      operatorGrantedScopes: resolveOperatorGrantableRemoteAppScopes(
        c.get("scopes") ?? [],
        oauthAccessCatalog,
      ),
      grantedOptionalScopes: splitScopes(body.optional_scopes),
    })
    const redirectUrl = new URL(result.redirectUri)
    redirectUrl.searchParams.set("code", result.code)
    redirectUrl.searchParams.set("state", result.state)
    return c.json({ data: { redirectUrl: redirectUrl.toString(), state: result.state } }, 200)
  })

  routes.openapi(issueAppOAuthTokenRoute, async (c) => {
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
        : await oauth.token(c.get("db"), {
            grantType: "refresh_token",
            refreshToken: body.refresh_token,
            clientId: body.client_id,
            clientSecret: body.client_secret,
          })
    return c.json(token, 200)
  })

  routes.openapi(revokeAppInstallationCredentialsRoute, async (c) => {
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
  routes.openapi(issueAppSessionTokenRoute, async (c) => {
    if (!sessionTokens) return c.json({ error: "App session tokens are not configured" }, 501)
    const { installationId } = parseInstallationParams(c.req.param())
    const viewerId = requireUserId(c)
    const body = await parseJsonBody(c, appSessionTokenIssueSchema)
    const issued = await sessionTokens.issue(c.get("db"), {
      installationId,
      viewerId,
      viewerScopes: resolveViewerRemoteAppScopes(
        c.get("scopes") ?? [],
        options.oauth?.accessCatalog,
      ),
      entity: body.entity ?? null,
      slot: body.slot ?? null,
    })
    return c.json({ data: issued }, 201)
  })

  // App-backend-facing: exchange a presented session token for online actor
  // access. Client-authenticated; bounded by viewer ∩ app grants.
  routes.openapi(exchangeAppSessionTokenRoute, async (c) => {
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

  routes.openapi(installAppRoute, async (c) => {
    const body = await parseJsonBody(c, installAppSchema)
    // A configured managed runtime audience is authoritative so installation
    // identity cannot diverge from later OAuth token audiences. Direct/custom
    // hosts without managed auth may still supply an explicit deployment ID.
    const deploymentId = options.oauth?.deploymentId ?? body.deploymentId ?? options.deploymentId
    const result = await installations.install(c.get("db"), {
      appId: body.appId,
      releaseId: body.releaseId,
      actorId: body.actorId,
      grantedOptionalScopes: body.grantedOptionalScopes,
      updatePolicy: body.updatePolicy,
      deploymentId,
    })
    return c.json({ data: result }, 201)
  })

  routes.openapi(resolveMarketplaceInstallIntentRoute, async (c) => {
    if (!marketplace) return c.json({ error: "Managed Marketplace is not configured" }, 501)
    const body = await parseJsonBody(c, resolveMarketplaceInstallIntentSchema)
    const data = await marketplace.resolveAndAcquire(c.get("db"), {
      intent: body.intent,
      actorId: requireUserId(c),
    })
    return c.json({ data }, 201)
  })

  routes.openapi(createMarketplaceSetupHandoffRoute, async (c) => {
    if (!marketplace) return c.json({ error: "Managed Marketplace is not configured" }, 501)
    requireUserId(c)
    const { installationId } = parseInstallationParams(c.req.param())
    const data = await marketplace.createSetupHandoff(c.get("db"), installationId)
    return c.json({ data }, 201)
  })

  routes.openapi(listAppInstallationsRoute, async (c) => {
    const query = parseQuery(c, appInstallationListQuerySchema)
    return c.json(await listInstallationSummaries(c.get("db"), query), 200)
  })

  routes.openapi(getAppInstallationRoute, async (c) => {
    const { installationId } = parseInstallationParams(c.req.param())
    const detail = await loadInstallationDetail(c.get("db"), installationId, {
      platformApiVersion: options.platformApiVersion,
    })
    return detail
      ? c.json({ data: detail }, 200)
      : c.json({ error: "App installation not found" }, 404)
  })

  routes.openapi(listAppInstallationAuditRoute, async (c) => {
    const { installationId } = parseInstallationParams(c.req.param())
    const query = parseQuery(c, appInstallationAuditQuerySchema)
    const data = await listInstallationAudit(c.get("db"), installationId, query.limit)
    return c.json({ data }, 200)
  })

  routes.openapi(pauseAppInstallationRoute, async (c) => {
    const { installationId } = parseInstallationParams(c.req.param())
    const body = await parseJsonBody(c, lifecycleActionBodySchema)
    const result = await installations.pause(c.get("db"), { installationId, actorId: body.actorId })
    return c.json({ data: result }, 200)
  })

  routes.openapi(resumeAppInstallationRoute, async (c) => {
    const { installationId } = parseInstallationParams(c.req.param())
    const body = await parseJsonBody(c, lifecycleActionBodySchema)
    const result = await installations.resume(c.get("db"), {
      installationId,
      actorId: body.actorId,
    })
    return c.json({ data: result }, 200)
  })

  routes.openapi(uninstallAppInstallationRoute, async (c) => {
    const { installationId } = parseInstallationParams(c.req.param())
    const body = await parseJsonBody(c, lifecycleActionBodySchema)
    const result = await installations.uninstall(c.get("db"), {
      installationId,
      actorId: body.actorId,
    })
    return c.json({ data: result }, 200)
  })

  routes.openapi(activateAppInstallationRoute, async (c) => {
    const { installationId } = parseInstallationParams(c.req.param())
    const body = await parseJsonBody(c, activateInstallationBodySchema)
    const result = await installations.upgrade(c.get("db"), {
      installationId,
      releaseId: body.releaseId,
      actorId: body.actorId,
    })
    return c.json({ data: result }, 200)
  })

  routes.openapi(previewAppInstallationPurgeRoute, async (c) => {
    const { installationId } = parseInstallationParams(c.req.param())
    const body = await parseJsonBody(c, lifecycleActionBodySchema)
    const result = await installations.purgePreview(c.get("db"), {
      installationId,
      actorId: body.actorId,
    })
    return c.json({ data: result }, 200)
  })

  routes.openapi(getAppRoute, async (c) => {
    const { appId } = parseParams(c.req.param())
    const app = await service.get(c.get("db"), appId)
    return app ? c.json({ data: app }, 200) : c.json({ error: "App not found" }, 404)
  })

  routes.openapi(listAppReleasesRoute, async (c) => {
    const { appId } = parseParams(c.req.param())
    const data = await listAppReleases(c.get("db"), appId)
    return c.json({ data }, 200)
  })

  routes.openapi(createAppReleaseRoute, async (c) => {
    const { appId } = parseParams(c.req.param())
    const body = await parseJsonBody(c, releaseManifestUploadSchema)
    const result = await service.releaseFromUpload(c.get("db"), appId, body)
    return c.json({ data: result.release, digest: result.digest, created: result.created }, 201)
  })

  routes.openapi(fetchAppReleaseRoute, async (c) => {
    const { appId } = parseParams(c.req.param())
    const body = await parseJsonBody(c, releaseManifestFetchSchema)
    const result = await service.releaseFromFetch(c.get("db"), appId, body)
    return c.json({ data: result.release, digest: result.digest, created: result.created }, 201)
  })

  routes.openapi(listAppWebhooksRoute, async (c) => {
    const { installationId } = parseInstallationParams(c.req.param())
    return c.json(await listAppWebhookHealth(c.get("db"), installationId), 200)
  })

  routes.openapi(replayAppWebhookRoute, async (c) => {
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

export function resolveViewerRemoteAppScopes(
  scopes: readonly string[],
  catalog: AccessCatalog | undefined,
) {
  if (!catalog) return []
  const permissions = permissionStringsToPermissions(scopes)
  return catalog.resources
    .flatMap((resource) =>
      resource.actions
        .filter(
          (action) =>
            (resource.remoteSafe || action.remoteSafe) &&
            hasApiKeyPermission(permissions, resource.resource, action.action, catalog),
        )
        .map((action) => `${resource.resource}:${action.action}`),
    )
    .sort()
}

export function resolveOperatorGrantableRemoteAppScopes(
  scopes: readonly string[],
  catalog: AccessCatalog,
) {
  const grantable = grantableRemoteAppScopes(catalog)
  const permissions = permissionStringsToPermissions(scopes)
  return [...grantable]
    .filter((scope) => {
      const separator = scope.lastIndexOf(":")
      if (separator <= 0) return false
      return hasApiKeyPermission(
        permissions,
        scope.slice(0, separator),
        scope.slice(separator + 1),
        catalog,
      )
    })
    .sort()
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

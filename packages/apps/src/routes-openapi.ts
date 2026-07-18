import { createRoute, z } from "@hono/zod-openapi"
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

const appIdParamSchema = z.object({ appId: z.string().min(1) })
const installationIdParamSchema = z.object({ installationId: z.string().min(1) })
const errorSchema = z.object({ error: z.string() })
const dataEnvelopeSchema = z.object({ data: z.unknown() })
const listEnvelopeSchema = z.object({
  data: z.array(z.unknown()),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})
const releaseCreateResponseSchema = z.object({
  data: z.unknown(),
  digest: z.string(),
  created: z.boolean(),
})
const oauthRedirectResponseSchema = z.object({
  data: z.object({ redirectUrl: z.string().url(), state: z.string() }),
})
const tokenResponseSchema = z.record(z.string(), z.unknown())
const credentialRevocationResponseSchema = z.object({
  installationId: z.string(),
  generation: z.number(),
})

const jsonContent = <T extends z.ZodTypeAny>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
})

const requiredJsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
})

export const listAppsRoute = createRoute({
  method: "get",
  path: "/",
  request: { query: appListQuerySchema },
  responses: { 200: jsonContent(listEnvelopeSchema, "Paginated app registrations") },
})

export const createCustomAppRoute = createRoute({
  method: "post",
  path: "/",
  request: { body: requiredJsonBody(createCustomAppRegistrationSchema) },
  responses: {
    201: jsonContent(dataEnvelopeSchema, "Created custom app registration"),
    409: jsonContent(errorSchema, "Duplicate app registration"),
  },
})

export const authorizeAppOAuthRoute = createRoute({
  method: "post",
  path: "/oauth/authorize",
  request: { body: requiredJsonBody(appOAuthAuthorizeQuerySchema) },
  responses: {
    200: jsonContent(oauthRedirectResponseSchema, "OAuth authorization redirect target"),
    501: jsonContent(errorSchema, "App OAuth is not configured"),
  },
})

export const issueAppOAuthTokenRoute = createRoute({
  method: "post",
  path: "/oauth/token",
  request: { body: requiredJsonBody(appOAuthTokenSchema) },
  responses: {
    200: jsonContent(tokenResponseSchema, "OAuth token response"),
    501: jsonContent(errorSchema, "App OAuth is not configured"),
  },
})

export const revokeAppInstallationCredentialsRoute = createRoute({
  method: "post",
  path: "/oauth/revoke-installation",
  request: { body: requiredJsonBody(appCredentialRevocationSchema) },
  responses: {
    200: jsonContent(
      credentialRevocationResponseSchema,
      "Revoked installation credential generation",
    ),
    501: jsonContent(errorSchema, "App OAuth is not configured"),
  },
})

export const issueAppSessionTokenRoute = createRoute({
  method: "post",
  path: "/installations/{installationId}/session-token",
  request: {
    params: installationIdParamSchema,
    body: requiredJsonBody(appSessionTokenIssueSchema),
  },
  responses: {
    201: jsonContent(dataEnvelopeSchema, "Issued app session token"),
    501: jsonContent(errorSchema, "App session tokens are not configured"),
  },
})

export const exchangeAppSessionTokenRoute = createRoute({
  method: "post",
  path: "/oauth/session-token/exchange",
  request: { body: requiredJsonBody(appSessionTokenExchangeSchema) },
  responses: {
    200: jsonContent(tokenResponseSchema, "Online app token response"),
    501: jsonContent(errorSchema, "App session tokens are not configured"),
  },
})

export const installAppRoute = createRoute({
  method: "post",
  path: "/install",
  request: { body: requiredJsonBody(installAppSchema) },
  responses: { 201: jsonContent(dataEnvelopeSchema, "Installed app") },
})

export const listAppInstallationsRoute = createRoute({
  method: "get",
  path: "/installations",
  request: { query: appInstallationListQuerySchema },
  responses: { 200: jsonContent(listEnvelopeSchema, "Paginated app installations") },
})

export const getAppInstallationRoute = createRoute({
  method: "get",
  path: "/installations/{installationId}",
  request: { params: installationIdParamSchema },
  responses: {
    200: jsonContent(dataEnvelopeSchema, "App installation detail"),
    404: jsonContent(errorSchema, "App installation not found"),
  },
})

export const listAppInstallationAuditRoute = createRoute({
  method: "get",
  path: "/installations/{installationId}/audit",
  request: { params: installationIdParamSchema, query: appInstallationAuditQuerySchema },
  responses: { 200: jsonContent(dataEnvelopeSchema, "App installation audit events") },
})

export const pauseAppInstallationRoute = createRoute({
  method: "post",
  path: "/installations/{installationId}/pause",
  request: { params: installationIdParamSchema, body: requiredJsonBody(lifecycleActionBodySchema) },
  responses: { 200: jsonContent(dataEnvelopeSchema, "Paused app installation") },
})

export const resumeAppInstallationRoute = createRoute({
  method: "post",
  path: "/installations/{installationId}/resume",
  request: { params: installationIdParamSchema, body: requiredJsonBody(lifecycleActionBodySchema) },
  responses: { 200: jsonContent(dataEnvelopeSchema, "Resumed app installation") },
})

export const uninstallAppInstallationRoute = createRoute({
  method: "post",
  path: "/installations/{installationId}/uninstall",
  request: { params: installationIdParamSchema, body: requiredJsonBody(lifecycleActionBodySchema) },
  responses: { 200: jsonContent(dataEnvelopeSchema, "Uninstalled app installation") },
})

export const activateAppInstallationRoute = createRoute({
  method: "post",
  path: "/installations/{installationId}/activate",
  request: {
    params: installationIdParamSchema,
    body: requiredJsonBody(activateInstallationBodySchema),
  },
  responses: { 200: jsonContent(dataEnvelopeSchema, "Activated app installation release") },
})

export const previewAppInstallationPurgeRoute = createRoute({
  method: "post",
  path: "/installations/{installationId}/purge-preview",
  request: { params: installationIdParamSchema, body: requiredJsonBody(lifecycleActionBodySchema) },
  responses: { 200: jsonContent(dataEnvelopeSchema, "App installation purge preview") },
})

export const getAppRoute = createRoute({
  method: "get",
  path: "/{appId}",
  request: { params: appIdParamSchema },
  responses: {
    200: jsonContent(dataEnvelopeSchema, "App registration"),
    404: jsonContent(errorSchema, "App not found"),
  },
})

export const listAppReleasesRoute = createRoute({
  method: "get",
  path: "/{appId}/releases",
  request: { params: appIdParamSchema },
  responses: { 200: jsonContent(dataEnvelopeSchema, "App releases") },
})

export const createAppReleaseRoute = createRoute({
  method: "post",
  path: "/{appId}/releases",
  request: { params: appIdParamSchema, body: requiredJsonBody(releaseManifestUploadSchema) },
  responses: { 201: jsonContent(releaseCreateResponseSchema, "Created app release") },
})

export const fetchAppReleaseRoute = createRoute({
  method: "post",
  path: "/{appId}/releases/fetch",
  request: { params: appIdParamSchema, body: requiredJsonBody(releaseManifestFetchSchema) },
  responses: { 201: jsonContent(releaseCreateResponseSchema, "Fetched app release") },
})

export const listAppWebhooksRoute = createRoute({
  method: "get",
  path: "/installations/{installationId}/webhooks",
  request: { params: installationIdParamSchema },
  responses: { 200: jsonContent(dataEnvelopeSchema, "App webhook delivery health") },
})

export const replayAppWebhookRoute = createRoute({
  method: "post",
  path: "/installations/{installationId}/webhooks/replay",
  request: { params: installationIdParamSchema, body: requiredJsonBody(appWebhookReplaySchema) },
  responses: { 202: jsonContent(dataEnvelopeSchema, "Replayed app webhook delivery") },
})

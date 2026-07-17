import { parseJsonBody, parseQuery, RequestValidationError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"
import {
  appListQuerySchema,
  appWebhookReplaySchema,
  createCustomAppRegistrationSchema,
  releaseManifestFetchSchema,
  releaseManifestUploadSchema,
} from "./contracts.js"
import { type AppsServiceOptions, createAppsService } from "./service.js"
import { listAppWebhookHealth, replayAppWebhookDelivery } from "./webhook-delivery.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const appIdParamSchema = z.object({ appId: z.string().min(1) })
const installationIdParamSchema = z.object({ installationId: z.string().min(1) })

export function createAppsAdminRoutes(options: AppsServiceOptions = {}) {
  const routes = new Hono<Env>()
  const service = createAppsService(options)

  routes.get("/", async (c) => {
    const query = parseQuery(c, appListQuerySchema)
    return c.json(await service.list(c.get("db"), query), 200)
  })

  routes.post("/", async (c) => {
    const body = await parseJsonBody(c, createCustomAppRegistrationSchema)
    const app = await service.createCustomApp(c.get("db"), body)
    return c.json({ data: app }, 201)
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

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { VoyantDb } from "@voyant-travel/hono"
import {
  ApiHttpError,
  ForbiddenApiError,
  openApiValidationHook,
  parseJsonBody,
  parseOptionalJsonBody,
  parseQuery,
  RequestValidationError,
  requireUserId,
} from "@voyant-travel/hono"
import { hasApiKeyPermission, permissionStringsToPermissions } from "@voyant-travel/types/api-keys"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  webhookDeliveryListQuerySchema,
  webhookSubscriptionCreateSchema,
  webhookSubscriptionTestSchema,
  webhookSubscriptionUpdateSchema,
} from "./admin-contracts.js"
import {
  createOperatorWebhookAdminService,
  type OperatorWebhookAdminService,
  OperatorWebhookRequestError,
} from "./admin-service.js"
import type { ExternalWebhookEventContract } from "./contracts.js"
import { createPostgresOperatorWebhookAdminStore } from "./postgres-store.js"

const API_ID = "@voyant-travel/webhook-delivery#api.admin"
const idParams = z.object({ id: z.string().min(1).max(128) })
const dataResponse = z.object({ data: z.any() })
const errorResponse = z.object({ error: z.string() })
const json = (description: string) => ({
  description,
  content: { "application/json": { schema: dataResponse } },
})
const errors = {
  400: {
    description: "Invalid request",
    content: { "application/json": { schema: errorResponse } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: errorResponse } },
  },
  403: {
    description: "Permission required",
    content: { "application/json": { schema: errorResponse } },
  },
  409: {
    description: "Webhook state does not allow the operation",
    content: { "application/json": { schema: errorResponse } },
  },
  404: {
    description: "Webhook resource not found",
    content: { "application/json": { schema: errorResponse } },
  },
} as const

type Env = {
  Bindings: Record<string, unknown>
  Variables: { db: VoyantDb; userId?: string; scopes?: string[] }
}

export interface CreateOperatorWebhookAdminRoutesOptions {
  contracts: readonly ExternalWebhookEventContract[]
  service?: OperatorWebhookAdminService
}

export function createOperatorWebhookAdminRoutes(
  options: CreateOperatorWebhookAdminRoutesOptions,
): OpenAPIHono<Env> {
  const routes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  const service = (c: { get(name: "db"): VoyantDb }) =>
    options.service ??
    createOperatorWebhookAdminService({
      contracts: options.contracts,
      store: createPostgresOperatorWebhookAdminStore(c.get("db") as PostgresJsDatabase),
    })
  const authenticate = (c: Parameters<typeof requireUserId>[0]) => {
    requireUserId(c)
  }
  const authorize = (
    c: Parameters<typeof requireUserId>[0],
    action: "read" | "write" | "delete",
  ) => {
    authenticate(c)
    if (
      !hasApiKeyPermission(
        permissionStringsToPermissions(c.get("scopes") ?? []),
        "webhooks",
        action,
      )
    ) {
      throw new ForbiddenApiError()
    }
  }

  routes.openapi(
    createRoute({
      method: "get",
      path: "/events",
      operationId: "listOperatorWebhookEvents",
      "x-voyant-api-id": API_ID,
      responses: {
        200: json("Graph-selected outbound event catalog"),
        401: errors[401],
        403: errors[403],
      },
    }),
    (c) => {
      authorize(c, "read")
      return c.json({ data: service(c).listEvents() }, 200)
    },
  )

  routes.openapi(
    createRoute({
      method: "get",
      path: "/subscriptions",
      operationId: "listOperatorWebhookSubscriptions",
      "x-voyant-api-id": API_ID,
      responses: {
        200: json("Webhook subscriptions"),
        401: errors[401],
        403: errors[403],
      },
    }),
    async (c) => {
      authorize(c, "read")
      return c.json({ data: await service(c).listSubscriptions() }, 200)
    },
  )

  routes.openapi(
    createRoute({
      method: "post",
      path: "/subscriptions",
      operationId: "createOperatorWebhookSubscription",
      "x-voyant-api-id": API_ID,
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: webhookSubscriptionCreateSchema } },
        },
      },
      responses: {
        201: json("Created subscription and one-time secret"),
        400: errors[400],
        401: errors[401],
        403: errors[403],
        404: errors[404],
      },
    }),
    async (c) => {
      authorize(c, "write")
      const input = await parseJsonBody(c, webhookSubscriptionCreateSchema)
      return c.json({ data: await webhookRequest(() => service(c).createSubscription(input)) }, 201)
    },
  )

  routes.openapi(
    createRoute({
      method: "get",
      path: "/subscriptions/{id}",
      operationId: "getOperatorWebhookSubscription",
      "x-voyant-api-id": API_ID,
      request: { params: idParams },
      responses: {
        200: json("Webhook subscription"),
        401: errors[401],
        403: errors[403],
        404: errors[404],
      },
    }),
    async (c) => {
      authorize(c, "read")
      const row = await service(c).getSubscription(c.req.param("id"))
      return row
        ? c.json({ data: row }, 200)
        : c.json({ error: "Webhook subscription not found" }, 404)
    },
  )

  routes.openapi(
    createRoute({
      method: "patch",
      path: "/subscriptions/{id}",
      operationId: "updateOperatorWebhookSubscription",
      "x-voyant-api-id": API_ID,
      request: {
        params: idParams,
        body: {
          required: true,
          content: { "application/json": { schema: webhookSubscriptionUpdateSchema } },
        },
      },
      responses: {
        200: json("Updated webhook subscription"),
        400: errors[400],
        401: errors[401],
        403: errors[403],
        404: errors[404],
      },
    }),
    async (c) => {
      authorize(c, "write")
      const input = await parseJsonBody(c, webhookSubscriptionUpdateSchema)
      const row = await webhookRequest(() =>
        service(c).updateSubscription(c.req.param("id"), input),
      )
      return row
        ? c.json({ data: row }, 200)
        : c.json({ error: "Webhook subscription not found" }, 404)
    },
  )

  routes.openapi(
    createRoute({
      method: "delete",
      path: "/subscriptions/{id}",
      operationId: "deleteOperatorWebhookSubscription",
      "x-voyant-api-id": API_ID,
      request: { params: idParams },
      responses: {
        204: { description: "Webhook subscription deleted" },
        401: errors[401],
        403: errors[403],
        404: errors[404],
      },
    }),
    async (c) => {
      authorize(c, "delete")
      return (await service(c).deleteSubscription(c.req.param("id")))
        ? c.body(null, 204)
        : c.json({ error: "Webhook subscription not found" }, 404)
    },
  )

  for (const active of [true, false] as const) {
    const action = active ? "enable" : "disable"
    routes.openapi(
      createRoute({
        method: "post",
        path: `/subscriptions/{id}/${action}`,
        operationId: `${action}OperatorWebhookSubscription`,
        "x-voyant-api-id": API_ID,
        request: { params: idParams },
        responses: {
          200: json(`${active ? "Enabled" : "Disabled"} webhook subscription`),
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      }),
      async (c) => {
        authorize(c, "write")
        const row = await service(c).setSubscriptionActive(c.req.param("id"), active)
        return row
          ? c.json({ data: row }, 200)
          : c.json({ error: "Webhook subscription not found" }, 404)
      },
    )
  }

  routes.openapi(
    createRoute({
      method: "post",
      path: "/subscriptions/{id}/rotate-secret",
      operationId: "rotateOperatorWebhookSubscriptionSecret",
      "x-voyant-api-id": API_ID,
      request: { params: idParams },
      responses: {
        200: json("Updated subscription and one-time secret"),
        401: errors[401],
        403: errors[403],
        404: errors[404],
      },
    }),
    async (c) => {
      authorize(c, "write")
      const result = await service(c).rotateSubscriptionSecret(c.req.param("id"))
      return result
        ? c.json({ data: result }, 200)
        : c.json({ error: "Webhook subscription not found" }, 404)
    },
  )

  routes.openapi(
    createRoute({
      method: "post",
      path: "/subscriptions/{id}/test",
      operationId: "testOperatorWebhookSubscription",
      "x-voyant-api-id": API_ID,
      request: {
        params: idParams,
        body: {
          required: false,
          content: { "application/json": { schema: webhookSubscriptionTestSchema } },
        },
      },
      responses: {
        202: json("Queued test delivery"),
        400: errors[400],
        401: errors[401],
        403: errors[403],
        409: errors[409],
        404: errors[404],
      },
    }),
    async (c) => {
      authorize(c, "write")
      const input = await parseOptionalJsonBody(c, webhookSubscriptionTestSchema)
      const delivery = await webhookRequest(() =>
        service(c).testSubscription(c.req.param("id"), input),
      )
      return delivery
        ? c.json({ data: delivery }, 202)
        : c.json({ error: "Webhook subscription not found" }, 404)
    },
  )

  routes.openapi(
    createRoute({
      method: "get",
      path: "/deliveries",
      operationId: "listOperatorWebhookDeliveries",
      "x-voyant-api-id": API_ID,
      request: { query: webhookDeliveryListQuerySchema },
      responses: {
        200: json("Subscription delivery history"),
        401: errors[401],
        403: errors[403],
      },
    }),
    async (c) => {
      authorize(c, "read")
      const query = parseQuery(c, webhookDeliveryListQuerySchema)
      return c.json({ data: await service(c).listDeliveries(query) }, 200)
    },
  )

  routes.openapi(
    createRoute({
      method: "get",
      path: "/deliveries/{id}",
      operationId: "getOperatorWebhookDelivery",
      "x-voyant-api-id": API_ID,
      request: { params: idParams },
      responses: {
        200: json("Subscription delivery detail"),
        401: errors[401],
        403: errors[403],
        404: errors[404],
      },
    }),
    async (c) => {
      authorize(c, "read")
      const delivery = await service(c).getDelivery(c.req.param("id"))
      return delivery
        ? c.json({ data: delivery }, 200)
        : c.json({ error: "Webhook delivery not found" }, 404)
    },
  )

  routes.openapi(
    createRoute({
      method: "post",
      path: "/deliveries/{id}/replay",
      operationId: "replayOperatorWebhookDelivery",
      "x-voyant-api-id": API_ID,
      request: { params: idParams },
      responses: {
        202: json("Queued replay delivery"),
        401: errors[401],
        403: errors[403],
        409: errors[409],
        404: errors[404],
      },
    }),
    async (c) => {
      authorize(c, "write")
      const delivery = await webhookRequest(() => service(c).replayDelivery(c.req.param("id")))
      return delivery
        ? c.json({ data: delivery }, 202)
        : c.json({ error: "Webhook delivery cannot be replayed" }, 404)
    },
  )

  return routes
}

async function webhookRequest<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof OperatorWebhookRequestError)) throw error
    if (error.code === "invalid_subscription") {
      throw new RequestValidationError(error.message)
    }
    throw new ApiHttpError(error.message, { status: 409, code: error.code })
  }
}

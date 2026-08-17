import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { ModuleContainer } from "@voyant-travel/core"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { notificationChannelAccountSchema } from "./response-schemas.js"
import type { NotificationChannelAccount } from "./schema.js"
import {
  getChannelAccount,
  listChannelAccounts,
  updateChannelAccountLifecycle,
  validateChannelAccount,
} from "./service-channel-accounts.js"
import type { NotificationProvider } from "./types.js"
import { updateChannelAccountLifecycleSchema } from "./validation.js"

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    container: ModuleContainer
    db: PostgresJsDatabase
    userId?: string
  }
}

type ChannelAccountRouteContext = {
  env: Record<string, unknown>
  var: { container: ModuleContainer }
}

export type NotificationChannelAccountRoutesOptions = {
  resolveProviders: (context: ChannelAccountRouteContext) => ReadonlyArray<NotificationProvider>
}

const errorResponseSchema = z.object({ error: z.string() })
const idParamSchema = z.object({ id: z.string() })
const dataEnvelope = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })

const invalidRequestResponse = {
  description: "invalid_request: request body failed validation",
  content: { "application/json": { schema: errorResponseSchema } },
} as const

const notFoundResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorResponseSchema } },
})

function toChannelAccountResponse({
  adapterRef: _adapterRef,
  ...account
}: NotificationChannelAccount) {
  return account
}

export function createNotificationChannelAccountRoutes(
  options: NotificationChannelAccountRoutesOptions,
): OpenAPIHono<Env> {
  const listChannelAccountsRoute = createRoute({
    method: "get",
    path: "/channel-accounts",
    responses: {
      200: {
        description: "Credential-free Channel Account identities and health",
        content: {
          "application/json": { schema: dataEnvelope(z.array(notificationChannelAccountSchema)) },
        },
      },
    },
  })

  const getChannelAccountRoute = createRoute({
    method: "get",
    path: "/channel-accounts/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "A credential-free Channel Account",
        content: { "application/json": { schema: dataEnvelope(notificationChannelAccountSchema) } },
      },
      404: notFoundResponse("Channel Account not found"),
    },
  })

  const validateChannelAccountRoute = createRoute({
    method: "post",
    path: "/channel-accounts/{id}/validate",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "Channel Account health refreshed through its runtime adapter",
        content: { "application/json": { schema: dataEnvelope(notificationChannelAccountSchema) } },
      },
      400: invalidRequestResponse,
      404: notFoundResponse("Channel Account not found"),
    },
  })

  const updateChannelAccountLifecycleRoute = createRoute({
    method: "patch",
    path: "/channel-accounts/{id}/lifecycle",
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: { "application/json": { schema: updateChannelAccountLifecycleSchema } },
      },
    },
    responses: {
      200: {
        description: "Channel Account lifecycle updated",
        content: { "application/json": { schema: dataEnvelope(notificationChannelAccountSchema) } },
      },
      400: invalidRequestResponse,
      404: notFoundResponse("Channel Account not found"),
    },
  })

  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(listChannelAccountsRoute, async (c) => {
      const rows = await listChannelAccounts(c.get("db"))
      return c.json({ data: rows.map(toChannelAccountResponse) }, 200)
    })
    .openapi(getChannelAccountRoute, async (c) => {
      const row = await getChannelAccount(c.get("db"), c.req.valid("param").id)
      return row
        ? c.json({ data: toChannelAccountResponse(row) }, 200)
        : c.json({ error: "Channel Account not found" }, 404)
    })
    .openapi(validateChannelAccountRoute, async (c) => {
      try {
        const row = await validateChannelAccount(
          c.get("db"),
          options.resolveProviders(c),
          c.req.valid("param").id,
        )
        return row
          ? c.json({ data: toChannelAccountResponse(row) }, 200)
          : c.json({ error: "Channel Account not found" }, 404)
      } catch {
        return c.json({ error: "Channel Account validation failed" }, 400)
      }
    })
    .openapi(updateChannelAccountLifecycleRoute, async (c) => {
      try {
        const row = await updateChannelAccountLifecycle(
          c.get("db"),
          c.req.valid("param").id,
          c.req.valid("json").lifecycle,
        )
        return row
          ? c.json({ data: toChannelAccountResponse(row) }, 200)
          : c.json({ error: "Channel Account not found" }, 404)
      } catch {
        return c.json({ error: "Invalid Channel Account lifecycle transition" }, 400)
      }
    })
}

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { EventBus, ModuleContainer } from "@voyant-travel/core"
import { openApiValidationHook, parseOptionalJsonBody } from "@voyant-travel/hono"

import {
  buildFinanceRouteRuntime,
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
  type FinanceRouteRuntime,
} from "./route-runtime.js"
import { financeSettlementService, type InvoiceSettlementPoller } from "./service-settlement.js"
import {
  polledInvoiceSettlementResultSchema,
  pollInvoiceSettlementInputSchema,
} from "./validation.js"

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    container: ModuleContainer
    db: import("drizzle-orm/postgres-js").PostgresJsDatabase
    userId?: string
  }
}

export interface FinanceSettlementRouteOptions {
  invoiceSettlementPollers?: Record<string, InvoiceSettlementPoller>
  resolveInvoiceSettlementPollers?: (
    bindings: Record<string, unknown>,
  ) => Record<string, InvoiceSettlementPoller> | undefined
  eventBus?: EventBus
  resolveEventBus?: (bindings: Record<string, unknown>) => EventBus | undefined
}

function getRuntime(
  options: FinanceSettlementRouteOptions | undefined,
  bindings: Record<string, unknown>,
  resolveFromContainer?: (key: string) => FinanceRouteRuntime | undefined,
) {
  return (
    resolveFromContainer?.(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY) ??
    buildFinanceRouteRuntime(bindings, options)
  )
}

const errorResponseSchema = z.object({ error: z.string() })

// The optional poll body is parsed in-handler (`parseOptionalJsonBody`) so a
// missing/empty body stays valid — the route declares only the path param +
// response envelopes.
const pollInvoiceSettlementRoute = createRoute({
  method: "post",
  path: "/invoices/{id}/poll-settlement",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Polled settlement result (external-ref sync + optional payment reconciliation)",
      content: {
        "application/json": { schema: z.object({ data: polledInvoiceSettlementResultSchema }) },
      },
    },
    404: {
      description: "Invoice not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export function createFinanceAdminSettlementRoutes(options: FinanceSettlementRouteOptions = {}) {
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook }).openapi(
    pollInvoiceSettlementRoute,
    async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))

      const result = await financeSettlementService.pollInvoiceSettlement(
        c.get("db"),
        c.req.valid("param").id,
        await parseOptionalJsonBody(c, pollInvoiceSettlementInputSchema),
        {
          bindings: c.env,
          invoiceSettlementPollers: runtime.invoiceSettlementPollers,
          eventBus: runtime.eventBus,
        },
      )

      // The not_found sentinel is the only union member carrying a `status`
      // key, so `"status" in result` cleanly narrows it out for the 200 path.
      if ("status" in result) {
        return c.json({ error: "Invoice not found" }, 404)
      }

      return c.json({ data: result }, 200)
    },
  )
}

export type { InvoiceSettlementPoller } from "./service-settlement.js"

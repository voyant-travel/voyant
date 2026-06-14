import type { EventBus, ModuleContainer } from "@voyant-travel/core"
import { parseOptionalJsonBody } from "@voyant-travel/hono"
import { Hono } from "hono"

import {
  buildFinanceRouteRuntime,
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
  type FinanceRouteRuntime,
} from "./route-runtime.js"
import { financeSettlementService, type InvoiceSettlementPoller } from "./service-settlement.js"
import { pollInvoiceSettlementInputSchema } from "./validation.js"

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

export function createFinanceAdminSettlementRoutes(options: FinanceSettlementRouteOptions = {}) {
  return new Hono<Env>().post("/invoices/:id/poll-settlement", async (c) => {
    const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))

    const result = await financeSettlementService.pollInvoiceSettlement(
      c.get("db"),
      c.req.param("id"),
      await parseOptionalJsonBody(c, pollInvoiceSettlementInputSchema),
      {
        bindings: c.env,
        invoiceSettlementPollers: runtime.invoiceSettlementPollers,
        eventBus: runtime.eventBus,
      },
    )

    if ("status" in result && result.status === "not_found") {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: result })
  })
}

export type { InvoiceSettlementPoller } from "./service-settlement.js"

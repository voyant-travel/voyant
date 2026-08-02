import { OpenAPIHono } from "@hono/zod-openapi"
import type { Module, ModuleContainer } from "@voyant-travel/core"
import {
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
  type FinanceRouteRuntime,
} from "@voyant-travel/finance"
import type { ApiModule } from "@voyant-travel/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { SmartbillPluginOptions } from "./plugin.js"
import { syncSmartbillInvoice } from "./sync.js"

export const SMARTBILL_OPENAPI_API_ID = "@voyant-travel/plugin-smartbill#api.admin"

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    container?: ModuleContainer
    db: PostgresJsDatabase
    userId?: string
  }
}

export interface SmartbillAdminModuleOptions {
  pluginOptions: SmartbillPluginOptions | SmartbillPluginOptionsResolver
}

export type SmartbillPluginOptionsResolver = (
  bindings: Record<string, unknown>,
) => SmartbillPluginOptions

export interface SmartbillAdminRouteRuntime {
  pluginOptions: SmartbillPluginOptions
}

export const SMARTBILL_ADMIN_RUNTIME_CONTAINER_KEY = "providers.smartbill.adminRuntime"

export function createSmartbillAdminRoutes(options: SmartbillAdminModuleOptions) {
  const hono = new OpenAPIHono<Env>()
  hono.post("/invoices/:id/sync", async (c) => {
    try {
      const runtime = resolveSmartbillAdminRouteRuntime(c, options)
      const financeRuntime = resolveFinanceRouteRuntime(c.var.container)
      const result = await syncSmartbillInvoice({
        db: c.get("db"),
        invoiceId: c.req.param("id"),
        pluginOptions: runtime.pluginOptions,
        issueRuntime: financeRuntime,
      })

      if (result.status === "not_found") {
        return c.json({ error: "Invoice not found" }, 404)
      }
      if (result.status === "unsupported_document_type") {
        return c.json({ error: `SmartBill sync does not support ${result.invoiceType}` }, 409)
      }

      return c.json({ data: result }, result.status === "created" ? 201 : 200)
    } catch (error) {
      const message = error instanceof Error ? error.message : "SmartBill sync failed"
      return c.json({ error: message }, 502)
    }
  })

  hono.openAPIRegistry.registerPath({
    method: "post",
    path: "/invoices/{id}/sync",
    operationId: "syncSmartbillInvoice",
    summary: "Synchronize an invoice with SmartBill",
    parameters: [
      {
        in: "path",
        name: "id",
        schema: { type: "string", minLength: 1 },
        required: true,
        description: "Voyant invoice identifier.",
      },
    ],
    responses: {
      200: { description: "The existing SmartBill invoice reference was synchronized." },
      201: { description: "The invoice was created in SmartBill." },
      404: { description: "The Voyant invoice was not found." },
      409: { description: "The invoice document type is not supported by SmartBill." },
      502: { description: "SmartBill synchronization failed." },
    },
    "x-voyant-api-id": SMARTBILL_OPENAPI_API_ID,
  })

  return hono
}

export function createSmartbillAdminModule(options: SmartbillAdminModuleOptions): ApiModule {
  const module: Module = {
    name: "smartbill",
    bootstrap: ({ bindings, container }) => {
      container.register(
        SMARTBILL_ADMIN_RUNTIME_CONTAINER_KEY,
        buildSmartbillAdminRouteRuntime(bindings as Record<string, unknown>, options),
      )
    },
  }

  return {
    module,
    adminRoutes: createSmartbillAdminRoutes(options),
  }
}

export function buildSmartbillAdminRouteRuntime(
  bindings: Record<string, unknown>,
  options: SmartbillAdminModuleOptions,
): SmartbillAdminRouteRuntime {
  return {
    pluginOptions:
      typeof options.pluginOptions === "function"
        ? options.pluginOptions(bindings)
        : options.pluginOptions,
  }
}

function resolveSmartbillAdminRouteRuntime(
  c: {
    env: Record<string, unknown>
    var: { container?: ModuleContainer }
  },
  options: SmartbillAdminModuleOptions,
): SmartbillAdminRouteRuntime {
  if (c.var.container) {
    try {
      return c.var.container.resolve<SmartbillAdminRouteRuntime>(
        SMARTBILL_ADMIN_RUNTIME_CONTAINER_KEY,
      )
    } catch {
      // Fall through for tests and minimal apps that mount routes without bootstrap.
    }
  }

  return buildSmartbillAdminRouteRuntime(c.env, options)
}

function resolveFinanceRouteRuntime(container: ModuleContainer | undefined) {
  if (!container) return undefined
  try {
    const runtime = container.resolve<FinanceRouteRuntime>(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
    return {
      invoiceFxSettings: runtime.invoiceFxSettings,
      resolveInvoiceFxSettings: runtime.resolveInvoiceFxSettings,
      updateInvoiceFxSettings: runtime.updateInvoiceFxSettings,
      resolveInvoiceExchangeRate: runtime.resolveInvoiceExchangeRate,
      resolveInvoiceExchangeRateResolver: runtime.resolveInvoiceExchangeRateResolver,
      onInvoiceFxResolutionError: runtime.onInvoiceFxResolutionError,
    }
  } catch {
    return undefined
  }
}

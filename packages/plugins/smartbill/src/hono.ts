import type { Module, ModuleContainer } from "@voyant-travel/core"
import {
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
  type FinanceRouteRuntime,
} from "@voyant-travel/finance"
import type { HonoModule } from "@voyant-travel/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import type { SmartbillPluginOptions } from "./plugin.js"
import { syncSmartbillInvoice } from "./sync.js"

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
  return new Hono<Env>().post("/invoices/:id/sync", async (c) => {
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
}

export function createSmartbillAdminModule(options: SmartbillAdminModuleOptions): HonoModule {
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

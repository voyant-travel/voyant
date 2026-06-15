/**
 * Storefront checkout route module, owned by `@voyant-travel/commerce`.
 *
 * POST /checkout/start parses the BookingJourney checkout request and
 * delegates to the checkout-start service. A deployment composes this and
 * supplies the `CheckoutStartOptions` (injected tax-settings + owned-product
 * name + bank-transfer instruction readers) the service needs.
 *
 * Mount the returned Hono at `/v1/public/catalog` (relative paths).
 */

import { parseJsonBody } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import type { CheckoutStartOptions } from "./options.js"
import {
  CatalogCheckoutStartError,
  type CheckoutStartInput,
  type CheckoutStartRequestMeta,
  checkoutStartSchema,
  startCatalogCheckout,
} from "./start-service.js"

/**
 * Build the storefront checkout routes. `options` may be a value or a
 * per-request factory — the deployment passes a factory when an injected
 * option needs to capture the request `Context` (e.g. resolving a payment
 * provider runtime from the per-request container).
 */
export function createCatalogCheckoutRoutes(
  options: CheckoutStartOptions | ((c: Context) => CheckoutStartOptions),
): Hono {
  const routes = new Hono()
  routes.post("/checkout/start", (c) =>
    handleCheckoutStart(c, typeof options === "function" ? options(c) : options),
  )
  return routes
}

async function handleCheckoutStart(c: Context, options: CheckoutStartOptions): Promise<Response> {
  let body: CheckoutStartInput
  try {
    body = await parseJsonBody(c, checkoutStartSchema)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "invalid body" }, 400)
  }

  try {
    const result = await startCatalogCheckout(
      {
        db: c.get("db") as PostgresJsDatabase,
        env: c.env as Record<string, string | undefined>,
        eventBus: c.var.eventBus,
        resolveRuntime: (key) => c.var.container?.resolve(key),
        requestMeta: checkoutRequestMeta(c),
        options,
      },
      body,
    )
    return c.json(result)
  } catch (err) {
    if (err instanceof CatalogCheckoutStartError) {
      return c.json({ error: err.code }, err.status)
    }
    throw err
  }
}

function checkoutRequestMeta(c: Context): CheckoutStartRequestMeta {
  return {
    clientIp:
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "",
    userAgent: c.req.header("user-agent") ?? "",
  }
}

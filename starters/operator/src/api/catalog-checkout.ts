/**
 * Storefront checkout endpoint.
 *
 * POST /v1/public/catalog/checkout/start parses the BookingJourney
 * checkout request and delegates to the checkout-start service.
 */

import { parseJsonBody } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import {
  CatalogCheckoutStartError,
  type CheckoutStartInput,
  type CheckoutStartRequestMeta,
  checkoutStartSchema,
  startCatalogCheckout,
} from "./catalog-checkout-start-service"

export {
  CatalogCheckoutStartError,
  type CatalogCheckoutStartResult,
  type CheckoutStartInput,
  startCatalogCheckout,
} from "./catalog-checkout-start-service"

export function createCatalogCheckoutPublicRoutes(): Hono {
  const routes = new Hono()
  routes.post("/checkout/start", handleCheckoutStart)
  return routes
}

async function handleCheckoutStart(c: Context): Promise<Response> {
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
        env: c.env as CloudflareBindings & Record<string, string | undefined>,
        eventBus: c.var.eventBus,
        resolveRuntime: (key) => c.var.container?.resolve(key),
        requestMeta: checkoutRequestMeta(c),
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

import type { EventBus, Extension } from "@voyantjs/core"
import { parseJsonBody } from "@voyantjs/hono"
import type { HonoExtension } from "@voyantjs/hono/module"
import {
  appendProductMutationLedgerEntry,
  emitProductContentChanged,
  type ProductLedgerMutationAction,
} from "@voyantjs/products"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import { z } from "zod"
import { cloneProduct, composeProduct } from "./service.js"
import { productGraphSpecSchema, productRowSpecSchema } from "./spec.js"

/**
 * Catalog authoring rides on the `products` admin prefix as a HonoExtension, so
 * its routes land at `/v1/admin/products/...` without `packages/products`
 * depending on this package (which would cycle, since this package depends on
 * both products and pricing). Same mechanism as `bookingsSupplierExtension`.
 *
 *   POST /v1/admin/products/{id}/duplicate   — clone   (#1493)
 *   POST /v1/admin/products/compose          — compose (#1495)
 */

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    eventBus?: EventBus
  }
}

const duplicateBodySchema = z.object({
  name: z.string().min(1).max(255),
  status: productRowSpecSchema.shape.status.optional(),
  visibility: productRowSpecSchema.shape.visibility.optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
})

const composeBodySchema = z.object({
  spec: productGraphSpecSchema,
  idempotencyKey: z.string().min(1).max(255).optional(),
})

/** Header takes precedence over a body-supplied key. */
function idempotencyKey(
  c: { req: { header: (n: string) => string | undefined } },
  bodyKey?: string,
) {
  return c.req.header("Idempotency-Key") ?? bodyKey
}

type LedgerContext = Parameters<typeof appendProductMutationLedgerEntry>[0]

/**
 * Records the same action-ledger entry + `product.content.changed` event the
 * granular product routes emit, so a cloned/composed product is indexed and
 * audited like any other create. Only called for freshly built products (a
 * reused idempotent response created nothing new).
 */
async function recordAuthoring(
  // biome-ignore lint/suspicious/noExplicitAny: bridges this extension's Env to products' ledger Context<Env> (#1493); cast to LedgerContext below
  c: Context<any>,
  action: ProductLedgerMutationAction,
  productId: string,
) {
  await appendProductMutationLedgerEntry(c as LedgerContext, {
    action,
    productId,
    changedFields: [],
    subject: "product",
    actionName: `product.${action}`,
    routeOrToolName: action === "duplicate" ? "products.duplicate" : "products.compose",
  })
  await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "product" })
}

export const catalogAuthoringRoutes = new Hono<Env>()

  .post("/compose", async (c) => {
    const body = await parseJsonBody(c, composeBodySchema)
    const outcome = await composeProduct(c.get("db"), body.spec, {
      userId: c.get("userId"),
      idempotencyKey: idempotencyKey(c, body.idempotencyKey),
    })

    if (outcome.status === "invalid") {
      return c.json({ error: "invalid_product_graph", issues: outcome.issues }, 422)
    }

    if (!outcome.reused) {
      await recordAuthoring(c, "create", outcome.result.productId)
    }

    return c.json(
      { data: { id: outcome.result.productId, options: outcome.result.options } },
      outcome.reused ? 200 : 201,
    )
  })

  .post("/:id/duplicate", async (c) => {
    const body = await parseJsonBody(c, duplicateBodySchema)
    const outcome = await cloneProduct(c.get("db"), c.req.param("id"), body, {
      userId: c.get("userId"),
      idempotencyKey: idempotencyKey(c, body.idempotencyKey),
    })

    if (outcome.status === "not_found") {
      return c.json({ error: "Product not found" }, 404)
    }

    if (!outcome.reused) {
      await recordAuthoring(c, "duplicate", outcome.result.productId)
    }

    return c.json(
      { data: { id: outcome.result.productId, options: outcome.result.options } },
      outcome.reused ? 200 : 201,
    )
  })

const catalogAuthoringExtensionDef: Extension = {
  name: "catalog-authoring",
  module: "products",
}

export const catalogAuthoringExtension: HonoExtension = {
  extension: catalogAuthoringExtensionDef,
  adminRoutes: catalogAuthoringRoutes,
}

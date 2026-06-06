import type { EventBus, Extension } from "@voyantjs/core"
import { parseJsonBody } from "@voyantjs/hono"
import type { HonoExtension } from "@voyantjs/hono/module"
import { appendProductMutationLedgerEntry, emitProductContentChanged } from "@voyantjs/products"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import { z } from "zod"
import { composeProduct } from "./service.js"
import { productGraphSpecSchema } from "./spec.js"

/**
 * Catalog authoring rides on the `products` admin prefix as a HonoExtension, so
 * its route lands at `/v1/admin/products/...` without `packages/products`
 * depending on this package (which would cycle, since this package depends on
 * both products and pricing). Same mechanism as `bookingsSupplierExtension`.
 *
 *   POST /v1/admin/products/compose — build a new product graph from a spec (#1495)
 *
 * NOTE: deep-cloning an existing product (#1493) is deliberately NOT exposed
 * here. The operator template already serves a comprehensive deep-clone at
 * `POST /v1/admin/products/{id}/duplicate` (`duplicateProductAsDraft`); adding a
 * second handler at that path would shadow it. Composing a NEW graph is the
 * genuinely new, non-overlapping capability — it covers the cold-start /
 * never-authored-before case that clone cannot.
 */

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    eventBus?: EventBus
  }
}

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
 * granular product routes emit, so a composed product is indexed and audited
 * like any other create. Only called for freshly built products (a reused
 * idempotent response created nothing new).
 */
async function recordComposed(
  // biome-ignore lint/suspicious/noExplicitAny: bridges this extension's Env to products' ledger Context<Env> (#1495); cast to LedgerContext below
  c: Context<any>,
  productId: string,
) {
  await appendProductMutationLedgerEntry(c as LedgerContext, {
    action: "create",
    productId,
    changedFields: [],
    subject: "product",
    actionName: "product.compose",
    routeOrToolName: "products.compose",
  })
  await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "product" })
}

export const catalogAuthoringRoutes = new Hono<Env>().post("/compose", async (c) => {
  const body = await parseJsonBody(c, composeBodySchema)
  const outcome = await composeProduct(c.get("db"), body.spec, {
    userId: c.get("userId"),
    idempotencyKey: idempotencyKey(c, body.idempotencyKey),
  })

  if (outcome.status === "invalid") {
    return c.json({ error: "invalid_product_graph", issues: outcome.issues }, 422)
  }

  if (!outcome.reused) {
    await recordComposed(c, outcome.result.productId)
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

import type { EventBus, Extension } from "@voyantjs/core"
import { parseJsonBody } from "@voyantjs/hono"
import type { HonoExtension } from "@voyantjs/hono/module"
import {
  appendProductMutationLedgerEntry,
  emitProductContentChanged,
  type ProductLedgerMutationAction,
} from "@voyantjs/products"
import { productStatusEnum, productVisibilityEnum } from "@voyantjs/products/schema"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import { z } from "zod"
import { cloneProduct } from "./clone.js"
import { composeProduct } from "./service.js"
import { productGraphSpecSchema } from "./spec.js"

/**
 * Catalog authoring rides on the `products` admin prefix as a HonoExtension, so
 * its routes land at `/v1/admin/products/...` without `packages/products`
 * depending on this package (which would cycle, since this package depends on
 * both products and pricing). Same mechanism as `bookingsSupplierExtension`.
 *
 *   POST /v1/admin/products/{id}/duplicate — deep-clone a product graph (#1493)
 *   POST /v1/admin/products/compose        — build a new product graph from a spec (#1495)
 *
 * The duplicate route is the canonical product clone (it replaces the operator
 * template's previous local `duplicateProductAsDraft` route). No body → a full
 * copy named `"{X} (Copy)"` with departures (preserves the UI). The agent passes
 * `{ name, copyDepartures: false }` + an `Idempotency-Key`.
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

const duplicateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(productStatusEnum.enumValues).optional(),
  visibility: z.enum(productVisibilityEnum.enumValues).optional(),
  copyDepartures: z.boolean().optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
})

type DuplicateBody = z.infer<typeof duplicateBodySchema>

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
 * granular product routes emit, so an authored product is indexed and audited
 * like any other create. Only called for freshly built products (a reused
 * idempotent response created nothing new).
 */
async function recordAuthoring(
  // biome-ignore lint/suspicious/noExplicitAny: bridges this extension's Env to products' ledger Context<Env> (#1493/#1495); cast to LedgerContext below
  c: Context<any>,
  action: ProductLedgerMutationAction,
  productId: string,
) {
  const verb = action === "duplicate" ? "duplicate" : "compose"
  await appendProductMutationLedgerEntry(c as LedgerContext, {
    action,
    productId,
    changedFields: [],
    subject: "product",
    actionName: `product.${verb}`,
    routeOrToolName: `products.${verb}`,
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
    // The UI clones with no body; the agent sends overrides. Tolerate both.
    const raw = (await c.req.text()).trim()
    let body: DuplicateBody = {}
    if (raw.length > 0) {
      let json: unknown
      try {
        json = JSON.parse(raw)
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400)
      }
      const parsed = duplicateBodySchema.safeParse(json)
      if (!parsed.success) {
        return c.json({ error: "Invalid body", issues: parsed.error.issues }, 400)
      }
      body = parsed.data
    }

    const outcome = await cloneProduct(c.get("db"), c.req.param("id"), {
      name: body.name,
      status: body.status,
      visibility: body.visibility,
      copyDepartures: body.copyDepartures,
      userId: c.get("userId"),
      idempotencyKey: idempotencyKey(c, body.idempotencyKey),
    })

    if (outcome.status === "not_found") {
      return c.json({ error: "Product not found" }, 404)
    }

    if (!outcome.reused) {
      await recordAuthoring(c, "duplicate", outcome.product.id)
    }

    // `data` stays the full product row (the UI reads `data.id`); `options`
    // carries the cloned option/unit ids for agent follow-up calls.
    return c.json({ data: outcome.product, options: outcome.options }, outcome.reused ? 200 : 201)
  })

const catalogAuthoringExtensionDef: Extension = {
  name: "catalog-authoring",
  module: "products",
}

export const catalogAuthoringExtension: HonoExtension = {
  extension: catalogAuthoringExtensionDef,
  adminRoutes: catalogAuthoringRoutes,
}

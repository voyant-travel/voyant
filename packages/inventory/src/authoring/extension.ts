import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { EventBus, Extension } from "@voyant-travel/core"
import { openApiValidationHook, parseJsonBody } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import {
  appendProductMutationLedgerEntry,
  type ProductLedgerMutationAction,
} from "../action-ledger.js"
import { emitProductContentChanged } from "../events.js"
import { productStatusEnum, productVisibilityEnum } from "../schema.js"
import { cloneProduct } from "./clone.js"
import { composeProduct } from "./service.js"
import { productGraphSpecSchema } from "./spec.js"

/**
 * Inventory authoring rides on the `products` admin prefix as a HonoExtension, so
 * its routes land at `/v1/admin/products/...` while the implementation lives
 * with the optional Inventory package. Same mechanism as
 * `bookingsSupplierExtension`.
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

const authoringApiId = "@voyant-travel/inventory#authoring.extension.api"
const idempotencyHeadersSchema = z.object({
  "Idempotency-Key": z.string().max(255).optional(),
})

const composeProductRoute = createRoute({
  method: "post",
  path: "/compose",
  summary: "Compose a product graph",
  "x-voyant-api-id": authoringApiId,
  request: {
    headers: idempotencyHeadersSchema,
    body: {
      required: true,
      content: { "application/json": { schema: composeBodySchema } },
    },
  },
  responses: {
    200: { description: "An idempotent request reused an existing product graph" },
    201: { description: "The product graph was created" },
    422: { description: "The product graph specification is invalid" },
  },
})

const duplicateProductRoute = createRoute({
  method: "post",
  path: "/{id}/duplicate",
  summary: "Duplicate a product graph",
  "x-voyant-api-id": authoringApiId,
  request: {
    params: z.object({ id: z.string() }),
    headers: idempotencyHeadersSchema,
    body: {
      required: false,
      content: { "application/json": { schema: duplicateBodySchema } },
    },
  },
  responses: {
    200: { description: "An idempotent request reused an existing duplicate" },
    201: { description: "The product graph was duplicated" },
    400: { description: "The request body is invalid" },
    404: { description: "The source product does not exist" },
  },
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

export const inventoryAuthoringRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})

  .openapi(composeProductRoute, async (c) => {
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

  .openapi(duplicateProductRoute, async (c) => {
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

const inventoryAuthoringExtensionDef: Extension = {
  name: "inventory-authoring",
  module: "products",
  // The compose + duplicate routes run interactive transactions
  // (atomic clone of the product graph). This extension mounts under
  // /v1/admin/products, so the flag upgrades that surface to the
  // transaction-capable db client in deployments that split factories.
  requiresTransactionalDb: true,
}

export const inventoryAuthoringExtension: HonoExtension = {
  extension: inventoryAuthoringExtensionDef,
  adminRoutes: inventoryAuthoringRoutes,
}

export const catalogAuthoringRoutes = inventoryAuthoringRoutes

export const catalogAuthoringExtension: HonoExtension = {
  extension: {
    ...inventoryAuthoringExtensionDef,
    name: "catalog-authoring",
  },
  adminRoutes: inventoryAuthoringRoutes,
}

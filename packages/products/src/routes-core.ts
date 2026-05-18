import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import {
  appendProductMutationLedgerEntry,
  changedProductFields,
  listProductActionLedger,
} from "./action-ledger.js"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productCoreRoutes = new Hono<Env>()
  // GET /aggregates — dashboard KPIs (before /:id so the matcher doesn't swallow it)
  .get("/aggregates", async (c) => {
    const query = parseQuery(c, validation.productAggregatesQuerySchema)
    return c.json({ data: await productsService.getProductAggregates(c.get("db"), query) })
  })

  // GET / — List products
  .get("/", async (c) => {
    const query = parseQuery(c, validation.productListQuerySchema)
    return c.json(await productsService.listProducts(c.get("db"), query))
  })

  // POST / — Create product
  .post("/", async (c) => {
    const input = await parseJsonBody(c, validation.insertProductSchema)
    const row = await productsService.createProduct(c.get("db"), input)
    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: row.id,
      changedFields: changedProductFields(input, null, row),
    })
    await c.get("eventBus")?.emit("product.created", { id: row.id })
    return c.json({ data: row }, 201)
  })

  // GET /:id — Get single product
  .get("/:id", async (c) => {
    const row = await productsService.getProductById(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row })
  })

  // GET /:id/action-ledger — Product-scoped action timeline
  .get("/:id/action-ledger", listProductActionLedger)

  // PATCH /:id — Update product
  .patch("/:id", async (c) => {
    const productId = c.req.param("id")
    const before = await productsService.getProductById(c.get("db"), productId)
    if (!before) {
      return c.json({ error: "Product not found" }, 404)
    }

    const input = await parseJsonBody(c, validation.updateProductSchema)
    const row = await productsService.updateProduct(c.get("db"), productId, input)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.id,
      changedFields: changedProductFields(input, before, row),
    })
    await c.get("eventBus")?.emit("product.updated", { id: row.id })
    await emitProductContentChanged(c.get("eventBus"), { id: row.id, axis: "product" })
    return c.json({ data: row })
  })

  // DELETE /:id — Delete product
  .delete("/:id", async (c) => {
    const productId = c.req.param("id")
    const before = await productsService.getProductById(c.get("db"), productId)
    if (!before) {
      return c.json({ error: "Product not found" }, 404)
    }

    const row = await productsService.deleteProduct(c.get("db"), productId)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: row.id,
      changedFields: [],
    })
    await c.get("eventBus")?.emit("product.deleted", { id: row.id })
    return c.json({ success: true }, 200)
  })

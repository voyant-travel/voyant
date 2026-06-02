import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"

import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productComponentRoutes = new Hono<Env>()
  // GET /components — List components
  .get("/components", async (c) => {
    const query = parseQuery(c, validation.productComponentListQuerySchema)
    return c.json(await productsService.listComponents(c.get("db"), query))
  })

  // GET /components/:componentId — Get single component
  .get("/components/:componentId", async (c) => {
    const row = await productsService.getComponentById(c.get("db"), c.req.param("componentId"))

    if (!row) {
      return c.json({ error: "Product component not found" }, 404)
    }

    return c.json({ data: row })
  })

  // POST /:id/components/import — Validate and bulk import components for product
  .post("/:id/components/import", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.importProductComponentsSchema)
    const result = await productsService.importComponents(c.get("db"), productId, body)

    if (!result) {
      return c.json({ error: "Product not found" }, 404)
    }

    if (!body.dryRun) {
      await appendProductMutationLedgerEntry(c, {
        action: "update",
        productId,
        changedFields: ["components"],
        subject: "product components",
        actionName: "product.component.import",
        routeOrToolName: "products.component.import",
        summary: `Imported ${result.summary.created} product component${result.summary.created === 1 ? "" : "s"}`,
      })
      await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "component" })
    }

    return c.json(result)
  })

  // POST /:id/components — Create component for product
  .post("/:id/components", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertProductComponentSchema)
    const row = await productsService.createComponent(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product component",
      actionName: "product.component.create",
      routeOrToolName: "products.component.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "component" })
    return c.json({ data: row }, 201)
  })

  // PATCH /components/:componentId — Update component
  .patch("/components/:componentId", async (c) => {
    const componentId = c.req.param("componentId")
    const body = await parseJsonBody(c, validation.updateProductComponentSchema)
    const before = await productsService.getComponentById(c.get("db"), componentId)
    if (!before) {
      return c.json({ error: "Product component not found" }, 404)
    }

    const row = await productsService.updateComponent(c.get("db"), componentId, body)

    if (!row) {
      return c.json({ error: "Product component not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product component",
      actionName: "product.component.update",
      routeOrToolName: "products.component.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "component" })
    return c.json({ data: row })
  })

  // DELETE /components/:componentId — Delete component
  .delete("/components/:componentId", async (c) => {
    const componentId = c.req.param("componentId")
    const before = await productsService.getComponentById(c.get("db"), componentId)
    if (!before) {
      return c.json({ error: "Product component not found" }, 404)
    }

    const row = await productsService.deleteComponent(c.get("db"), componentId)

    if (!row) {
      return c.json({ error: "Product component not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product component",
      actionName: "product.component.delete",
      routeOrToolName: "products.component.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "component" })
    return c.json({ success: true }, 200)
  })

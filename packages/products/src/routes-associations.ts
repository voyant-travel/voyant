import { parseJsonBody } from "@voyantjs/hono"
import { Hono } from "hono"
import { z } from "zod"
import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"

export const productAssociationRoutes = new Hono<Env>()
  // ==========================================================================
  // Product <-> Category associations
  // ==========================================================================

  .get("/:id/categories", async (c) => {
    return c.json({
      data: await productsService.listProductCategories_(c.get("db"), c.req.param("id")),
    })
  })

  .post("/:id/categories", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(
      c,
      z.object({
        categoryId: z.string(),
        sortOrder: z.number().optional(),
      }),
    )
    const { categoryId, sortOrder } = body
    const row = await productsService.addProductToCategory(
      c.get("db"),
      productId,
      categoryId,
      sortOrder,
    )
    if (!row) {
      return c.json({ error: "Already assigned or not found" }, 409)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product category link",
      actionName: "product.category_link.create",
      routeOrToolName: "products.category_link.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "category" })
    return c.json({ success: true }, 201)
  })

  .delete("/:id/categories/:categoryId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.removeProductFromCategory(
      c.get("db"),
      productId,
      c.req.param("categoryId"),
    )
    if (!row) {
      return c.json({ error: "Association not found" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId,
      changedFields: [],
      subject: "product category link",
      actionName: "product.category_link.delete",
      routeOrToolName: "products.category_link.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "category" })
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Product <-> Tag associations
  // ==========================================================================

  .get("/:id/tags", async (c) => {
    return c.json({
      data: await productsService.listProductTags_(c.get("db"), c.req.param("id")),
    })
  })

  .post("/:id/tags", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(
      c,
      z.object({
        tagId: z.string(),
      }),
    )
    const { tagId } = body
    const row = await productsService.addProductTag(c.get("db"), productId, tagId)
    if (!row) {
      return c.json({ error: "Already assigned or not found" }, 409)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product tag link",
      actionName: "product.tag_link.create",
      routeOrToolName: "products.tag_link.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "tag" })
    return c.json({ success: true }, 201)
  })

  .delete("/:id/tags/:tagId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.removeProductTag(c.get("db"), productId, c.req.param("tagId"))
    if (!row) {
      return c.json({ error: "Association not found" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId,
      changedFields: [],
      subject: "product tag link",
      actionName: "product.tag_link.delete",
      routeOrToolName: "products.tag_link.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "tag" })
    return c.json({ success: true }, 200)
  })

import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { Hono } from "hono"
import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productOptionRoutes = new Hono<Env>()
  // ==========================================================================
  // Options
  // ==========================================================================

  // GET /options — List options
  .get("/options", async (c) => {
    const query = parseQuery(c, validation.productOptionListQuerySchema)
    return c.json(await productsService.listOptions(c.get("db"), query))
  })

  // GET /options/:optionId — Get single option
  .get("/options/:optionId", async (c) => {
    const row = await productsService.getOptionById(c.get("db"), c.req.param("optionId"))

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    return c.json({ data: row })
  })

  // POST /:id/options — Create option for product
  .post("/:id/options", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertProductOptionSchema)
    const row = await productsService.createOption(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product option",
      actionName: "product.option.create",
      routeOrToolName: "products.option.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "option" })
    return c.json({ data: row }, 201)
  })

  // PATCH /options/:optionId — Update option
  .patch("/options/:optionId", async (c) => {
    const optionId = c.req.param("optionId")
    const body = await parseJsonBody(c, validation.updateProductOptionSchema)
    const before = await productsService.getOptionById(c.get("db"), optionId)
    if (!before) {
      return c.json({ error: "Product option not found" }, 404)
    }

    const row = await productsService.updateOption(c.get("db"), optionId, body)

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product option",
      actionName: "product.option.update",
      routeOrToolName: "products.option.update",
    })
    if (row.productId) {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "option" })
    }
    return c.json({ data: row })
  })

  // DELETE /options/:optionId — Delete option
  .delete("/options/:optionId", async (c) => {
    const optionId = c.req.param("optionId")
    const before = await productsService.getOptionById(c.get("db"), optionId)
    if (!before) {
      return c.json({ error: "Product option not found" }, 404)
    }

    const row = await productsService.deleteOption(c.get("db"), optionId)

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product option",
      actionName: "product.option.delete",
      routeOrToolName: "products.option.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "option" })
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Option Units
  // ==========================================================================

  // GET /units — List units
  .get("/units", async (c) => {
    const query = parseQuery(c, validation.optionUnitListQuerySchema)
    return c.json(await productsService.listUnits(c.get("db"), query))
  })

  // GET /units/:unitId — Get single unit
  .get("/units/:unitId", async (c) => {
    const row = await productsService.getUnitById(c.get("db"), c.req.param("unitId"))

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    return c.json({ data: row })
  })

  // POST /options/:optionId/units — Create unit for option
  .post("/options/:optionId/units", async (c) => {
    const optionId = c.req.param("optionId")
    const body = await parseJsonBody(c, validation.insertOptionUnitSchema)
    const option = await productsService.getOptionById(c.get("db"), optionId)
    if (!option) {
      return c.json({ error: "Product option not found" }, 404)
    }

    const row = await productsService.createUnit(c.get("db"), optionId, body)

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: option.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product option unit",
      actionName: "product.option_unit.create",
      routeOrToolName: "products.option_unit.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: option.productId, axis: "option" })
    return c.json({ data: row }, 201)
  })

  // PATCH /units/:unitId — Update unit
  .patch("/units/:unitId", async (c) => {
    const unitId = c.req.param("unitId")
    const body = await parseJsonBody(c, validation.updateOptionUnitSchema)
    const before = await productsService.getUnitForProductMutation(c.get("db"), unitId)
    if (!before) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    const row = await productsService.updateUnit(c.get("db"), unitId, body)

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product option unit",
      actionName: "product.option_unit.update",
      routeOrToolName: "products.option_unit.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "option" })
    return c.json({ data: row })
  })

  // DELETE /units/:unitId — Delete unit
  .delete("/units/:unitId", async (c) => {
    const unitId = c.req.param("unitId")
    const before = await productsService.getUnitForProductMutation(c.get("db"), unitId)
    if (!before) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    const row = await productsService.deleteUnit(c.get("db"), unitId)

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product option unit",
      actionName: "product.option_unit.delete",
      routeOrToolName: "products.option_unit.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "option" })
    return c.json({ success: true }, 200)
  })

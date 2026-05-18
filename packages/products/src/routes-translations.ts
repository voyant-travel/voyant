import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productTranslationRoutes = new Hono<Env>()
  // ==========================================================================
  // Translations
  // ==========================================================================

  .get("/translations", async (c) => {
    const query = parseQuery(c, validation.productTranslationListQuerySchema)
    return c.json(await productsService.listProductTranslations(c.get("db"), query))
  })

  .get("/translations/:translationId", async (c) => {
    const row = await productsService.getProductTranslationById(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/translations", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertProductTranslationSchema)
    const row = await productsService.createProductTranslation(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product translation",
      actionName: "product.translation.create",
      routeOrToolName: "products.translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "translation" })
    return c.json({ data: row }, 201)
  })

  .patch("/translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const body = await parseJsonBody(c, validation.updateProductTranslationSchema)
    const before = await productsService.getProductTranslationById(c.get("db"), translationId)
    if (!before) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    const row = await productsService.updateProductTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product translation",
      actionName: "product.translation.update",
      routeOrToolName: "products.translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: row.productId,
      axis: "translation",
    })
    return c.json({ data: row })
  })

  .delete("/translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const before = await productsService.getProductTranslationById(c.get("db"), translationId)
    if (!before) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    const row = await productsService.deleteProductTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product translation",
      actionName: "product.translation.delete",
      routeOrToolName: "products.translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ success: true }, 200)
  })

  .get("/option-translations", async (c) => {
    const query = parseQuery(c, validation.productOptionTranslationListQuerySchema)
    return c.json(await productsService.listOptionTranslations(c.get("db"), query))
  })

  .get("/option-translations/:translationId", async (c) => {
    const row = await productsService.getOptionTranslationById(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/options/:optionId/translations", async (c) => {
    const optionId = c.req.param("optionId")
    const body = await parseJsonBody(c, validation.insertProductOptionTranslationSchema)
    const option = await productsService.getOptionById(c.get("db"), optionId)
    if (!option) {
      return c.json({ error: "Product option not found" }, 404)
    }

    const row = await productsService.createOptionTranslation(c.get("db"), optionId, body)

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: option.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product option translation",
      actionName: "product.option_translation.create",
      routeOrToolName: "products.option_translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: option.productId,
      axis: "translation",
    })
    return c.json({ data: row }, 201)
  })

  .patch("/option-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const body = await parseJsonBody(c, validation.updateProductOptionTranslationSchema)
    const before = await productsService.getOptionTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    const row = await productsService.updateOptionTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product option translation",
      actionName: "product.option_translation.update",
      routeOrToolName: "products.option_translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ data: row })
  })

  .delete("/option-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const before = await productsService.getOptionTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    const row = await productsService.deleteOptionTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product option translation",
      actionName: "product.option_translation.delete",
      routeOrToolName: "products.option_translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ success: true }, 200)
  })

  .get("/unit-translations", async (c) => {
    const query = parseQuery(c, validation.optionUnitTranslationListQuerySchema)
    return c.json(await productsService.listUnitTranslations(c.get("db"), query))
  })

  .get("/unit-translations/:translationId", async (c) => {
    const row = await productsService.getUnitTranslationById(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/units/:unitId/translations", async (c) => {
    const unitId = c.req.param("unitId")
    const body = await parseJsonBody(c, validation.insertOptionUnitTranslationSchema)
    const unit = await productsService.getUnitForProductMutation(c.get("db"), unitId)
    if (!unit) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    const row = await productsService.createUnitTranslation(c.get("db"), unitId, body)

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: unit.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product option unit translation",
      actionName: "product.option_unit_translation.create",
      routeOrToolName: "products.option_unit_translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: unit.productId,
      axis: "translation",
    })
    return c.json({ data: row }, 201)
  })

  .patch("/unit-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const body = await parseJsonBody(c, validation.updateOptionUnitTranslationSchema)
    const before = await productsService.getUnitTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    const row = await productsService.updateUnitTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product option unit translation",
      actionName: "product.option_unit_translation.update",
      routeOrToolName: "products.option_unit_translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ data: row })
  })

  .delete("/unit-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const before = await productsService.getUnitTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    const row = await productsService.deleteUnitTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product option unit translation",
      actionName: "product.option_unit_translation.delete",
      routeOrToolName: "products.option_unit_translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ success: true }, 200)
  })

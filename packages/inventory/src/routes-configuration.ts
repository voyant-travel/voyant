import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productConfigurationRoutes = new Hono<Env>()
  // ==========================================================================
  // Product operating configuration
  // ==========================================================================

  .get("/activation-settings", async (c) => {
    const query = parseQuery(c, validation.productActivationSettingListQuerySchema)
    return c.json(await productsService.listActivationSettings(c.get("db"), query))
  })

  .get("/activation-settings/:id", async (c) => {
    const row = await productsService.getActivationSettingById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/activation-settings", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertProductActivationSettingSchema)
    const before = await productsService.getActivationSettingByProductId(c.get("db"), productId)
    const row = await productsService.upsertActivationSetting(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    const action = before ? "update" : "create"
    await appendProductMutationLedgerEntry(c, {
      action,
      productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product activation settings",
      actionName: `product.activation_settings.${action}`,
      routeOrToolName: `products.activation_settings.${action}`,
    })
    return c.json({ data: row }, 201)
  })

  .patch("/activation-settings/:id", async (c) => {
    const id = c.req.param("id")
    const body = await parseJsonBody(c, validation.updateProductActivationSettingSchema)
    const before = await productsService.getActivationSettingById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

    const row = await productsService.updateActivationSetting(c.get("db"), id, body)

    if (!row) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product activation settings",
      actionName: "product.activation_settings.update",
      routeOrToolName: "products.activation_settings.update",
    })
    return c.json({ data: row })
  })

  .delete("/activation-settings/:id", async (c) => {
    const id = c.req.param("id")
    const before = await productsService.getActivationSettingById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

    const row = await productsService.deleteActivationSetting(c.get("db"), id)

    if (!row) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product activation settings",
      actionName: "product.activation_settings.delete",
      routeOrToolName: "products.activation_settings.delete",
    })
    return c.json({ success: true }, 200)
  })

  .get("/ticket-settings", async (c) => {
    const query = parseQuery(c, validation.productTicketSettingListQuerySchema)
    return c.json(await productsService.listTicketSettings(c.get("db"), query))
  })

  .get("/ticket-settings/:id", async (c) => {
    const row = await productsService.getTicketSettingById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/ticket-settings", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertProductTicketSettingSchema)
    const before = await productsService.getTicketSettingByProductId(c.get("db"), productId)
    const row = await productsService.upsertTicketSetting(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    const action = before ? "update" : "create"
    await appendProductMutationLedgerEntry(c, {
      action,
      productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product ticket settings",
      actionName: `product.ticket_settings.${action}`,
      routeOrToolName: `products.ticket_settings.${action}`,
    })
    return c.json({ data: row }, 201)
  })

  .patch("/ticket-settings/:id", async (c) => {
    const id = c.req.param("id")
    const body = await parseJsonBody(c, validation.updateProductTicketSettingSchema)
    const before = await productsService.getTicketSettingById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

    const row = await productsService.updateTicketSetting(c.get("db"), id, body)

    if (!row) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product ticket settings",
      actionName: "product.ticket_settings.update",
      routeOrToolName: "products.ticket_settings.update",
    })
    return c.json({ data: row })
  })

  .delete("/ticket-settings/:id", async (c) => {
    const id = c.req.param("id")
    const before = await productsService.getTicketSettingById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

    const row = await productsService.deleteTicketSetting(c.get("db"), id)

    if (!row) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product ticket settings",
      actionName: "product.ticket_settings.delete",
      routeOrToolName: "products.ticket_settings.delete",
    })
    return c.json({ success: true }, 200)
  })

  .get("/visibility-settings", async (c) => {
    const query = parseQuery(c, validation.productVisibilitySettingListQuerySchema)
    return c.json(await productsService.listVisibilitySettings(c.get("db"), query))
  })

  .get("/visibility-settings/:id", async (c) => {
    const row = await productsService.getVisibilitySettingById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/visibility-settings", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertProductVisibilitySettingSchema)
    const before = await productsService.getVisibilitySettingByProductId(c.get("db"), productId)
    const row = await productsService.upsertVisibilitySetting(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    const action = before ? "update" : "create"
    await appendProductMutationLedgerEntry(c, {
      action,
      productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product visibility settings",
      actionName: `product.visibility_settings.${action}`,
      routeOrToolName: `products.visibility_settings.${action}`,
    })
    return c.json({ data: row }, 201)
  })

  .patch("/visibility-settings/:id", async (c) => {
    const id = c.req.param("id")
    const body = await parseJsonBody(c, validation.updateProductVisibilitySettingSchema)
    const before = await productsService.getVisibilitySettingById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

    const row = await productsService.updateVisibilitySetting(c.get("db"), id, body)

    if (!row) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product visibility settings",
      actionName: "product.visibility_settings.update",
      routeOrToolName: "products.visibility_settings.update",
    })
    return c.json({ data: row })
  })

  .delete("/visibility-settings/:id", async (c) => {
    const id = c.req.param("id")
    const before = await productsService.getVisibilitySettingById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

    const row = await productsService.deleteVisibilitySetting(c.get("db"), id)

    if (!row) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product visibility settings",
      actionName: "product.visibility_settings.delete",
      routeOrToolName: "products.visibility_settings.delete",
    })
    return c.json({ success: true }, 200)
  })

  .get("/capabilities", async (c) => {
    const query = parseQuery(c, validation.productCapabilityListQuerySchema)
    return c.json(await productsService.listCapabilities(c.get("db"), query))
  })

  .get("/capabilities/:id", async (c) => {
    const row = await productsService.getCapabilityById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product capability not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/capabilities", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertProductCapabilitySchema)
    const before = await productsService.getCapabilityByProductAndName(
      c.get("db"),
      productId,
      body.capability,
    )
    const row = await productsService.createCapability(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    const action = before ? "update" : "create"
    await appendProductMutationLedgerEntry(c, {
      action,
      productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product capability",
      actionName: `product.capability.${action}`,
      routeOrToolName: `products.capability.${action}`,
    })
    return c.json({ data: row }, 201)
  })

  .patch("/capabilities/:id", async (c) => {
    const id = c.req.param("id")
    const body = await parseJsonBody(c, validation.updateProductCapabilitySchema)
    const before = await productsService.getCapabilityById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product capability not found" }, 404)
    }

    const row = await productsService.updateCapability(c.get("db"), id, body)

    if (!row) {
      return c.json({ error: "Product capability not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product capability",
      actionName: "product.capability.update",
      routeOrToolName: "products.capability.update",
    })
    return c.json({ data: row })
  })

  .delete("/capabilities/:id", async (c) => {
    const id = c.req.param("id")
    const before = await productsService.getCapabilityById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product capability not found" }, 404)
    }

    const row = await productsService.deleteCapability(c.get("db"), id)

    if (!row) {
      return c.json({ error: "Product capability not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product capability",
      actionName: "product.capability.delete",
      routeOrToolName: "products.capability.delete",
    })
    return c.json({ success: true }, 200)
  })

  .get("/delivery-formats", async (c) => {
    const query = parseQuery(c, validation.productDeliveryFormatListQuerySchema)
    return c.json(await productsService.listDeliveryFormats(c.get("db"), query))
  })

  .get("/delivery-formats/:id", async (c) => {
    const row = await productsService.getDeliveryFormatById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/delivery-formats", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertProductDeliveryFormatSchema)
    const before = await productsService.getDeliveryFormatByProductAndFormat(
      c.get("db"),
      productId,
      body.format,
    )
    const row = await productsService.createDeliveryFormat(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    const action = before ? "update" : "create"
    await appendProductMutationLedgerEntry(c, {
      action,
      productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product delivery format",
      actionName: `product.delivery_format.${action}`,
      routeOrToolName: `products.delivery_format.${action}`,
    })
    return c.json({ data: row }, 201)
  })

  .patch("/delivery-formats/:id", async (c) => {
    const id = c.req.param("id")
    const body = await parseJsonBody(c, validation.updateProductDeliveryFormatSchema)
    const before = await productsService.getDeliveryFormatById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    const row = await productsService.updateDeliveryFormat(c.get("db"), id, body)

    if (!row) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product delivery format",
      actionName: "product.delivery_format.update",
      routeOrToolName: "products.delivery_format.update",
    })
    return c.json({ data: row })
  })

  .delete("/delivery-formats/:id", async (c) => {
    const id = c.req.param("id")
    const before = await productsService.getDeliveryFormatById(c.get("db"), id)
    if (!before) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    const row = await productsService.deleteDeliveryFormat(c.get("db"), id)

    if (!row) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product delivery format",
      actionName: "product.delivery_format.delete",
      routeOrToolName: "products.delivery_format.delete",
    })
    return c.json({ success: true }, 200)
  })

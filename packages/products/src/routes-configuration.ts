import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
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
    const row = await productsService.upsertActivationSetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.insertProductActivationSettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/activation-settings/:id", async (c) => {
    const row = await productsService.updateActivationSetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductActivationSettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/activation-settings/:id", async (c) => {
    const row = await productsService.deleteActivationSetting(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

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
    const row = await productsService.upsertTicketSetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.insertProductTicketSettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/ticket-settings/:id", async (c) => {
    const row = await productsService.updateTicketSetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductTicketSettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/ticket-settings/:id", async (c) => {
    const row = await productsService.deleteTicketSetting(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

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
    const row = await productsService.upsertVisibilitySetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.insertProductVisibilitySettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/visibility-settings/:id", async (c) => {
    const row = await productsService.updateVisibilitySetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductVisibilitySettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/visibility-settings/:id", async (c) => {
    const row = await productsService.deleteVisibilitySetting(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

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
    const row = await productsService.createCapability(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.insertProductCapabilitySchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/capabilities/:id", async (c) => {
    const row = await productsService.updateCapability(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductCapabilitySchema),
    )

    if (!row) {
      return c.json({ error: "Product capability not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/capabilities/:id", async (c) => {
    const row = await productsService.deleteCapability(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product capability not found" }, 404)
    }

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
    const row = await productsService.createDeliveryFormat(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.insertProductDeliveryFormatSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/delivery-formats/:id", async (c) => {
    const row = await productsService.updateDeliveryFormat(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductDeliveryFormatSchema),
    )

    if (!row) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/delivery-formats/:id", async (c) => {
    const row = await productsService.deleteDeliveryFormat(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

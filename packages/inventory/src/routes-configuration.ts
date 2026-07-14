// agent-quality: file-size exception -- owner: inventory; existing configuration routes stay co-located until a dedicated split preserves mount order, OpenAPI output, and route tests.
/**
 * Admin product operating-configuration routes — activation settings, ticket
 * settings, visibility settings, capabilities, and delivery formats. Mounted by
 * the operator starter under `/v1/admin/products/...` on the (already
 * `OpenAPIHono`) parent `productRoutes` (staff-actor gated by the parent app's
 * middleware chain).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * inventory configuration sub-batch). Request schemas reuse the existing
 * `@voyant-travel/products-contracts` validation schemas the handlers already
 * parse; response row schemas are authored from the Drizzle `$inferSelect`
 * shapes in `schema-settings.ts` (§17: `Date`/timestamp columns serialize to
 * strings over the wire; integer fields stay numbers). Business logic, auth,
 * and action-ledger writes are unchanged; handlers read `c.req.valid(...)`.
 *
 * Each resource is its own child `OpenAPIHono` sub-chain (~5 legs) mounted via
 * `.route("/", child)` so the parent stays shallow (avoids the O(n²) tsc blowup
 * of one long flat `.openapi(...)` chain). Within each child, the static
 * collection paths are registered before the dynamic `/{id}` legs.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"

import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

const errorResponseSchema = z.object({ error: z.string() })
const idParamSchema = z.object({ id: z.string() })
const successSchema = z.object({ success: z.boolean() })

/** §17: timestamp columns are ISO strings over the wire. */
const isoTimestamp = z.string()

const activationModeValues = ["manual", "scheduled", "channel_controlled"] as const
const ticketFulfillmentValues = ["none", "per_booking", "per_participant", "per_item"] as const
const deliveryFormatValues = [
  "service_voucher",
  "ticket",
  "pdf",
  "qr_code",
  "barcode",
  "email",
  "mobile",
  "none",
] as const
const capabilityValues = [
  "instant_confirmation",
  "on_request",
  "pickup_available",
  "dropoff_available",
  "guided",
  "private",
  "shared",
  "digital_ticket",
  "service_voucher_required",
  "external_inventory",
  "multi_day",
  "accommodation",
  "transport",
] as const

// --- Response row schemas (authored from the Drizzle `$inferSelect` shapes) ---

const activationSettingSchema = z.object({
  id: z.string(),
  productId: z.string(),
  activationMode: z.enum(activationModeValues),
  activateAt: isoTimestamp.nullable(),
  deactivateAt: isoTimestamp.nullable(),
  sellAt: isoTimestamp.nullable(),
  stopSellAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const ticketSettingSchema = z.object({
  id: z.string(),
  productId: z.string(),
  fulfillmentMode: z.enum(ticketFulfillmentValues),
  defaultDeliveryFormat: z.enum(deliveryFormatValues),
  ticketPerUnit: z.boolean(),
  barcodeFormat: z.string().nullable(),
  serviceVoucherMessage: z.string().nullable(),
  ticketMessage: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const visibilitySettingSchema = z.object({
  id: z.string(),
  productId: z.string(),
  isSearchable: z.boolean(),
  isBookable: z.boolean(),
  isFeatured: z.boolean(),
  requiresAuthentication: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const capabilitySchema = z.object({
  id: z.string(),
  productId: z.string(),
  capability: z.enum(capabilityValues),
  enabled: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const deliveryFormatSchema = z.object({
  id: z.string(),
  productId: z.string(),
  format: z.enum(deliveryFormatValues),
  isDefault: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// ==========================================================================
// Activation settings
// ==========================================================================

const listActivationSettingsRoute = createRoute({
  method: "get",
  path: "/activation-settings",
  request: { query: validation.productActivationSettingListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product activation settings",
      content: { "application/json": { schema: listResponseSchema(activationSettingSchema) } },
    },
  },
})

const getActivationSettingRoute = createRoute({
  method: "get",
  path: "/activation-settings/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A product activation setting by id",
      content: { "application/json": { schema: z.object({ data: activationSettingSchema }) } },
    },
    404: {
      description: "Product activation setting not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const upsertActivationSettingRoute = createRoute({
  method: "post",
  path: "/{id}/activation-settings",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: validation.insertProductActivationSettingSchema },
      },
    },
  },
  responses: {
    201: {
      description: "The created or updated activation setting for the product",
      content: { "application/json": { schema: z.object({ data: activationSettingSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateActivationSettingRoute = createRoute({
  method: "patch",
  path: "/activation-settings/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: validation.updateProductActivationSettingSchema },
      },
    },
  },
  responses: {
    200: {
      description: "The updated activation setting",
      content: { "application/json": { schema: z.object({ data: activationSettingSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product activation setting not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteActivationSettingRoute = createRoute({
  method: "delete",
  path: "/activation-settings/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Activation setting deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product activation setting not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const activationSettingRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listActivationSettingsRoute, async (c) =>
    c.json(await productsService.listActivationSettings(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getActivationSettingRoute, async (c) => {
    const row = await productsService.getActivationSettingById(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(upsertActivationSettingRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
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
  .openapi(updateActivationSettingRoute, async (c) => {
    const id = c.req.valid("param").id
    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteActivationSettingRoute, async (c) => {
    const id = c.req.valid("param").id
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

// ==========================================================================
// Ticket settings
// ==========================================================================

const listTicketSettingsRoute = createRoute({
  method: "get",
  path: "/ticket-settings",
  request: { query: validation.productTicketSettingListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product ticket settings",
      content: { "application/json": { schema: listResponseSchema(ticketSettingSchema) } },
    },
  },
})

const getTicketSettingRoute = createRoute({
  method: "get",
  path: "/ticket-settings/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A product ticket setting by id",
      content: { "application/json": { schema: z.object({ data: ticketSettingSchema }) } },
    },
    404: {
      description: "Product ticket setting not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const upsertTicketSettingRoute = createRoute({
  method: "post",
  path: "/{id}/ticket-settings",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductTicketSettingSchema } },
    },
  },
  responses: {
    201: {
      description: "The created or updated ticket setting for the product",
      content: { "application/json": { schema: z.object({ data: ticketSettingSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateTicketSettingRoute = createRoute({
  method: "patch",
  path: "/ticket-settings/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductTicketSettingSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ticket setting",
      content: { "application/json": { schema: z.object({ data: ticketSettingSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product ticket setting not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteTicketSettingRoute = createRoute({
  method: "delete",
  path: "/ticket-settings/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ticket setting deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product ticket setting not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const ticketSettingRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listTicketSettingsRoute, async (c) =>
    c.json(await productsService.listTicketSettings(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getTicketSettingRoute, async (c) => {
    const row = await productsService.getTicketSettingById(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(upsertTicketSettingRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
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
  .openapi(updateTicketSettingRoute, async (c) => {
    const id = c.req.valid("param").id
    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteTicketSettingRoute, async (c) => {
    const id = c.req.valid("param").id
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

// ==========================================================================
// Visibility settings
// ==========================================================================

const listVisibilitySettingsRoute = createRoute({
  method: "get",
  path: "/visibility-settings",
  request: { query: validation.productVisibilitySettingListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product visibility settings",
      content: { "application/json": { schema: listResponseSchema(visibilitySettingSchema) } },
    },
  },
})

const getVisibilitySettingRoute = createRoute({
  method: "get",
  path: "/visibility-settings/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A product visibility setting by id",
      content: { "application/json": { schema: z.object({ data: visibilitySettingSchema }) } },
    },
    404: {
      description: "Product visibility setting not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const upsertVisibilitySettingRoute = createRoute({
  method: "post",
  path: "/{id}/visibility-settings",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: validation.insertProductVisibilitySettingSchema },
      },
    },
  },
  responses: {
    201: {
      description: "The created or updated visibility setting for the product",
      content: { "application/json": { schema: z.object({ data: visibilitySettingSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateVisibilitySettingRoute = createRoute({
  method: "patch",
  path: "/visibility-settings/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: validation.updateProductVisibilitySettingSchema },
      },
    },
  },
  responses: {
    200: {
      description: "The updated visibility setting",
      content: { "application/json": { schema: z.object({ data: visibilitySettingSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product visibility setting not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteVisibilitySettingRoute = createRoute({
  method: "delete",
  path: "/visibility-settings/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Visibility setting deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product visibility setting not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const visibilitySettingRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listVisibilitySettingsRoute, async (c) =>
    c.json(await productsService.listVisibilitySettings(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getVisibilitySettingRoute, async (c) => {
    const row = await productsService.getVisibilitySettingById(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(upsertVisibilitySettingRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
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
  .openapi(updateVisibilitySettingRoute, async (c) => {
    const id = c.req.valid("param").id
    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteVisibilitySettingRoute, async (c) => {
    const id = c.req.valid("param").id
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

// ==========================================================================
// Capabilities
// ==========================================================================

const listCapabilitiesRoute = createRoute({
  method: "get",
  path: "/capabilities",
  request: { query: validation.productCapabilityListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product capabilities",
      content: { "application/json": { schema: listResponseSchema(capabilitySchema) } },
    },
  },
})

const getCapabilityRoute = createRoute({
  method: "get",
  path: "/capabilities/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A product capability by id",
      content: { "application/json": { schema: z.object({ data: capabilitySchema }) } },
    },
    404: {
      description: "Product capability not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createCapabilityRoute = createRoute({
  method: "post",
  path: "/{id}/capabilities",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductCapabilitySchema } },
    },
  },
  responses: {
    201: {
      description: "The created (or upserted) capability for the product",
      content: { "application/json": { schema: z.object({ data: capabilitySchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateCapabilityRoute = createRoute({
  method: "patch",
  path: "/capabilities/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductCapabilitySchema } },
    },
  },
  responses: {
    200: {
      description: "The updated capability",
      content: { "application/json": { schema: z.object({ data: capabilitySchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product capability not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteCapabilityRoute = createRoute({
  method: "delete",
  path: "/capabilities/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Capability deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product capability not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const capabilityRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listCapabilitiesRoute, async (c) =>
    c.json(await productsService.listCapabilities(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getCapabilityRoute, async (c) => {
    const row = await productsService.getCapabilityById(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Product capability not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createCapabilityRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
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
  .openapi(updateCapabilityRoute, async (c) => {
    const id = c.req.valid("param").id
    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteCapabilityRoute, async (c) => {
    const id = c.req.valid("param").id
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

// ==========================================================================
// Delivery formats
// ==========================================================================

const listDeliveryFormatsRoute = createRoute({
  method: "get",
  path: "/delivery-formats",
  request: { query: validation.productDeliveryFormatListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product delivery formats",
      content: { "application/json": { schema: listResponseSchema(deliveryFormatSchema) } },
    },
  },
})

const getDeliveryFormatRoute = createRoute({
  method: "get",
  path: "/delivery-formats/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A product delivery format by id",
      content: { "application/json": { schema: z.object({ data: deliveryFormatSchema }) } },
    },
    404: {
      description: "Product delivery format not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createDeliveryFormatRoute = createRoute({
  method: "post",
  path: "/{id}/delivery-formats",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductDeliveryFormatSchema } },
    },
  },
  responses: {
    201: {
      description: "The created (or upserted) delivery format for the product",
      content: { "application/json": { schema: z.object({ data: deliveryFormatSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateDeliveryFormatRoute = createRoute({
  method: "patch",
  path: "/delivery-formats/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductDeliveryFormatSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated delivery format",
      content: { "application/json": { schema: z.object({ data: deliveryFormatSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product delivery format not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteDeliveryFormatRoute = createRoute({
  method: "delete",
  path: "/delivery-formats/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Delivery format deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product delivery format not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deliveryFormatRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDeliveryFormatsRoute, async (c) =>
    c.json(await productsService.listDeliveryFormats(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getDeliveryFormatRoute, async (c) => {
    const row = await productsService.getDeliveryFormatById(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createDeliveryFormatRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
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
  .openapi(updateDeliveryFormatRoute, async (c) => {
    const id = c.req.valid("param").id
    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteDeliveryFormatRoute, async (c) => {
    const id = c.req.valid("param").id
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

// Mount each per-resource child sub-chain on the configuration parent. Static
// collection paths are registered inside each child before its `/{id}` legs.
export const productConfigurationRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", activationSettingRoutes)
  .route("/", ticketSettingRoutes)
  .route("/", visibilitySettingRoutes)
  .route("/", capabilityRoutes)
  .route("/", deliveryFormatRoutes)

/**
 * Admin routes for promotions — mounted by the operator starter at
 * `/v1/admin/promotions/*` (staff-actor-gated by the parent app's
 * middleware chain).
 *
 * PR1 ships CRUD only. Public storefront routes are exposed via the
 * existing `/v1/public/products/:productId/offers` endpoints in
 * `@voyant-travel/storefront` once the storefront resolver is wired in PR4.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"

import { type Env, notFound } from "./routes-shared.js"
import { promotionsService } from "./service.js"
import {
  insertPromotionalOfferSchema,
  promotionalOfferListQuerySchema,
  promotionalOfferSchema,
  updatePromotionalOfferSchema,
} from "./validation.js"

const errorResponseSchema = z.object({ error: z.string() })
const offerResponseSchema = z.object({ data: promotionalOfferSchema })
const idParamSchema = z.object({ id: z.string() })

const listPromotionsRoute = createRoute({
  method: "get",
  path: "/",
  request: { query: promotionalOfferListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of promotional offers",
      content: {
        "application/json": { schema: listResponseSchema(promotionalOfferSchema) },
      },
    },
  },
})

const createPromotionRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPromotionalOfferSchema } },
    },
  },
  responses: {
    201: {
      description: "The created promotional offer",
      content: { "application/json": { schema: offerResponseSchema } },
    },
  },
})

const getPromotionRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A promotional offer by id",
      content: { "application/json": { schema: offerResponseSchema } },
    },
    404: {
      description: "Promotional offer not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePromotionRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePromotionalOfferSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated promotional offer",
      content: { "application/json": { schema: offerResponseSchema } },
    },
    404: {
      description: "Promotional offer not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const archivePromotionRoute = createRoute({
  method: "post",
  path: "/{id}/archive",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The archived promotional offer",
      content: { "application/json": { schema: offerResponseSchema } },
    },
    404: {
      description: "Promotional offer not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePromotionRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The id of the deleted promotional offer",
      content: { "application/json": { schema: z.object({ data: idParamSchema }) } },
    },
    404: {
      description: "Promotional offer not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Offer has redemptions and cannot be deleted",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export const promotionsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPromotionsRoute, async (c) =>
    c.json(await promotionsService.listOffers(c.get("db"), c.req.valid("query"))),
  )
  .openapi(createPromotionRoute, async (c) =>
    c.json(
      {
        data: await promotionsService.createOffer(c.get("db"), c.req.valid("json"), {
          eventBus: c.get("eventBus"),
        }),
      },
      201,
    ),
  )
  .openapi(getPromotionRoute, async (c) => {
    const offer = await promotionsService.getOfferById(c.get("db"), c.req.valid("param").id)
    return offer ? c.json({ data: offer }, 200) : notFound(c, "Promotional offer not found")
  })
  .openapi(updatePromotionRoute, async (c) => {
    const offer = await promotionsService.updateOffer(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      { eventBus: c.get("eventBus") },
    )
    return offer ? c.json({ data: offer }, 200) : notFound(c, "Promotional offer not found")
  })
  .openapi(archivePromotionRoute, async (c) => {
    const offer = await promotionsService.archiveOffer(c.get("db"), c.req.valid("param").id, {
      eventBus: c.get("eventBus"),
    })
    return offer ? c.json({ data: offer }, 200) : notFound(c, "Promotional offer not found")
  })
  .openapi(deletePromotionRoute, async (c) => {
    try {
      const result = await promotionsService.deleteOffer(c.get("db"), c.req.valid("param").id, {
        eventBus: c.get("eventBus"),
      })
      return result ? c.json({ data: result }, 200) : notFound(c, "Promotional offer not found")
    } catch (err) {
      // `deleteOffer` throws when redemptions exist (the FK RESTRICT
      // would otherwise surface a less helpful error). Translate to 409.
      if (err instanceof Error && err.message.includes("redemption(s) exist")) {
        return c.json({ error: err.message }, 409)
      }
      throw err
    }
  })

export type PromotionsRoutes = typeof promotionsRoutes

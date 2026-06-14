/**
 * Admin routes for promotions — mounted by the operator template at
 * `/v1/admin/promotions/*` (staff-actor-gated by the parent app's
 * middleware chain).
 *
 * PR1 ships CRUD only. Public storefront routes are exposed via the
 * existing `/v1/public/products/:productId/offers` endpoints in
 * `@voyantjs/storefront` once the storefront resolver is wired in PR4.
 */

import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"

import { type Env, notFound } from "./routes-shared.js"
import { promotionsService } from "./service.js"
import {
  insertPromotionalOfferSchema,
  promotionalOfferListQuerySchema,
  updatePromotionalOfferSchema,
} from "./validation.js"

export const promotionsRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const query = await parseQuery(c, promotionalOfferListQuerySchema)
    return c.json(await promotionsService.listOffers(c.get("db"), query))
  })
  .post("/", async (c) =>
    c.json(
      {
        data: await promotionsService.createOffer(
          c.get("db"),
          await parseJsonBody(c, insertPromotionalOfferSchema),
          { eventBus: c.get("eventBus") },
        ),
      },
      201,
    ),
  )
  .get("/:id", async (c) => {
    const offer = await promotionsService.getOfferById(c.get("db"), c.req.param("id"))
    return offer ? c.json({ data: offer }) : notFound(c, "Promotional offer not found")
  })
  .patch("/:id", async (c) => {
    const patch = await parseJsonBody(c, updatePromotionalOfferSchema)
    const offer = await promotionsService.updateOffer(c.get("db"), c.req.param("id"), patch, {
      eventBus: c.get("eventBus"),
    })
    return offer ? c.json({ data: offer }) : notFound(c, "Promotional offer not found")
  })
  .post("/:id/archive", async (c) => {
    const offer = await promotionsService.archiveOffer(c.get("db"), c.req.param("id"), {
      eventBus: c.get("eventBus"),
    })
    return offer ? c.json({ data: offer }) : notFound(c, "Promotional offer not found")
  })
  .delete("/:id", async (c) => {
    try {
      const result = await promotionsService.deleteOffer(c.get("db"), c.req.param("id"), {
        eventBus: c.get("eventBus"),
      })
      return result ? c.json({ data: result }) : notFound(c, "Promotional offer not found")
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

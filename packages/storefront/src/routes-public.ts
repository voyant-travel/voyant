import type { EventBus } from "@voyantjs/core"
import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { Context } from "hono"
import { Hono } from "hono"

import {
  createStorefrontService,
  type StorefrontRequestContext,
  type StorefrontServiceOptions,
} from "./service.js"
import {
  type StorefrontLeadIntakeInput,
  type StorefrontNewsletterSubscribeInput,
  storefrontDepartureListQuerySchema,
  storefrontDeparturePricePreviewInputSchema,
  storefrontLeadIntakeInputSchema,
  storefrontNewsletterSubscribeInputSchema,
  storefrontOfferApplyInputSchema,
  storefrontOfferRedeemInputSchema,
  storefrontProductAvailabilitySummaryQuerySchema,
  storefrontProductExtensionsQuerySchema,
  storefrontPromotionalOfferListQuerySchema,
} from "./validation.js"
import { storefrontTransportEligibilityInputSchema } from "./validation-transport-eligibility.js"

type Env = {
  Variables: {
    db: unknown
    eventBus?: EventBus
  }
}

export function createStorefrontPublicRoutes(options?: StorefrontServiceOptions) {
  const storefrontService = createStorefrontService(options)

  function getRequestContext(c: Context<Env>): StorefrontRequestContext {
    return {
      db: c.get("db" as never) as StorefrontRequestContext["db"],
      eventBus: c.get("eventBus" as never) as StorefrontRequestContext["eventBus"],
      env: c.env,
      context: c,
    } satisfies StorefrontRequestContext
  }

  async function runIntakeGuard(
    input:
      | {
          kind: "lead"
          body: StorefrontLeadIntakeInput
          context: StorefrontRequestContext
        }
      | {
          kind: "newsletter"
          body: StorefrontNewsletterSubscribeInput
          context: StorefrontRequestContext
        },
  ) {
    const decision = await storefrontService.checkIntakeGuard(input)
    if (!decision || decision.allowed) return null
    return {
      status: decision.status ?? 403,
      error: decision.error ?? "Storefront intake rejected",
    }
  }

  return new Hono<Env>()
    .get("/settings", async (c) => {
      return c.json({ data: await storefrontService.resolveSettings(getRequestContext(c)) })
    })
    .post("/leads", async (c) => {
      const context = getRequestContext(c)
      const body = await parseJsonBody(c, storefrontLeadIntakeInputSchema)
      const rejected = await runIntakeGuard({ kind: "lead", body, context })
      if (rejected) return c.json({ error: rejected.error }, rejected.status)

      return c.json(
        {
          data: await storefrontService.createLead({
            body,
            context,
          }),
        },
        201,
      )
    })
    .post("/newsletter/subscribe", async (c) => {
      const context = getRequestContext(c)
      const body = await parseJsonBody(c, storefrontNewsletterSubscribeInputSchema)
      const rejected = await runIntakeGuard({ kind: "newsletter", body, context })
      if (rejected) return c.json({ error: rejected.error }, rejected.status)

      return c.json(
        {
          data: await storefrontService.subscribeNewsletter({
            body,
            context,
          }),
        },
        202,
      )
    })
    .get("/departures/:departureId", async (c) => {
      const departure = await storefrontService.getDeparture(
        c.get("db" as never),
        c.req.param("departureId"),
      )

      return departure
        ? c.json({ data: departure })
        : c.json({ error: "Storefront departure not found" }, 404)
    })
    .get("/products/:productId/departures", async (c) => {
      return c.json(
        await storefrontService.listProductDepartures(
          c.get("db" as never),
          c.req.param("productId"),
          await parseQuery(c, storefrontDepartureListQuerySchema),
        ),
      )
    })
    .post("/departures/:departureId/price", async (c) => {
      const preview = await storefrontService.previewDeparturePrice(
        c.get("db" as never),
        c.req.param("departureId"),
        await parseJsonBody(c, storefrontDeparturePricePreviewInputSchema),
      )

      return preview
        ? c.json({ data: preview })
        : c.json({ error: "Storefront departure not found" }, 404)
    })
    .post("/departures/:departureId/eligibility", async (c) => {
      return c.json({
        data: await storefrontService.checkDepartureTransportEligibility({
          departureId: c.req.param("departureId"),
          body: await parseJsonBody(c, storefrontTransportEligibilityInputSchema),
          context: getRequestContext(c),
        }),
      })
    })
    .post("/products/:productId/departures/:departureId/eligibility", async (c) => {
      return c.json({
        data: await storefrontService.checkDepartureTransportEligibility({
          departureId: c.req.param("departureId"),
          productId: c.req.param("productId"),
          body: await parseJsonBody(c, storefrontTransportEligibilityInputSchema),
          context: getRequestContext(c),
        }),
      })
    })
    .get("/products/:productId/extensions", async (c) => {
      const query = await parseQuery(c, storefrontProductExtensionsQuerySchema)

      return c.json({
        data: await storefrontService.getProductExtensions(
          c.get("db" as never),
          c.req.param("productId"),
          query.optionId,
        ),
      })
    })
    .get("/products/:productId/availability", async (c) => {
      return c.json({
        data: await storefrontService.getProductAvailabilitySummary(
          c.get("db" as never),
          c.req.param("productId"),
          await parseQuery(c, storefrontProductAvailabilitySummaryQuerySchema),
        ),
      })
    })
    .get("/products/:productId/departures/:departureId/itinerary", async (c) => {
      const itinerary = await storefrontService.getDepartureItinerary(c.get("db" as never), {
        departureId: c.req.param("departureId"),
        productId: c.req.param("productId"),
      })

      return itinerary
        ? c.json({ data: itinerary })
        : c.json({ error: "Storefront itinerary not found" }, 404)
    })
    .get("/products/:productId/offers", async (c) => {
      const query = await parseQuery(c, storefrontPromotionalOfferListQuerySchema)

      return c.json({
        data: await storefrontService.listApplicableOffers({
          productId: c.req.param("productId"),
          departureId: query.departureId,
          locale: query.locale,
          context: getRequestContext(c),
        }),
      })
    })
    .get("/offers/:slug", async (c) => {
      const query = await parseQuery(c, storefrontPromotionalOfferListQuerySchema)
      const offer = await storefrontService.getOfferBySlug({
        slug: c.req.param("slug"),
        locale: query.locale,
        context: getRequestContext(c),
      })

      return offer ? c.json({ data: offer }) : c.json({ error: "Storefront offer not found" }, 404)
    })
    .post("/offers/:slug/apply", async (c) => {
      const result = await storefrontService.applyOffer({
        slug: c.req.param("slug"),
        body: await parseJsonBody(c, storefrontOfferApplyInputSchema),
        context: getRequestContext(c),
      })

      return result
        ? c.json({ data: result })
        : c.json({ error: "Storefront offer application is not configured" }, 501)
    })
    .post("/offers/redeem", async (c) => {
      const result = await storefrontService.redeemOffer({
        body: await parseJsonBody(c, storefrontOfferRedeemInputSchema),
        context: getRequestContext(c),
      })

      return result
        ? c.json({ data: result })
        : c.json({ error: "Storefront offer redemption is not configured" }, 501)
    })
}

export type StorefrontPublicRoutes = ReturnType<typeof createStorefrontPublicRoutes>

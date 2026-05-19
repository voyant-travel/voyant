import type { AnyDrizzleDb } from "@voyantjs/db"
import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { Context } from "hono"
import { Hono } from "hono"

import {
  type CancelTripComponentsDeps,
  type PriceTripDeps,
  type ReserveTripDeps,
  type StartCheckoutDeps,
  TravelComposerInvariantError,
  travelComposerService,
} from "./service.js"
import {
  cancelTripComponentsSchema,
  createTripComponentBodySchema,
  createTripEnvelopeSchema,
  listTripsQuerySchema,
  previewTripCancellationSchema,
  priceTripSchema,
  reorderTripComponentsSchema,
  reserveTripSchema,
  startTripCheckoutSchema,
  updateTripComponentRefsSchema,
  updateTripComponentSchema,
  updateTripEnvelopeSchema,
} from "./validation.js"

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    db: AnyDrizzleDb
  }
}

export interface TravelComposerRoutesOptions {
  surface?: "admin" | "public"
  priceTripDeps?: TravelComposerRouteDeps<PriceTripDeps>
  reserveTripDeps?: TravelComposerRouteDeps<ReserveTripDeps>
  startCheckoutDeps?: TravelComposerRouteDeps<StartCheckoutDeps>
  cancelTripComponentsDeps?: TravelComposerRouteDeps<CancelTripComponentsDeps>
}

export type TravelComposerRouteDeps<T> = T | ((c: Context<Env>) => T | undefined)

const priceTripBodySchema = priceTripSchema.omit({ envelopeId: true })
const reserveTripBodySchema = reserveTripSchema.omit({ envelopeId: true })
const startCheckoutBodySchema = startTripCheckoutSchema.omit({ envelopeId: true })
const previewCancellationBodySchema = previewTripCancellationSchema.omit({ envelopeId: true })
const cancelTripComponentsBodySchema = cancelTripComponentsSchema.omit({ envelopeId: true })

function routeError(error: unknown): { message: string; status: 400 | 404 | 409 } {
  if (error instanceof TravelComposerInvariantError) {
    return {
      message: error.message,
      status: error.message.includes("was not found") ? 404 : 409,
    }
  }

  return {
    message: error instanceof Error ? error.message : "Travel composer route failed",
    status: 400,
  }
}

function resolveRouteDeps<T>(c: Context<Env>, deps: TravelComposerRouteDeps<T> | undefined) {
  if (typeof deps !== "function") return deps
  const resolver = deps as (c: Context<Env>) => T | undefined
  return resolver(c)
}

function isPublicSurface(options: TravelComposerRoutesOptions): boolean {
  return options.surface === "public"
}

function publicForbidden() {
  return new Response(JSON.stringify({ error: "Travel composer operation is admin-only" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  })
}

function envelopeIdParam(c: Context<Env>): string {
  const envelopeId = c.req.param("envelopeId")
  if (!envelopeId) throw new TravelComposerInvariantError("Trip envelope id is required")
  return envelopeId
}

async function listTripsHandler(c: Context<Env>) {
  const query = parseQuery(c, listTripsQuerySchema)
  return c.json(await travelComposerService.listTrips(c.get("db"), query))
}

async function createTripHandler(c: Context<Env>) {
  try {
    const trip = await travelComposerService.createTrip(
      c.get("db"),
      await parseJsonBody(c, createTripEnvelopeSchema),
    )
    return c.json({ data: trip }, 201)
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function getTripHandler(c: Context<Env>) {
  const trip = await travelComposerService.getTrip(c.get("db"), envelopeIdParam(c))
  if (!trip) return c.json({ error: "Trip envelope not found" }, 404)
  return c.json({ data: trip })
}

async function updateTripHandler(c: Context<Env>, options: TravelComposerRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const envelope = await travelComposerService.updateTrip(
      c.get("db"),
      envelopeIdParam(c),
      await parseJsonBody(c, updateTripEnvelopeSchema),
    )
    if (!envelope) return c.json({ error: "Trip envelope not found" }, 404)
    return c.json({ data: envelope })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function addTripComponentHandler(c: Context<Env>) {
  try {
    const body = await parseJsonBody(c, createTripComponentBodySchema)
    const component = await travelComposerService.addComponent(c.get("db"), {
      ...body,
      envelopeId: envelopeIdParam(c),
    })
    return c.json({ data: component }, 201)
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function reorderTripComponentsHandler(c: Context<Env>, options: TravelComposerRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const body = await parseJsonBody(c, reorderTripComponentsSchema.omit({ envelopeId: true }))
    const components = await travelComposerService.reorderComponents(c.get("db"), {
      ...body,
      envelopeId: envelopeIdParam(c),
    })
    return c.json({ data: components })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function priceTripHandler(c: Context<Env>, options: TravelComposerRoutesOptions) {
  const deps = resolveRouteDeps(c, options.priceTripDeps)
  if (!deps) {
    return c.json({ error: "Travel composer price dependencies are not configured" }, 501)
  }

  try {
    const body = await parseJsonBody(c, priceTripBodySchema)
    const result = await travelComposerService.priceTrip(
      c.get("db"),
      { ...body, envelopeId: envelopeIdParam(c) },
      deps,
    )
    return c.json({ data: result })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function reserveTripHandler(c: Context<Env>, options: TravelComposerRoutesOptions) {
  const deps = resolveRouteDeps(c, options.reserveTripDeps)
  if (!deps) {
    return c.json({ error: "Travel composer reserve dependencies are not configured" }, 501)
  }

  try {
    const body = await parseJsonBody(c, reserveTripBodySchema)
    const result = await travelComposerService.reserveTrip(
      c.get("db"),
      { ...body, envelopeId: envelopeIdParam(c) },
      deps,
    )
    return c.json({ data: result })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function startTripCheckoutHandler(c: Context<Env>, options: TravelComposerRoutesOptions) {
  const deps = resolveRouteDeps(c, options.startCheckoutDeps)
  if (!deps) {
    return c.json({ error: "Travel composer checkout dependencies are not configured" }, 501)
  }

  try {
    const body = await parseJsonBody(c, startCheckoutBodySchema)
    const result = await travelComposerService.startCheckout(
      c.get("db"),
      { ...body, envelopeId: envelopeIdParam(c) },
      deps,
    )
    return c.json({ data: result })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function previewTripCancellationHandler(
  c: Context<Env>,
  options: TravelComposerRoutesOptions,
) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const body = await parseJsonBody(c, previewCancellationBodySchema)
    const deps = resolveRouteDeps(c, options.cancelTripComponentsDeps)
    const result = await travelComposerService.previewCancellation(
      c.get("db"),
      { ...body, envelopeId: envelopeIdParam(c) },
      deps,
    )
    return c.json({ data: result })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function cancelTripComponentsHandler(c: Context<Env>, options: TravelComposerRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const body = await parseJsonBody(c, cancelTripComponentsBodySchema)
    const deps = resolveRouteDeps(c, options.cancelTripComponentsDeps)
    const result = await travelComposerService.cancelComponents(
      c.get("db"),
      { ...body, envelopeId: envelopeIdParam(c) },
      deps,
    )
    return c.json({ data: result })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

export function createTravelComposerRoutes(options: TravelComposerRoutesOptions = {}) {
  return new Hono<Env>()
    .get("/health", (c) => {
      return c.json({ data: travelComposerService.getStatus() })
    })
    .get("/trips", listTripsHandler)
    .post("/trips", createTripHandler)
    .get("/trips/:envelopeId", getTripHandler)
    .patch("/trips/:envelopeId", (c) => updateTripHandler(c, options))
    .post("/trips/:envelopeId/components", addTripComponentHandler)
    .post("/trips/:envelopeId/components/reorder", (c) => reorderTripComponentsHandler(c, options))
    .post("/trips/:envelopeId/price", (c) => priceTripHandler(c, options))
    .post("/trips/:envelopeId/reserve", (c) => reserveTripHandler(c, options))
    .post("/trips/:envelopeId/checkout", (c) => startTripCheckoutHandler(c, options))
    .post("/trips/:envelopeId/cancellation-preview", (c) =>
      previewTripCancellationHandler(c, options),
    )
    .post("/trips/:envelopeId/cancel-components", (c) => cancelTripComponentsHandler(c, options))
    .patch("/components/:componentId", async (c) => {
      if (isPublicSurface(options)) return publicForbidden()
      try {
        const component = await travelComposerService.updateComponent(
          c.get("db"),
          c.req.param("componentId"),
          await parseJsonBody(c, updateTripComponentSchema),
        )
        if (!component) return c.json({ error: "Trip component not found" }, 404)
        return c.json({ data: component })
      } catch (error) {
        const { message, status } = routeError(error)
        return c.json({ error: message }, status)
      }
    })
    .post("/components/:componentId/refs", async (c) => {
      if (isPublicSurface(options)) return publicForbidden()
      try {
        const component = await travelComposerService.updateComponentRefs(
          c.get("db"),
          c.req.param("componentId"),
          await parseJsonBody(c, updateTripComponentRefsSchema),
        )
        if (!component) return c.json({ error: "Trip component not found" }, 404)
        return c.json({ data: component })
      } catch (error) {
        const { message, status } = routeError(error)
        return c.json({ error: message }, status)
      }
    })
    .delete("/components/:componentId", async (c) => {
      if (isPublicSurface(options)) return publicForbidden()
      try {
        const component = await travelComposerService.removeComponent(
          c.get("db"),
          c.req.param("componentId"),
        )
        if (!component) return c.json({ error: "Trip component not found" }, 404)
        return c.json({ data: component })
      } catch (error) {
        const { message, status } = routeError(error)
        return c.json({ error: message }, status)
      }
    })
}

export const travelComposerRoutes = createTravelComposerRoutes()

export type TravelComposerRoutes = ReturnType<typeof createTravelComposerRoutes>

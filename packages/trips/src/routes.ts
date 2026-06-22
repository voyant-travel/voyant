import type { AnyDrizzleDb } from "@voyant-travel/db"
import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { Context } from "hono"
import { Hono } from "hono"

import {
  type CancelTripComponentsDeps,
  type PriceTripDeps,
  type ReserveTripDeps,
  type SourceRequirementCandidatesDeps,
  type StartCheckoutDeps,
  TripsInvariantError,
  tripsService,
} from "./service.js"
import {
  addRequirementSchema,
  cancelTripComponentsSchema,
  createTripComponentBodySchema,
  createTripEnvelopeSchema,
  createTripSnapshotSchema,
  listTripsQuerySchema,
  previewTripCancellationSchema,
  priceTripSchema,
  reorderTripComponentsSchema,
  reserveTripSchema,
  reshopTripSchema,
  selectCandidateSchema,
  sourceRequirementCandidatesSchema,
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

export interface TripsRoutesOptions {
  surface?: "admin" | "public"
  priceTripDeps?: TripsRouteDeps<PriceTripDeps>
  reserveTripDeps?: TripsRouteDeps<ReserveTripDeps>
  startCheckoutDeps?: TripsRouteDeps<StartCheckoutDeps>
  cancelTripComponentsDeps?: TripsRouteDeps<CancelTripComponentsDeps>
  /** Availability fan-out wiring for requirement sourcing / re-shop (RFC #2082). */
  sourceCandidatesDeps?: TripsRouteDeps<SourceRequirementCandidatesDeps>
}

export type TripsRouteDeps<T> = T | ((c: Context<Env>) => T | undefined)

const priceTripBodySchema = priceTripSchema.omit({ envelopeId: true })
const createTripSnapshotBodySchema = createTripSnapshotSchema.omit({ envelopeId: true })
const reserveTripBodySchema = reserveTripSchema.omit({ envelopeId: true })
const startCheckoutBodySchema = startTripCheckoutSchema.omit({ envelopeId: true })
const previewCancellationBodySchema = previewTripCancellationSchema.omit({ envelopeId: true })
const cancelTripComponentsBodySchema = cancelTripComponentsSchema.omit({ envelopeId: true })
const addRequirementBodySchema = addRequirementSchema.omit({ envelopeId: true })
const sourceCandidatesBodySchema = sourceRequirementCandidatesSchema.omit({ requirementId: true })
const selectCandidateBodySchema = selectCandidateSchema.omit({ requirementId: true })
const reshopTripBodySchema = reshopTripSchema.omit({ envelopeId: true })

function routeError(error: unknown): { message: string; status: 400 | 404 | 409 } {
  if (error instanceof TripsInvariantError) {
    return {
      message: error.message,
      status: error.message.includes("was not found") ? 404 : 409,
    }
  }

  return {
    message: error instanceof Error ? error.message : "Trips route failed",
    status: 400,
  }
}

function resolveRouteDeps<T>(c: Context<Env>, deps: TripsRouteDeps<T> | undefined) {
  if (typeof deps !== "function") return deps
  const resolver = deps as (c: Context<Env>) => T | undefined
  return resolver(c)
}

function isPublicSurface(options: TripsRoutesOptions): boolean {
  return options.surface === "public"
}

function publicForbidden() {
  return new Response(JSON.stringify({ error: "Trips operation is admin-only" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  })
}

function envelopeIdParam(c: Context<Env>): string {
  const envelopeId = c.req.param("envelopeId")
  if (!envelopeId) throw new TripsInvariantError("Trip envelope id is required")
  return envelopeId
}
function requirementIdParam(c: Context<Env>): string {
  const requirementId = c.req.param("requirementId")
  if (!requirementId) throw new TripsInvariantError("Trip requirement id is required")
  return requirementId
}

function snapshotIdParam(c: Context<Env>): string {
  const snapshotId = c.req.param("snapshotId")
  if (!snapshotId) throw new TripsInvariantError("Trip snapshot id is required")
  return snapshotId
}

async function listTripsHandler(c: Context<Env>) {
  const query = parseQuery(c, listTripsQuerySchema)
  return c.json(await tripsService.listTrips(c.get("db"), query))
}

async function createTripHandler(c: Context<Env>) {
  try {
    const trip = await tripsService.createTrip(
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
  const trip = await tripsService.getTrip(c.get("db"), envelopeIdParam(c))
  if (!trip) return c.json({ error: "Trip envelope not found" }, 404)
  return c.json({ data: trip })
}

async function listTripSnapshotsHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  return c.json({
    data: await tripsService.listTripSnapshots(c.get("db"), envelopeIdParam(c)),
  })
}

async function createTripSnapshotHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const body = await parseJsonBody(c, createTripSnapshotBodySchema)
    const snapshot = await tripsService.freezeTripSnapshot(c.get("db"), {
      ...body,
      envelopeId: envelopeIdParam(c),
    })
    return c.json({ data: snapshot }, 201)
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function getTripSnapshotHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  const snapshot = await tripsService.getTripSnapshotById(c.get("db"), snapshotIdParam(c))
  if (!snapshot) return c.json({ error: "Trip snapshot not found" }, 404)
  return c.json({ data: snapshot })
}

async function updateTripHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const envelope = await tripsService.updateTrip(
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
    const component = await tripsService.addComponent(c.get("db"), {
      ...body,
      envelopeId: envelopeIdParam(c),
    })
    return c.json({ data: component }, 201)
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function reorderTripComponentsHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const body = await parseJsonBody(c, reorderTripComponentsSchema.omit({ envelopeId: true }))
    const components = await tripsService.reorderComponents(c.get("db"), {
      ...body,
      envelopeId: envelopeIdParam(c),
    })
    return c.json({ data: components })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function priceTripHandler(c: Context<Env>, options: TripsRoutesOptions) {
  const deps = resolveRouteDeps(c, options.priceTripDeps)
  if (!deps) {
    return c.json({ error: "Trips price dependencies are not configured" }, 501)
  }

  try {
    const body = await parseJsonBody(c, priceTripBodySchema)
    const result = await tripsService.priceTrip(
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

async function reserveTripHandler(c: Context<Env>, options: TripsRoutesOptions) {
  const deps = resolveRouteDeps(c, options.reserveTripDeps)
  if (!deps) {
    return c.json({ error: "Trips reserve dependencies are not configured" }, 501)
  }

  try {
    const body = await parseJsonBody(c, reserveTripBodySchema)
    const result = await tripsService.reserveTrip(
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

async function startTripCheckoutHandler(c: Context<Env>, options: TripsRoutesOptions) {
  const deps = resolveRouteDeps(c, options.startCheckoutDeps)
  if (!deps) {
    return c.json({ error: "Trips checkout dependencies are not configured" }, 501)
  }

  try {
    const body = await parseJsonBody(c, startCheckoutBodySchema)
    const result = await tripsService.startCheckout(
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

async function previewTripCancellationHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const body = await parseJsonBody(c, previewCancellationBodySchema)
    const deps = resolveRouteDeps(c, options.cancelTripComponentsDeps)
    const result = await tripsService.previewCancellation(
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

async function cancelTripComponentsHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const body = await parseJsonBody(c, cancelTripComponentsBodySchema)
    const deps = resolveRouteDeps(c, options.cancelTripComponentsDeps)
    const result = await tripsService.cancelComponents(
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

// ── Dynamic packaging: requirements + candidates (RFC #2082, admin-only) ──

async function addRequirementHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const body = await parseJsonBody(c, addRequirementBodySchema)
    const requirement = await tripsService.addRequirement(c.get("db"), {
      ...body,
      envelopeId: envelopeIdParam(c),
    })
    return c.json({ data: requirement }, 201)
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function listRequirementsHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const data = await tripsService.listEnvelopeRequirements(c.get("db"), envelopeIdParam(c))
    return c.json({ data })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function sourceCandidatesHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  const deps = resolveRouteDeps(c, options.sourceCandidatesDeps)
  if (!deps) {
    return c.json({ error: "Trips availability-sourcing dependencies are not configured" }, 501)
  }
  try {
    const body = await parseJsonBody(c, sourceCandidatesBodySchema)
    const result = await tripsService.sourceRequirementCandidates(
      c.get("db"),
      { ...body, requirementId: requirementIdParam(c) },
      deps,
    )
    return c.json({ data: result })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function selectCandidateHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  try {
    const body = await parseJsonBody(c, selectCandidateBodySchema)
    const result = await tripsService.selectCandidate(c.get("db"), {
      ...body,
      requirementId: requirementIdParam(c),
    })
    return c.json({ data: result })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function reshopRequirementHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  const deps = resolveRouteDeps(c, options.sourceCandidatesDeps)
  if (!deps) {
    return c.json({ error: "Trips availability-sourcing dependencies are not configured" }, 501)
  }
  try {
    const body = await parseJsonBody(c, sourceCandidatesBodySchema)
    const result = await tripsService.reshopRequirement(
      c.get("db"),
      { ...body, requirementId: requirementIdParam(c) },
      deps,
    )
    return c.json({ data: result })
  } catch (error) {
    const { message, status } = routeError(error)
    return c.json({ error: message }, status)
  }
}

async function reshopTripHandler(c: Context<Env>, options: TripsRoutesOptions) {
  if (isPublicSurface(options)) return publicForbidden()
  const deps = resolveRouteDeps(c, options.sourceCandidatesDeps)
  if (!deps) {
    return c.json({ error: "Trips availability-sourcing dependencies are not configured" }, 501)
  }
  try {
    const body = await parseJsonBody(c, reshopTripBodySchema)
    const result = await tripsService.reshopTrip(
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

export function createTripsRoutes(options: TripsRoutesOptions = {}) {
  return new Hono<Env>()
    .get("/health", (c) => {
      return c.json({ data: tripsService.getStatus() })
    })
    .get("/", listTripsHandler)
    .post("/", createTripHandler)
    .get("/:envelopeId", getTripHandler)
    .get("/:envelopeId/snapshots", (c) => listTripSnapshotsHandler(c, options))
    .post("/:envelopeId/snapshots", (c) => createTripSnapshotHandler(c, options))
    .get("/snapshots/:snapshotId", (c) => getTripSnapshotHandler(c, options))
    .patch("/:envelopeId", (c) => updateTripHandler(c, options))
    .post("/:envelopeId/components", addTripComponentHandler)
    .post("/:envelopeId/components/reorder", (c) => reorderTripComponentsHandler(c, options))
    .post("/:envelopeId/requirements", (c) => addRequirementHandler(c, options))
    .get("/:envelopeId/requirements", (c) => listRequirementsHandler(c, options))
    .post("/:envelopeId/reshop", (c) => reshopTripHandler(c, options))
    .post("/requirements/:requirementId/candidates", (c) => sourceCandidatesHandler(c, options))
    .post("/requirements/:requirementId/select", (c) => selectCandidateHandler(c, options))
    .post("/requirements/:requirementId/reshop", (c) => reshopRequirementHandler(c, options))
    .post("/:envelopeId/price", (c) => priceTripHandler(c, options))
    .post("/:envelopeId/reserve", (c) => reserveTripHandler(c, options))
    .post("/:envelopeId/checkout", (c) => startTripCheckoutHandler(c, options))
    .post("/:envelopeId/cancellation-preview", (c) => previewTripCancellationHandler(c, options))
    .post("/:envelopeId/cancel-components", (c) => cancelTripComponentsHandler(c, options))
    .patch("/components/:componentId", async (c) => {
      if (isPublicSurface(options)) return publicForbidden()
      try {
        const component = await tripsService.updateComponent(
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
        const component = await tripsService.updateComponentRefs(
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
        const component = await tripsService.removeComponent(
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

export const tripsRoutes = createTripsRoutes()

export type TripsRoutes = ReturnType<typeof createTripsRoutes>

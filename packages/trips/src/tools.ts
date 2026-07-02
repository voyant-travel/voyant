/**
 * Trips agent tools on the framework tool contract (`@voyant-travel/tools`).
 *
 * These replace the bespoke `mcp-*.ts` surface: each tool is a headless
 * `defineTool` returning **typed pure data** (no MCP envelopes). The trips
 * service is injected on the context by intersection (`TripsToolContext`), so
 * this module stays deployment-agnostic — the operator binds the services to its
 * request `db` and mounts the registry through `@voyant-travel/mcp`.
 */
import {
  defineTool,
  READ_ONLY_RISK,
  requireService,
  type ToolContext,
  ToolError,
} from "@voyant-travel/tools"
import { z } from "zod"

import type { TripComponent } from "./schema.js"
import type { PriceTripResult, ReserveTripResult, Trip } from "./service.js"
import {
  createTripComponentBodySchema,
  type createTripComponentSchema,
  createTripEnvelopeSchema,
  priceTripSchema,
  reserveTripSchema,
} from "./validation.js"

/** The trips service surface a deployment binds into the tool context. */
export interface TripsToolServices {
  createTrip(input: z.infer<typeof createTripEnvelopeSchema>): Promise<Trip>
  addComponent(input: z.infer<typeof createTripComponentSchema>): Promise<TripComponent>
  removeComponent?(componentId: string): Promise<TripComponent | null>
  priceTrip(input: z.infer<typeof priceTripSchema>): Promise<PriceTripResult>
  reserveTrip(input: z.infer<typeof reserveTripSchema>): Promise<ReserveTripResult>
}

/** Tool context with the trips service injected. */
export type TripsToolContext = ToolContext & { trips?: TripsToolServices }

function trips(ctx: TripsToolContext): TripsToolServices {
  return requireService(ctx.trips, "trips")
}

const createTripArgs = createTripEnvelopeSchema.extend({
  components: z.array(createTripComponentBodySchema).default([]),
})
export type CreateTripArgs = z.infer<typeof createTripArgs>

export interface CreateTripResult {
  envelope: Trip["envelope"]
  components: TripComponent[]
}

export const createTripTool = defineTool<CreateTripArgs, CreateTripResult, TripsToolContext>({
  name: "create_trip",
  description:
    "Create a deterministic trip envelope and optional components for a composed itinerary. " +
    "Use this before pricing or reserving a cross-vertical trip.",
  inputSchema: createTripArgs,
  outputSchema: z.custom<CreateTripResult>(),
  requiredScopes: ["trips:write"],
  tier: "write",
  riskPolicy: { destructive: false, reversible: true, dryRunSupported: false },
  async handler(args, ctx) {
    const composer = trips(ctx)
    const trip = await composer.createTrip({
      title: args.title,
      description: args.description,
      travelerParty: args.travelerParty,
      constraints: args.constraints,
      createdBy: args.createdBy,
    })

    const components: TripComponent[] = []
    for (const component of args.components) {
      components.push(await composer.addComponent({ ...component, envelopeId: trip.envelope.id }))
    }

    return { envelope: trip.envelope, components }
  },
})

const reviseTripArgs = z.object({
  envelopeId: z.string().min(1),
  addComponents: z.array(createTripComponentBodySchema).default([]),
  removeComponentIds: z.array(z.string().min(1)).default([]),
})
export type ReviseTripArgs = z.infer<typeof reviseTripArgs>

export interface ReviseTripResult {
  envelopeId: string
  added: TripComponent[]
  removed: TripComponent[]
}

export const reviseTripTool = defineTool<ReviseTripArgs, ReviseTripResult, TripsToolContext>({
  name: "revise_trip",
  description:
    "Revise a deterministic trip envelope by adding components or removing uncommitted components. " +
    "This does not mutate committed bookings directly.",
  inputSchema: reviseTripArgs,
  outputSchema: z.custom<ReviseTripResult>(),
  requiredScopes: ["trips:write"],
  tier: "write",
  riskPolicy: { destructive: false, reversible: true, dryRunSupported: false },
  async handler(args, ctx) {
    const composer = trips(ctx)
    const added: TripComponent[] = []
    const removed: TripComponent[] = []

    for (const component of args.addComponents) {
      added.push(await composer.addComponent({ ...component, envelopeId: args.envelopeId }))
    }

    if (args.removeComponentIds.length > 0 && !composer.removeComponent) {
      throw new ToolError("Trips removeComponent service is not configured.", "MISSING_SERVICE", {
        service: "trips.removeComponent",
      })
    }

    for (const componentId of args.removeComponentIds) {
      const result = await composer.removeComponent?.(componentId)
      if (result) removed.push(result)
    }

    return { envelopeId: args.envelopeId, added, removed }
  },
})

export type PriceTripArgs = z.infer<typeof priceTripSchema>

export const priceTripTool = defineTool<PriceTripArgs, PriceTripResult, TripsToolContext>({
  name: "price_trip",
  description:
    "Price a deterministic trip. Returns aggregate totals, component statuses, warnings, " +
    "failures, and quote expiry data.",
  inputSchema: priceTripSchema,
  outputSchema: z.custom<PriceTripResult>(),
  requiredScopes: ["trips:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(args, ctx) {
    return trips(ctx).priceTrip(args)
  },
})

export type ReserveTripArgs = z.infer<typeof reserveTripSchema>

export const reserveTripTool = defineTool<ReserveTripArgs, ReserveTripResult, TripsToolContext>({
  name: "reserve_trip",
  description:
    "Reserve a priced trip through deterministic trips services. Partial failures return " +
    "explicit compensation and staff-remediation state.",
  inputSchema: reserveTripSchema,
  outputSchema: z.custom<ReserveTripResult>(),
  requiredScopes: ["trips:write"],
  tier: "destructive",
  riskPolicy: {
    destructive: true,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: true,
    sideEffects: ["external-booking", "payment"],
  },
  async handler(args, ctx) {
    return trips(ctx).reserveTrip(args)
  },
})

/** All trips agent tools, ready to register on a `ToolRegistry`. */
export const tripsTools = [createTripTool, reviseTripTool, priceTripTool, reserveTripTool] as const

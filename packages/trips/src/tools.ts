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
  type Visibility,
} from "@voyant-travel/tools"
import { z } from "zod"

import type { TripComponent } from "./schema.js"
import type {
  PriceTripResult as ServicePriceTripResult,
  ReserveTripResult as ServiceReserveTripResult,
  Trip,
} from "./service.js"
import {
  createTripResultSchema,
  priceTripResultSchema,
  reserveTripResultSchema,
  reviseTripResultSchema,
} from "./tool-output-schemas.js"
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
  priceTrip(input: z.infer<typeof priceTripSchema>): Promise<ServicePriceTripResult>
  reserveTrip(input: z.infer<typeof reserveTripSchema>): Promise<ServiceReserveTripResult>
}

/** Tool context with the trips service injected. */
export type TripsToolContext = ToolContext & { trips?: TripsToolServices }

function trips(ctx: TripsToolContext): TripsToolServices {
  return requireService(ctx.trips, "trips")
}

function assertToolAudience(ctx: TripsToolContext, audience: Visibility): void {
  if (ctx.actor === "staff" || audience === ctx.audience) return
  throw new ToolError(
    `Actor "${ctx.actor}" is not authorized to query audience "${audience}". Non-staff tools may only use their grant audience.`,
    "AUTHORIZATION_DENIED",
    { actor: ctx.actor, grantAudience: ctx.audience, requestedAudience: audience },
  )
}

const createTripArgs = createTripEnvelopeSchema.extend({
  components: z.array(createTripComponentBodySchema).default([]),
})
export type CreateTripArgs = z.infer<typeof createTripArgs>

export type CreateTripResult = z.output<typeof createTripResultSchema>

export const createTripTool = defineTool<CreateTripArgs, CreateTripResult, TripsToolContext>({
  name: "create_trip",
  description:
    "Create a deterministic trip envelope and optional components for a composed itinerary. " +
    "Use this before pricing or reserving a cross-vertical trip.",
  inputSchema: createTripArgs,
  outputSchema: createTripResultSchema,
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

    return parseJsonResult(createTripResultSchema, { envelope: trip.envelope, components })
  },
})

const reviseTripArgs = z.object({
  envelopeId: z.string().min(1),
  addComponents: z.array(createTripComponentBodySchema).default([]),
  removeComponentIds: z.array(z.string().min(1)).default([]),
})
export type ReviseTripArgs = z.infer<typeof reviseTripArgs>

export type ReviseTripResult = z.output<typeof reviseTripResultSchema>

export const reviseTripTool = defineTool<ReviseTripArgs, ReviseTripResult, TripsToolContext>({
  name: "revise_trip",
  description:
    "Revise a deterministic trip envelope by adding components or removing uncommitted components. " +
    "This does not mutate committed bookings directly.",
  inputSchema: reviseTripArgs,
  outputSchema: reviseTripResultSchema,
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

    return parseJsonResult(reviseTripResultSchema, {
      envelopeId: args.envelopeId,
      added,
      removed,
    })
  },
})

export type PriceTripArgs = z.infer<typeof priceTripSchema>
export type PriceTripResult = z.output<typeof priceTripResultSchema>

export const priceTripTool = defineTool<PriceTripArgs, PriceTripResult, TripsToolContext>({
  name: "price_trip",
  description:
    "Price a deterministic trip. Returns aggregate totals, component statuses, warnings, " +
    "failures, and quote expiry data.",
  inputSchema: priceTripSchema,
  outputSchema: priceTripResultSchema,
  requiredScopes: ["trips:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(args, ctx) {
    assertToolAudience(ctx, args.scope.audience)
    return parseJsonResult(priceTripResultSchema, await trips(ctx).priceTrip(args))
  },
})

export type ReserveTripArgs = z.infer<typeof reserveTripSchema>
export type ReserveTripResult = z.output<typeof reserveTripResultSchema>

export const reserveTripTool = defineTool<ReserveTripArgs, ReserveTripResult, TripsToolContext>({
  name: "reserve_trip",
  description:
    "Reserve a priced trip through deterministic trips services. Partial failures return " +
    "explicit compensation and staff-remediation state.",
  inputSchema: reserveTripSchema,
  outputSchema: reserveTripResultSchema,
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
    if (args.refreshScope) assertToolAudience(ctx, args.refreshScope.audience)
    return parseJsonResult(reserveTripResultSchema, await trips(ctx).reserveTrip(args))
  },
})

/** All trips agent tools, ready to register on a `ToolRegistry`. */
export const tripsTools = [createTripTool, reviseTripTool, priceTripTool, reserveTripTool] as const

function parseJsonResult<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return schema.parse(toJsonValue(value))
}

function toJsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toJsonValue)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, nested]) => [key, toJsonValue(nested)] as const)
      .filter(([, nested]) => nested !== undefined),
  )
}

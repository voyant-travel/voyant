import { z } from "zod"
import type { McpToolContext, McpToolDefinition, McpToolResult } from "./mcp-contract.js"
import { McpToolError } from "./mcp-contract.js"
import type { TripComponent } from "./schema.js"
import type { PriceTripResult, ReserveTripResult, Trip } from "./service.js"
import {
  createTripComponentBodySchema,
  type createTripComponentSchema,
  createTripEnvelopeSchema,
  priceTripSchema,
  reserveTripSchema,
} from "./validation.js"

export interface TravelComposerMcpServices {
  createTrip(input: z.infer<typeof createTripEnvelopeSchema>): Promise<Trip>
  addComponent(input: z.infer<typeof createTripComponentSchema>): Promise<TripComponent>
  removeComponent?(componentId: string): Promise<TripComponent | null>
  priceTrip(input: z.infer<typeof priceTripSchema>): Promise<PriceTripResult>
  reserveTrip(input: z.infer<typeof reserveTripSchema>): Promise<ReserveTripResult>
}

type TravelComposerMcpContext = McpToolContext & {
  travelComposer?: TravelComposerMcpServices
}

const createTripArgs = createTripEnvelopeSchema.extend({
  components: z.array(createTripComponentBodySchema).default([]),
})

export type CreateTripArgs = z.infer<typeof createTripArgs>

export const createTripTool: McpToolDefinition<CreateTripArgs, McpToolResult> = {
  name: "create_trip",
  description:
    "Create a deterministic trip envelope and optional components for a composed itinerary. " +
    "Use this before pricing or reserving a cross-vertical trip.",
  inputSchema: createTripArgs,
  async handler(args, rawContext) {
    const context = rawContext as TravelComposerMcpContext
    const composer = requireTravelComposer(context)
    const trip = await composer.createTrip({
      title: args.title,
      description: args.description,
      travelerParty: args.travelerParty,
      constraints: args.constraints,
      createdBy: args.createdBy,
    })

    const components: TripComponent[] = []
    for (const component of args.components) {
      components.push(
        await composer.addComponent({
          ...component,
          envelopeId: trip.envelope.id,
        }),
      )
    }

    return tripResult("Created trip", {
      envelope: trip.envelope,
      components,
    })
  },
}

const reviseTripArgs = z.object({
  envelopeId: z.string().min(1),
  addComponents: z.array(createTripComponentBodySchema).default([]),
  removeComponentIds: z.array(z.string().min(1)).default([]),
})

export type ReviseTripArgs = z.infer<typeof reviseTripArgs>

export const reviseTripTool: McpToolDefinition<ReviseTripArgs, McpToolResult> = {
  name: "revise_trip",
  description:
    "Revise a deterministic trip envelope by adding components or removing uncommitted components. " +
    "This does not mutate committed bookings directly.",
  inputSchema: reviseTripArgs,
  async handler(args, rawContext) {
    const context = rawContext as TravelComposerMcpContext
    const composer = requireTravelComposer(context)
    const added: TripComponent[] = []
    const removed: TripComponent[] = []

    for (const component of args.addComponents) {
      added.push(await composer.addComponent({ ...component, envelopeId: args.envelopeId }))
    }

    if (args.removeComponentIds.length > 0 && !composer.removeComponent) {
      throw new McpToolError(
        "Travel composer MCP service removeComponent is not configured.",
        "MISSING_SERVICE",
        { service: "travelComposer.removeComponent" },
      )
    }

    for (const componentId of args.removeComponentIds) {
      const result = await composer.removeComponent?.(componentId)
      if (result) removed.push(result)
    }

    return tripResult("Revised trip", {
      envelopeId: args.envelopeId,
      added,
      removed,
    })
  },
}

export type PriceTripArgs = z.infer<typeof priceTripSchema>

export const priceTripTool: McpToolDefinition<PriceTripArgs, McpToolResult> = {
  name: "price_trip",
  description:
    "Price a deterministic trip through the travel composer. Returns aggregate totals, " +
    "component statuses, warnings, failures, and quote expiry data.",
  inputSchema: priceTripSchema,
  async handler(args, rawContext) {
    const context = rawContext as TravelComposerMcpContext
    const composer = requireTravelComposer(context)
    const result = await composer.priceTrip(args)
    return tripResult("Priced trip", result)
  },
}

export type ReserveTripArgs = z.infer<typeof reserveTripSchema>

export const reserveTripTool: McpToolDefinition<ReserveTripArgs, McpToolResult> = {
  name: "reserve_trip",
  description:
    "Reserve a priced trip through deterministic travel composer services. " +
    "Partial failures return explicit compensation and staff-remediation state.",
  inputSchema: reserveTripSchema,
  async handler(args, rawContext) {
    const context = rawContext as TravelComposerMcpContext
    const composer = requireTravelComposer(context)
    const result = await composer.reserveTrip(args)
    return tripResult("Reserved trip", result)
  },
}

export const travelComposerMcpTools = [
  createTripTool,
  reviseTripTool,
  priceTripTool,
  reserveTripTool,
] as const

function requireTravelComposer(context: TravelComposerMcpContext): TravelComposerMcpServices {
  if (!context.travelComposer) {
    throw new McpToolError(
      "MCP tool requires travel composer services to be wired into the context.",
      "MISSING_SERVICE",
      { service: "travelComposer" },
    )
  }
  return context.travelComposer
}

function tripResult(message: string, structuredContent: object): McpToolResult {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: structuredContent as Record<string, unknown>,
  }
}

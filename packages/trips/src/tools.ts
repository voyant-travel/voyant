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
  admitHandlerActionPolicy,
  defineTool,
  type HandlerActionPolicyExpectation,
  READ_ONLY_RISK,
  requireService,
  type ToolContext,
  ToolError,
  type ToolHandlerActionPolicyContext,
  type Visibility,
} from "@voyant-travel/tools"
import { z } from "zod"

import type { TripComponent } from "./schema.js"
import type {
  PriceTripResult as ServicePriceTripResult,
  ReserveTripResult as ServiceReserveTripResult,
} from "./service.js"
import {
  priceTripResultSchema,
  reserveTripResultSchema,
  reshopTripResultSchema,
  reviseTripResultSchema,
  selectTripCandidateResultSchema,
  sourceTripCandidatesResultSchema,
  tripRequirementToolSchema,
} from "./tool-output-schemas.js"
import {
  addRequirementSchema,
  createTripComponentBodySchema,
  type createTripComponentSchema,
  createTripEnvelopeSchema,
  priceTripSchema,
  reserveTripSchema,
  reshopTripSchema,
  selectCandidateSchema,
  sourceRequirementCandidatesSchema,
} from "./validation.js"

const OWNER = "@voyant-travel/trips"
const VERSION = "v1"
const STAFF_AUDIENCE = { source: "grant", allowed: ["staff"] } as const
const REQUIREMENT_WRITE_RISK = {
  destructive: false,
  reversible: true,
  dryRunSupported: false,
  confirmationRequired: false,
  sideEffects: ["data-write"],
} as const
const CANDIDATE_WRITE_RISK = {
  destructive: false,
  reversible: true,
  dryRunSupported: false,
  confirmationRequired: false,
  sideEffects: ["data-write"],
} as const
const CANDIDATE_SELECTION_RISK = {
  destructive: false,
  reversible: true,
  dryRunSupported: false,
  confirmationRequired: true,
  sideEffects: ["data-write"],
} as const
const RESHOP_RISK = {
  destructive: true,
  reversible: true,
  dryRunSupported: false,
  confirmationRequired: true,
  sideEffects: ["data-write"],
} as const
export const CREATE_TRIP_HANDLER_POLICY = {
  capabilityId: `${OWNER}#tool.create-trip`,
  capabilityVersion: VERSION,
  canonicalName: "create_trip",
  actionPolicy: {
    id: `${OWNER}#action.create-trip`,
    capabilityId: `${OWNER}#action.create-trip`,
    version: VERSION,
    kind: "execute",
    targetType: "trip",
    targetLifecycle: "created",
    createdTarget: {
      commandTargetType: "trip-create-command",
      resultReferenceType: "trip",
      durability: "handler-command-claim-v1",
    },
    risk: "medium",
    ledger: "required",
    approval: "never",
    reversible: false,
  },
} as const satisfies HandlerActionPolicyExpectation

/** The trips service surface a deployment binds into the tool context. */
export interface TripsToolServices {
  createTrip(
    input: CreateTripArgs,
    admitted: ToolHandlerActionPolicyContext,
  ): Promise<{ envelopeId: string }>
  addComponent(input: z.infer<typeof createTripComponentSchema>): Promise<TripComponent>
  removeComponent?(componentId: string): Promise<TripComponent | null>
  priceTrip(input: z.infer<typeof priceTripSchema>): Promise<ServicePriceTripResult>
  reserveTrip(input: z.infer<typeof reserveTripSchema>): Promise<ServiceReserveTripResult>
  addRequirement(input: z.infer<typeof addRequirementSchema>): Promise<unknown>
  sourceRequirementCandidates(
    input: z.infer<typeof sourceRequirementCandidatesSchema>,
  ): Promise<unknown>
  selectCandidate(input: z.infer<typeof selectCandidateSchema>): Promise<unknown>
  reshopRequirement(input: z.infer<typeof sourceRequirementCandidatesSchema>): Promise<unknown>
  reshopTrip(input: z.infer<typeof reshopTripSchema>): Promise<unknown>
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
  idempotencyKey: z.string().trim().min(1).max(255).optional(),
})
export type CreateTripArgs = z.infer<typeof createTripArgs>

const createTripReferenceSchema = z.object({ envelopeId: z.string() })
export type CreateTripResult = z.output<typeof createTripReferenceSchema>

export const createTripTool = defineTool<CreateTripArgs, CreateTripResult, TripsToolContext>({
  name: "create_trip",
  description:
    "Create a deterministic trip envelope and optional components for a composed itinerary. " +
    "Use this before pricing or reserving a cross-vertical trip.",
  inputSchema: createTripArgs,
  outputSchema: createTripReferenceSchema,
  requiredScopes: ["trips:write"],
  tier: "write",
  riskPolicy: { destructive: false, reversible: true, dryRunSupported: false },
  actionPolicyEnforcement: "handler",
  annotations: { idempotentHint: true },
  async handler(args, ctx) {
    const admitted = admitHandlerActionPolicy(ctx, CREATE_TRIP_HANDLER_POLICY)
    return createTripReferenceSchema.parse(await trips(ctx).createTrip(args, admitted))
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

export const addTripRequirementTool = defineTool({
  capabilityId: `${OWNER}#tool.add-requirement`,
  capabilityVersion: VERSION,
  name: "add_trip_requirement",
  description:
    "Add an unresolved customer need to a mutable trip envelope so it can be sourced into provider-neutral candidates.",
  inputSchema: addRequirementSchema,
  outputSchema: tripRequirementToolSchema,
  requiredScopes: ["trips:write"],
  audience: STAFF_AUDIENCE,
  tier: "write",
  riskPolicy: REQUIREMENT_WRITE_RISK,
  async handler(input, ctx: TripsToolContext) {
    return parseJsonResult(tripRequirementToolSchema, await trips(ctx).addRequirement(input))
  },
})

export const sourceTripRequirementCandidatesTool = defineTool({
  capabilityId: `${OWNER}#tool.source-requirement-candidates`,
  capabilityVersion: VERSION,
  name: "source_trip_requirement_candidates",
  description:
    "Run the selected provider-neutral catalog availability fan-out for one unresolved trip requirement and persist fresh ranked candidates.",
  inputSchema: sourceRequirementCandidatesSchema,
  outputSchema: sourceTripCandidatesResultSchema,
  requiredScopes: ["trips:write"],
  audience: STAFF_AUDIENCE,
  tier: "write",
  riskPolicy: CANDIDATE_WRITE_RISK,
  async handler(input, ctx: TripsToolContext) {
    assertToolAudience(ctx, input.scope.audience)
    return parseJsonResult(
      sourceTripCandidatesResultSchema,
      await trips(ctx).sourceRequirementCandidates(input),
    )
  },
})

export const selectTripCandidateTool = defineTool({
  capabilityId: `${OWNER}#tool.select-candidate`,
  capabilityVersion: VERSION,
  name: "select_trip_candidate",
  description:
    "Select a still-valid ranked candidate for a trip requirement and pin it as a draft trip component.",
  inputSchema: selectCandidateSchema,
  outputSchema: selectTripCandidateResultSchema,
  requiredScopes: ["trips:write"],
  audience: STAFF_AUDIENCE,
  tier: "write",
  riskPolicy: CANDIDATE_SELECTION_RISK,
  async handler(input, ctx: TripsToolContext) {
    return parseJsonResult(selectTripCandidateResultSchema, await trips(ctx).selectCandidate(input))
  },
})

export const reshopTripRequirementTool = defineTool({
  capabilityId: `${OWNER}#tool.reshop-requirement`,
  capabilityVersion: VERSION,
  name: "reshop_trip_requirement",
  description:
    "Retire a requirement's prior pinned component and source a fresh provider-neutral ranked candidate set.",
  inputSchema: sourceRequirementCandidatesSchema,
  outputSchema: sourceTripCandidatesResultSchema,
  requiredScopes: ["trips:write"],
  audience: STAFF_AUDIENCE,
  tier: "destructive",
  riskPolicy: RESHOP_RISK,
  async handler(input, ctx: TripsToolContext) {
    assertToolAudience(ctx, input.scope.audience)
    return parseJsonResult(
      sourceTripCandidatesResultSchema,
      await trips(ctx).reshopRequirement(input),
    )
  },
})

export const reshopTripTool = defineTool({
  capabilityId: `${OWNER}#tool.reshop-trip`,
  capabilityVersion: VERSION,
  name: "reshop_trip",
  description:
    "Retire prior selections and run fresh provider-neutral candidate sourcing for every requirement on a trip envelope.",
  inputSchema: reshopTripSchema,
  outputSchema: reshopTripResultSchema,
  requiredScopes: ["trips:write"],
  audience: STAFF_AUDIENCE,
  tier: "destructive",
  riskPolicy: RESHOP_RISK,
  async handler(input, ctx: TripsToolContext) {
    assertToolAudience(ctx, input.scope.audience)
    return parseJsonResult(reshopTripResultSchema, await trips(ctx).reshopTrip(input))
  },
})

/** All trips agent tools, ready to register on a `ToolRegistry`. */
export const tripsTools = [
  createTripTool,
  reviseTripTool,
  priceTripTool,
  reserveTripTool,
  addTripRequirementTool,
  sourceTripRequirementCandidatesTool,
  selectTripCandidateTool,
  reshopTripRequirementTool,
  reshopTripTool,
] as const

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

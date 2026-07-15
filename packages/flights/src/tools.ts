/** Provider-neutral flight search, pricing, order, ticketing, and cancellation Tools. */

import {
  flightCancelReasonSchema,
  flightCancelResponseSchema,
  flightGetOrderResponseSchema,
  flightOrdersListQuerySchema,
  flightOrdersListResponseSchema,
  flightPriceRequestSchema,
  flightPriceResponseSchema,
  flightSearchRequestSchema,
  flightSearchResponseSchema,
} from "@voyant-travel/flights-contracts/contract/schemas"
import {
  defineTool,
  READ_ONLY_RISK,
  requireService,
  type ToolContext,
  ToolError,
} from "@voyant-travel/tools"
import { z } from "zod"

const OWNER = "@voyant-travel/flights"
const STAFF_AUDIENCE = { source: "grant", allowed: ["staff"] } as const
const orderIdSchema = z.object({ orderId: z.string().min(1) })
const cancelOrderSchema = orderIdSchema.extend({ reason: flightCancelReasonSchema.optional() })

type FlightSearchInput = z.infer<typeof flightSearchRequestSchema>
type FlightPriceInput = z.infer<typeof flightPriceRequestSchema>
type FlightOrdersListInput = z.infer<typeof flightOrdersListQuerySchema>
type FlightCancelInput = z.infer<typeof cancelOrderSchema>

export interface FlightsToolServices {
  searchFlights(input: FlightSearchInput): Promise<unknown>
  priceOffer(input: FlightPriceInput): Promise<unknown>
  listOrders(input: FlightOrdersListInput): Promise<unknown>
  getOrder(orderId: string): Promise<unknown>
  ticketOrder(orderId: string): Promise<unknown>
  cancelOrder(input: FlightCancelInput): Promise<unknown>
}

export type FlightsToolContext = ToolContext & { flights?: FlightsToolServices }

function flights(ctx: FlightsToolContext): FlightsToolServices {
  return requireService(ctx.flights, "flights")
}

const readMetadata = {
  owner: OWNER,
  capabilityVersion: "v1",
  audience: STAFF_AUDIENCE,
  tier: "sensitive" as const,
  riskPolicy: READ_ONLY_RISK,
  annotations: { readOnlyHint: true, idempotentHint: true },
}
const offerReadMetadata = { ...readMetadata, tier: "read" as const }
const criticalWriteRisk = {
  destructive: true,
  reversible: false,
  dryRunSupported: false,
  confirmationRequired: true,
  sideEffects: ["external-booking", "payment"],
} as const

export const searchFlightsTool = defineTool({
  ...offerReadMetadata,
  capabilityId: `${OWNER}#tool.search`,
  name: "search_flights",
  description: "Search a configured flight connector for one-way, return, or multi-city offers.",
  requiredScopes: ["flights:write"],
  inputSchema: flightSearchRequestSchema,
  outputSchema: flightSearchResponseSchema,
  async handler(input, ctx: FlightsToolContext) {
    return flightSearchResponseSchema.parse(await flights(ctx).searchFlights(input))
  },
})

export const priceFlightOfferTool = defineTool({
  ...offerReadMetadata,
  capabilityId: `${OWNER}#tool.price-offer`,
  name: "price_flight_offer",
  description: "Re-price a flight offer and verify that it remains valid before booking.",
  requiredScopes: ["flights:write"],
  inputSchema: flightPriceRequestSchema,
  outputSchema: flightPriceResponseSchema,
  async handler(input, ctx: FlightsToolContext) {
    return flightPriceResponseSchema.parse(await flights(ctx).priceOffer(input))
  },
})

export const listFlightOrdersTool = defineTool({
  ...readMetadata,
  capabilityId: `${OWNER}#tool.list-orders`,
  name: "list_flight_orders",
  description: "List flight orders visible to the configured connector. Contains traveler data.",
  requiredScopes: ["flights:read"],
  inputSchema: flightOrdersListQuerySchema,
  outputSchema: flightOrdersListResponseSchema,
  async handler(input, ctx: FlightsToolContext) {
    return flightOrdersListResponseSchema.parse(await flights(ctx).listOrders(input))
  },
})

export const getFlightOrderTool = defineTool({
  ...readMetadata,
  capabilityId: `${OWNER}#tool.get-order`,
  name: "get_flight_order",
  description: "Read one flight order, travelers, itinerary, tickets, and totals.",
  requiredScopes: ["flights:read"],
  inputSchema: orderIdSchema,
  outputSchema: flightGetOrderResponseSchema,
  async handler({ orderId }, ctx: FlightsToolContext) {
    return flightGetOrderResponseSchema.parse(await flights(ctx).getOrder(orderId))
  },
})

export const ticketFlightOrderTool = defineTool({
  owner: OWNER,
  capabilityVersion: "v1",
  capabilityId: `${OWNER}#tool.ticket-order`,
  name: "ticket_flight_order",
  description: "Issue tickets for a held flight order through a connector that supports ticketing.",
  requiredScopes: ["flights:write"],
  audience: STAFF_AUDIENCE,
  tier: "destructive",
  riskPolicy: criticalWriteRisk,
  inputSchema: orderIdSchema,
  outputSchema: flightGetOrderResponseSchema,
  async handler({ orderId }, ctx: FlightsToolContext) {
    return flightGetOrderResponseSchema.parse(await flights(ctx).ticketOrder(orderId))
  },
})

export const cancelFlightOrderTool = defineTool({
  owner: OWNER,
  capabilityVersion: "v1",
  capabilityId: `${OWNER}#tool.cancel-order`,
  name: "cancel_flight_order",
  description: "Cancel a flight order through the connector; supplier refund rules may apply.",
  requiredScopes: ["flights:write"],
  audience: STAFF_AUDIENCE,
  tier: "destructive",
  riskPolicy: criticalWriteRisk,
  inputSchema: cancelOrderSchema,
  outputSchema: flightCancelResponseSchema,
  async handler(input, ctx: FlightsToolContext) {
    return flightCancelResponseSchema.parse(await flights(ctx).cancelOrder(input))
  },
})

export const flightsTools = [
  searchFlightsTool,
  priceFlightOfferTool,
  listFlightOrdersTool,
  getFlightOrderTool,
  ticketFlightOrderTool,
  cancelFlightOrderTool,
] as const

export function requireFlightCapabilityMethod<T extends (...args: never[]) => unknown>(
  method: T | undefined,
  operation: string,
): T {
  if (method) return method
  throw new ToolError(
    `The configured flight connector does not support ${operation}.`,
    "MISSING_SERVICE",
    { service: `flights.${operation}` },
  )
}

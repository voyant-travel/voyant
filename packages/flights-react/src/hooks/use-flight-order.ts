"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFlightsContext } from "../provider.js"
import { flightsQueryKeys } from "../query-keys.js"
import {
  type FlightCancelResponseDto,
  type FlightGetOrderResponseDto,
  flightCancelResponseSchema,
  flightGetOrderResponseSchema,
} from "../schemas.js"

export interface UseFlightOrderOptions {
  enabled?: boolean
}

/**
 * GET `/v1/admin/flights/orders/:orderId` — fetch a previously-booked order.
 * 404 surfaces as a query error; the consumer renders an "order not found"
 * fallback in that case.
 */
export function useFlightOrder(orderId: string | null, options: UseFlightOrderOptions = {}) {
  const client = useVoyantFlightsContext()
  const { enabled = true } = options
  return useQuery<FlightGetOrderResponseDto>({
    queryKey: flightsQueryKeys.orderDetail(orderId ?? ""),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/flights/orders/${encodeURIComponent(orderId ?? "")}`,
        flightGetOrderResponseSchema,
        client,
      ),
    enabled: enabled && !!orderId,
  })
}

export interface CancelOrderInput {
  orderId: string
  reason?: "customer_request" | "schedule_change" | "operational" | "fraud"
}

/**
 * POST `/v1/admin/flights/orders/:orderId/cancel`. Updates the cached
 * order on success so the confirmation page reflects the new "cancelled"
 * status without a refetch.
 */
export function useFlightOrderCancel() {
  const client = useVoyantFlightsContext()
  const qc = useQueryClient()
  return useMutation<FlightCancelResponseDto, Error, CancelOrderInput>({
    mutationFn: (input) =>
      fetchWithValidation(
        `/v1/admin/flights/orders/${encodeURIComponent(input.orderId)}/cancel`,
        flightCancelResponseSchema,
        client,
        {
          method: "POST",
          body: JSON.stringify(input.reason ? { reason: input.reason } : {}),
        },
      ),
    onSuccess: (data) => {
      qc.setQueryData(flightsQueryKeys.orderDetail(data.order.orderId), { order: data.order })
    },
  })
}

/**
 * POST `/v1/admin/flights/orders/:orderId/ticket` — promote a held order to
 * ticketed before its `paymentDeadline`. Capability-gated: connectors without
 * hold support 501. Updates the cached order on success so the detail page
 * reflects the new "ticketed" status without a refetch, and invalidates the
 * order list so the deadline / status column refreshes.
 */
export function useFlightOrderTicket() {
  const client = useVoyantFlightsContext()
  const qc = useQueryClient()
  return useMutation<FlightGetOrderResponseDto, Error, string>({
    mutationFn: (orderId) =>
      fetchWithValidation(
        `/v1/admin/flights/orders/${encodeURIComponent(orderId)}/ticket`,
        flightGetOrderResponseSchema,
        client,
        { method: "POST", body: JSON.stringify({}) },
      ),
    onSuccess: (data) => {
      qc.setQueryData(flightsQueryKeys.orderDetail(data.order.orderId), { order: data.order })
      qc.invalidateQueries({ queryKey: flightsQueryKeys.order() })
    },
  })
}

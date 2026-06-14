"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { FlightBookRequest } from "@voyant-travel/flights/contract/types"

import { fetchWithValidation } from "../client.js"
import { useVoyantFlightsContext } from "../provider.js"
import { flightsQueryKeys } from "../query-keys.js"
import { type FlightBookResponseDto, flightBookResponseSchema } from "../schemas.js"

/**
 * POST `/v1/admin/flights/book` — books the offer with the given passengers
 * and contact info. Mutation; on success invalidates the order query so the
 * confirmation page reads the just-created record.
 */
export function useFlightBook() {
  const client = useVoyantFlightsContext()
  const qc = useQueryClient()
  return useMutation<FlightBookResponseDto, Error, FlightBookRequest>({
    mutationFn: (input) =>
      fetchWithValidation("/v1/admin/flights/book", flightBookResponseSchema, client, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      qc.setQueryData(flightsQueryKeys.orderDetail(data.order.orderId), { order: data.order })
    },
  })
}

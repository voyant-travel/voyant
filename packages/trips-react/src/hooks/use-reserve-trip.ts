"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { writeReserveTripCache } from "../cache.js"
import { type ReserveTripBody, reserveTrip } from "../operations.js"
import { useVoyantTripsContext } from "../provider.js"

export function useReserveTrip(envelopeId: string | null | undefined) {
  const { baseUrl, fetcher } = useVoyantTripsContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ReserveTripBody = {}) => {
      if (!envelopeId) throw new Error("useReserveTrip requires an envelopeId")
      return reserveTrip({ baseUrl, fetcher }, envelopeId, input)
    },
    onSuccess: (result) => writeReserveTripCache(queryClient, result),
  })
}

"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantBookingRequirementsContext } from "../provider.js"
import type { BookingQuestionsListFilters } from "../query-keys.js"
import { getBookingQuestionsQueryOptions } from "../query-options.js"

export interface UseBookingQuestionsOptions extends BookingQuestionsListFilters {
  enabled?: boolean
}

export function useBookingQuestions(options: UseBookingQuestionsOptions = {}) {
  const client = useVoyantBookingRequirementsContext()
  const { enabled = true } = options
  return useQuery({ ...getBookingQuestionsQueryOptions(client, options), enabled })
}

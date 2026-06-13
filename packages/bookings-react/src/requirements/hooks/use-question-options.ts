"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantBookingRequirementsContext } from "../provider.js"
import type { BookingQuestionOptionsListFilters } from "../query-keys.js"
import { getQuestionOptionsQueryOptions } from "../query-options.js"

export interface UseQuestionOptionsOptions extends BookingQuestionOptionsListFilters {
  enabled?: boolean
}

export function useQuestionOptions(options: UseQuestionOptionsOptions = {}) {
  const client = useVoyantBookingRequirementsContext()
  const { enabled = true } = options
  return useQuery({ ...getQuestionOptionsQueryOptions(client, options), enabled })
}

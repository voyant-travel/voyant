"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantBookingsContext } from "../provider.js"
import {
  getBookingsBySharingGroupQueryOptions,
  getSharingGroupsForSlotQueryOptions,
} from "../query-options.js"

export interface UseSharingGroupsForSlotOptions {
  enabled?: boolean
}

export function useSharingGroupsForSlot(
  slotId: string | null | undefined,
  options: UseSharingGroupsForSlotOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const { enabled = true } = options

  return useQuery({
    ...getSharingGroupsForSlotQueryOptions({ baseUrl, fetcher }, slotId),
    enabled: enabled && Boolean(slotId),
  })
}

export interface UseBookingsBySharingGroupOptions {
  enabled?: boolean
}

export function useBookingsBySharingGroup(
  slotId: string | null | undefined,
  groupId: string | null | undefined,
  options: UseBookingsBySharingGroupOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const { enabled = true } = options

  return useQuery({
    ...getBookingsBySharingGroupQueryOptions({ baseUrl, fetcher }, slotId, groupId),
    enabled: enabled && Boolean(slotId) && Boolean(groupId),
  })
}

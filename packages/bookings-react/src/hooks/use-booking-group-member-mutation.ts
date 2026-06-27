"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingGroupMemberSingleResponse, successEnvelope } from "../schemas.js"

export interface AddBookingGroupMemberInput {
  groupId: string
  bookingId: string
  role?: "primary" | "shared"
}

export interface RemoveBookingGroupMemberInput {
  groupId: string
  bookingId: string
}

/**
 * Add or remove a booking from a group. Accepts the group id per-call so the
 * same hook instance can be reused across flows (e.g. create-then-add, where
 * the target group id isn't known at hook construction time).
 */
export function useBookingGroupMemberMutation() {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const invalidate = (groupId: string, bookingId: string) => {
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.group(groupId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.groupMembers(groupId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.groups() })
    void queryClient.invalidateQueries({
      queryKey: bookingsQueryKeys.groupForBooking(bookingId),
    })
  }

  const add = useMutation({
    mutationFn: async (input: AddBookingGroupMemberInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/groups/${input.groupId}/members`,
        bookingGroupMemberSingleResponse,
        { baseUrl, fetcher },
        {
          method: "POST",
          body: JSON.stringify({ bookingId: input.bookingId, role: input.role }),
        },
      )
      return data
    },
    onSuccess: (_, variables) => invalidate(variables.groupId, variables.bookingId),
  })

  const remove = useMutation({
    mutationFn: async (input: RemoveBookingGroupMemberInput) =>
      fetchWithValidation(
        `/v1/admin/bookings/groups/${input.groupId}/members/${input.bookingId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_, variables) => invalidate(variables.groupId, variables.bookingId),
  })

  return { add, remove }
}

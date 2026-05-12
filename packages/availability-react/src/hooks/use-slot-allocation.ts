"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantAvailabilityContext } from "../provider.js"
import { availabilityQueryKeys } from "../query-keys.js"
import { getSlotAllocationQueryOptions } from "../query-options.js"
import {
  allocationResourceSchema,
  type CreateAllocationResourceInput,
  singleEnvelope,
  type UpdateAllocationResourceInput,
} from "../schemas.js"

const assignTravelerAllocationResponse = singleEnvelope(
  z.object({
    travelerId: z.string(),
    kind: z.string(),
    resourceId: z.string().nullable(),
  }),
)

const updateTravelerSharingGroupResponse = singleEnvelope(
  z.object({
    travelerId: z.string(),
    sharingGroupId: z.string().nullable(),
  }),
)

const pairSharingGroupResponse = singleEnvelope(
  z.object({
    sharingGroupId: z.string(),
    travelerIds: z.array(z.string()),
  }),
)

export interface UseSlotAllocationOptions {
  slotId: string | null | undefined
  enabled?: boolean
}

export function useSlotAllocation({ slotId, enabled = true }: UseSlotAllocationOptions) {
  const client = useVoyantAvailabilityContext()
  return useQuery({
    ...getSlotAllocationQueryOptions(client, slotId),
    enabled: enabled && Boolean(slotId),
  })
}

export function useAllocationResourceMutation(slotId: string) {
  const { baseUrl, fetcher } = useVoyantAvailabilityContext()
  const queryClient = useQueryClient()
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.slotAllocation(slotId) })
  }

  const create = useMutation({
    mutationFn: async (input: CreateAllocationResourceInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/availability/slots/${slotId}/allocation/resources`,
        singleEnvelope(allocationResourceSchema),
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({
      resourceId,
      input,
    }: {
      resourceId: string
      input: UpdateAllocationResourceInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/availability/slots/${slotId}/allocation/resources/${resourceId}`,
        singleEnvelope(allocationResourceSchema),
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (resourceId: string) =>
      fetchWithValidation(
        `/v1/admin/availability/slots/${slotId}/allocation/resources/${resourceId}`,
        singleEnvelope(allocationResourceSchema.pick({ id: true })),
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}

export function useAssignTravelerAllocationMutation(slotId: string) {
  const { baseUrl, fetcher } = useVoyantAvailabilityContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { travelerId: string; kind: string; resourceId: string | null }) =>
      fetchWithValidation(
        `/v1/admin/availability/slots/${slotId}/allocation/travelers/${input.travelerId}`,
        assignTravelerAllocationResponse,
        { baseUrl, fetcher },
        {
          method: "PATCH",
          body: JSON.stringify({ kind: input.kind, resourceId: input.resourceId }),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.slotAllocation(slotId),
      })
    },
  })
}

export function useTravelerSharingGroupMutation(slotId: string) {
  const { baseUrl, fetcher } = useVoyantAvailabilityContext()
  const queryClient = useQueryClient()
  const update = useMutation({
    mutationFn: (input: { travelerId: string; sharingGroupId: string | null }) =>
      fetchWithValidation(
        `/v1/admin/availability/slots/${slotId}/allocation/travelers/${input.travelerId}/sharing-group`,
        updateTravelerSharingGroupResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify({ sharingGroupId: input.sharingGroupId }) },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.slotAllocation(slotId),
      })
    },
  })

  const pair = useMutation({
    mutationFn: (input: { travelerIds: string[]; sharingGroupId?: string }) =>
      fetchWithValidation(
        `/v1/admin/availability/slots/${slotId}/allocation/sharing-groups/pair`,
        pairSharingGroupResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.slotAllocation(slotId),
      })
    },
  })

  return { update, pair }
}

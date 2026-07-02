"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  CreateRoomingAssignmentBody,
  RoomingDelegateInput,
  UpdateRoomingAssignmentBody,
} from "@voyant-travel/mice"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { miceQueryKeys } from "../query-keys.js"
import { roomingDelegatesResponse, roomingSingleResponse } from "../schemas.js"

const basePath = "/v1/admin/mice"

/**
 * Mutations for a program's rooming assignments. Occupant assignment is a full
 * replace on the backend, so the mutation accepts the complete delegate set for
 * the rooming assignment.
 */
export function useRoomingMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const client = { baseUrl, fetcher }

  const invalidateRooming = (programId?: string, assignmentId?: string) => {
    void queryClient.invalidateQueries({ queryKey: miceQueryKeys.rooming() })
    if (programId) {
      void queryClient.invalidateQueries({ queryKey: miceQueryKeys.roomingList(programId) })
    }
    if (assignmentId) {
      void queryClient.invalidateQueries({
        queryKey: miceQueryKeys.roomingAssignment(assignmentId),
      })
    }
  }

  const create = useMutation({
    mutationFn: async (input: CreateRoomingAssignmentBody) => {
      const { data } = await fetchWithValidation(
        `${basePath}/rooming-assignments`,
        roomingSingleResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (assignment) => invalidateRooming(assignment.programId, assignment.id),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...input }: UpdateRoomingAssignmentBody & { id: string }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/rooming-assignments/${id}`,
        roomingSingleResponse,
        client,
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (assignment) => invalidateRooming(assignment.programId, assignment.id),
  })

  const setDelegates = useMutation({
    mutationFn: async ({
      assignmentId,
      delegates,
    }: {
      assignmentId: string
      delegates: RoomingDelegateInput[]
    }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/rooming-assignments/${assignmentId}/delegates`,
        roomingDelegatesResponse,
        client,
        { method: "PUT", body: JSON.stringify({ delegates }) },
      )
      return { assignmentId, delegates: data }
    },
    onSuccess: ({ assignmentId }) => invalidateRooming(undefined, assignmentId),
  })

  return { create, update, setDelegates }
}

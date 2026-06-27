"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import { activityLinkSingleResponse, activitySingleResponse } from "../schemas.js"

export interface CreateActivityInput {
  subject: string
  type: string
  ownerId?: string | null
  status?: string
  dueAt?: string | null
  completedAt?: string | null
  location?: string | null
  description?: string | null
  [key: string]: unknown
}

export type UpdateActivityInput = Partial<CreateActivityInput>

export interface CreateActivityLinkInput {
  entityType: string
  entityId: string
  role?: string
}

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useActivityMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateActivityInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/relationships/activities",
        activitySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.activities() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateActivityInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/relationships/activities/${id}`,
        activitySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.activities() })
      queryClient.setQueryData(relationshipsQueryKeys.activity(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithValidation(
        `/v1/admin/relationships/activities/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.activities() })
      queryClient.removeQueries({ queryKey: relationshipsQueryKeys.activity(id) })
    },
  })

  const addLink = useMutation({
    mutationFn: async ({
      activityId,
      input,
    }: {
      activityId: string
      input: CreateActivityLinkInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/relationships/activities/${activityId}/links`,
        activityLinkSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: relationshipsQueryKeys.activityLinks(vars.activityId),
      })
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.activities() })
    },
  })

  const removeLink = useMutation({
    mutationFn: async ({
      activityId: _activityId,
      linkId,
    }: {
      activityId: string
      linkId: string
    }) => {
      return fetchWithValidation(
        `/v1/admin/relationships/activity-links/${linkId}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: relationshipsQueryKeys.activityLinks(vars.activityId),
      })
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.activities() })
    },
  })

  return { create, update, remove, addLink, removeLink }
}

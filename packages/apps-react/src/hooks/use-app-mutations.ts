"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { appsQueryKeys } from "../query-keys.js"
import { appSingleResponse, releaseCreateResultSchema } from "../schemas.js"

export interface CreateAppInput {
  ownerId: string
  displayName: string
  slug: string
  redirectUris: string[]
  createdBy: string
}

export interface CreateReleaseUploadInput {
  appId: string
  manifest: unknown
  createdBy: string
}

export interface CreateReleaseFetchInput {
  appId: string
  manifestUrl: string
  createdBy: string
}

export function useAppMutations() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const client = { baseUrl, fetcher }

  const createApp = useMutation({
    mutationFn: async (input: CreateAppInput) => {
      const { data } = await fetchWithValidation("/v1/admin/apps", appSingleResponse, client, {
        method: "POST",
        body: JSON.stringify(input),
      })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appsQueryKeys.apps() })
    },
  })

  const createReleaseFromUpload = useMutation({
    mutationFn: async ({ appId, manifest, createdBy }: CreateReleaseUploadInput) =>
      fetchWithValidation(`/v1/admin/apps/${appId}/releases`, releaseCreateResultSchema, client, {
        method: "POST",
        body: JSON.stringify({ manifest, createdBy }),
      }),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: appsQueryKeys.appReleases(input.appId) })
    },
  })

  const createReleaseFromFetch = useMutation({
    mutationFn: async ({ appId, manifestUrl, createdBy }: CreateReleaseFetchInput) =>
      fetchWithValidation(
        `/v1/admin/apps/${appId}/releases/fetch`,
        releaseCreateResultSchema,
        client,
        { method: "POST", body: JSON.stringify({ manifestUrl, createdBy }) },
      ),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: appsQueryKeys.appReleases(input.appId) })
    },
  })

  return { createApp, createReleaseFromUpload, createReleaseFromFetch }
}

"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { appsQueryKeys } from "../query-keys.js"
import { lifecycleResponse, purgePreviewResponse } from "../schemas.js"

export interface InstallAppInput {
  appId: string
  releaseId: string
  actorId: string
  grantedOptionalScopes?: string[]
  updatePolicy?: "manual" | "compatible" | "patch" | "pinned"
  deploymentId?: string
}

export interface LifecycleActionInput {
  installationId: string
  actorId: string
}

export interface ActivateReleaseInput {
  installationId: string
  releaseId: string
  actorId: string
}

async function postLifecycle(client: FetchWithValidationOptions, path: string, body: object) {
  const { data } = await fetchWithValidation(path, lifecycleResponse, client, {
    method: "POST",
    body: JSON.stringify(body),
  })
  return data
}

export function useInstallationActions() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const client: FetchWithValidationOptions = { baseUrl, fetcher }

  const invalidate = (installationId?: string) => {
    void queryClient.invalidateQueries({ queryKey: appsQueryKeys.installations() })
    if (installationId) {
      void queryClient.invalidateQueries({
        queryKey: appsQueryKeys.installation(installationId),
      })
    }
  }

  const install = useMutation({
    mutationFn: (input: InstallAppInput) => postLifecycle(client, "/v1/admin/apps/install", input),
    onSuccess: () => invalidate(),
  })

  const pause = useMutation({
    mutationFn: ({ installationId, actorId }: LifecycleActionInput) =>
      postLifecycle(client, `/v1/admin/apps/installations/${installationId}/pause`, { actorId }),
    onSuccess: (_data, input) => invalidate(input.installationId),
  })

  const resume = useMutation({
    mutationFn: ({ installationId, actorId }: LifecycleActionInput) =>
      postLifecycle(client, `/v1/admin/apps/installations/${installationId}/resume`, { actorId }),
    onSuccess: (_data, input) => invalidate(input.installationId),
  })

  const uninstall = useMutation({
    mutationFn: ({ installationId, actorId }: LifecycleActionInput) =>
      postLifecycle(client, `/v1/admin/apps/installations/${installationId}/uninstall`, {
        actorId,
      }),
    onSuccess: (_data, input) => invalidate(input.installationId),
  })

  const activate = useMutation({
    mutationFn: ({ installationId, releaseId, actorId }: ActivateReleaseInput) =>
      postLifecycle(client, `/v1/admin/apps/installations/${installationId}/activate`, {
        releaseId,
        actorId,
      }),
    onSuccess: (_data, input) => invalidate(input.installationId),
  })

  const purgePreview = useMutation({
    mutationFn: async ({ installationId, actorId }: LifecycleActionInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/apps/installations/${installationId}/purge-preview`,
        purgePreviewResponse,
        client,
        { method: "POST", body: JSON.stringify({ actorId }) },
      )
      return data
    },
  })

  return { install, pause, resume, uninstall, activate, purgePreview }
}

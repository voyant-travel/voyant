"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ApiKeyPermissions } from "@voyantjs/types/api-keys"

import { fetchWithValidation } from "../client.js"
import { useVoyantAuthContext } from "../provider.js"
import { authQueryKeys } from "../query-keys.js"
import {
  deleteServiceApiKeyResponseSchema,
  serviceApiKeySchema,
  serviceApiKeyWithSecretSchema,
} from "../schemas.js"

export interface CreateServiceApiKeyInput {
  name: string
  permissions: ApiKeyPermissions
  expiresIn?: number | null
  remaining?: number | null
  prefix?: string
  configId?: string
  organizationId?: string
  metadata?: Record<string, unknown> | null
}

export type CreateApiTokenInput = CreateServiceApiKeyInput

export interface UpdateServiceApiKeyInput {
  keyId: string
  name?: string
  enabled?: boolean
  permissions?: ApiKeyPermissions
  expiresIn?: number | null
  configId?: string
  metadata?: Record<string, unknown> | null
}

export type UpdateApiTokenInput = UpdateServiceApiKeyInput

export interface DeleteServiceApiKeyInput {
  keyId: string
  configId?: string
}

export type DeleteApiTokenInput = DeleteServiceApiKeyInput

function invalidateApiKeyQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: authQueryKeys.serviceApiKeys() })
}

export function useServiceApiKeyMutation() {
  const { baseUrl, fetcher } = useVoyantAuthContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateServiceApiKeyInput) =>
      fetchWithValidation(
        "/auth/api-tokens",
        serviceApiKeyWithSecretSchema,
        { baseUrl, fetcher },
        {
          method: "POST",
          body: JSON.stringify({
            configId: input.configId,
            name: input.name,
            expiresIn: input.expiresIn ?? undefined,
            remaining: input.remaining ?? undefined,
            prefix: input.prefix,
            organizationId: input.organizationId,
            metadata: input.metadata ?? undefined,
            permissions: input.permissions,
          }),
        },
      ),
    onSuccess: () => invalidateApiKeyQueries(queryClient),
  })

  const update = useMutation({
    mutationFn: async (input: UpdateServiceApiKeyInput) =>
      fetchWithValidation(
        `/auth/api-tokens/${encodeURIComponent(input.keyId)}`,
        serviceApiKeySchema,
        { baseUrl, fetcher },
        {
          method: "POST",
          body: JSON.stringify({
            configId: input.configId,
            name: input.name,
            enabled: input.enabled,
            expiresIn: input.expiresIn ?? undefined,
            metadata: input.metadata ?? undefined,
            ...(input.permissions ? { permissions: input.permissions } : {}),
          }),
        },
      ),
    onSuccess: () => invalidateApiKeyQueries(queryClient),
  })

  const remove = useMutation({
    mutationFn: async (input: DeleteServiceApiKeyInput) =>
      fetchWithValidation(
        `/auth/api-tokens/${encodeURIComponent(input.keyId)}`,
        deleteServiceApiKeyResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE", body: JSON.stringify({ configId: input.configId }) },
      ),
    onSuccess: () => invalidateApiKeyQueries(queryClient),
  })

  return { create, update, remove }
}

export const useApiTokenMutation = useServiceApiKeyMutation

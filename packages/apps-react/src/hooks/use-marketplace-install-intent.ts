"use client"

import { useMutation } from "@tanstack/react-query"
import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { marketplaceInstallIntentResponse, marketplaceSetupHandoffResponse } from "../schemas.js"

export function useMarketplaceInstallIntent() {
  const { baseUrl, fetcher } = useVoyantContext()
  const client = { baseUrl, fetcher }

  const resolveIntent = useMutation({
    mutationFn: async (intent: string) => {
      const response = await fetchWithValidation(
        "/v1/admin/apps/marketplace/install-intents/resolve",
        marketplaceInstallIntentResponse,
        client,
        { method: "POST", body: JSON.stringify({ intent }) },
      )
      return response.data
    },
  })

  const createSetupHandoff = useMutation({
    mutationFn: async (installationId: string) => {
      const response = await fetchWithValidation(
        `/v1/admin/apps/installations/${installationId}/setup-handoff`,
        marketplaceSetupHandoffResponse,
        client,
        { method: "POST" },
      )
      return response.data
    },
  })

  return { resolveIntent, createSetupHandoff }
}

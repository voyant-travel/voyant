"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { marketplaceInstallIntentResponse, marketplaceSetupHandoffResponse } from "../schemas.js"

export function useMarketplaceInstallIntent() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const client = { baseUrl, fetcher }

  const resolveIntent = useMutation({
    mutationFn: (intent: string) =>
      queryClient.fetchQuery({
        // The consent screen can remount while its opaque handoff is in
        // flight. Query caching deduplicates that replay and retains the
        // verified result for the rest of this admin session.
        queryKey: ["apps", "marketplace-install-intent", intent],
        queryFn: async () => {
          const response = await fetchWithValidation(
            "/v1/admin/apps/marketplace/install-intents/resolve",
            marketplaceInstallIntentResponse,
            client,
            { method: "POST", body: JSON.stringify({ intent }) },
          )
          return response.data
        },
        staleTime: Infinity,
        retry: false,
      }),
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

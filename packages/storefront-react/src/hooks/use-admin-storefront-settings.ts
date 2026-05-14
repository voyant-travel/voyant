"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { updateAdminStorefrontSettings } from "../operations.js"
import { useVoyantStorefrontContext } from "../provider.js"
import { storefrontQueryKeys } from "../query-keys.js"
import { getAdminStorefrontSettingsQueryOptions } from "../query-options.js"
import type { StorefrontSettingsPatchInput } from "../schemas.js"

export interface UseAdminStorefrontSettingsOptions {
  enabled?: boolean
}

export function useAdminStorefrontSettings(options: UseAdminStorefrontSettingsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantStorefrontContext()
  const { enabled = true } = options

  return useQuery({
    ...getAdminStorefrontSettingsQueryOptions({ baseUrl, fetcher }),
    enabled,
  })
}

export function useAdminStorefrontSettingsMutation() {
  const { baseUrl, fetcher } = useVoyantStorefrontContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: StorefrontSettingsPatchInput) => {
      const { data } = await updateAdminStorefrontSettings({ baseUrl, fetcher }, input)
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(storefrontQueryKeys.adminSettings(), { data })
      void queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.adminSettings() })
      void queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.settings() })
    },
  })
}

"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { updateNotificationSettingsSchema } from "@voyant-travel/notifications/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantNotificationsContext } from "../provider.js"
import { notificationsQueryKeys } from "../query-keys.js"
import { getNotificationSettingsQueryOptions } from "../query-options.js"
import { notificationSettingsResponse } from "../schemas.js"

export type UpdateNotificationSettingsInput = z.input<typeof updateNotificationSettingsSchema>

export function useNotificationSettings() {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  return useQuery(getNotificationSettingsQueryOptions({ baseUrl, fetcher }))
}

export function useNotificationSettingsMutation() {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateNotificationSettingsInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/notifications/notification-settings",
        notificationSettingsResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationsQueryKeys.notificationSettings(),
      })
    },
  })
}

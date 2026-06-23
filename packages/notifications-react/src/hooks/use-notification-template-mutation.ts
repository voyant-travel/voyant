"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertNotificationTemplateSchema,
  updateNotificationTemplateSchema,
} from "@voyant-travel/notifications/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantNotificationsContext } from "../provider.js"
import { notificationsQueryKeys } from "../query-keys.js"
import { notificationTemplateSingleResponse } from "../schemas.js"

export type CreateNotificationTemplateInput = z.input<typeof insertNotificationTemplateSchema>
export type UpdateNotificationTemplateInput = z.input<typeof updateNotificationTemplateSchema>

export function useNotificationTemplateMutation() {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateNotificationTemplateInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/notifications/templates",
        notificationTemplateSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.templates() })
      queryClient.setQueryData(notificationsQueryKeys.template(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateNotificationTemplateInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/notifications/templates/${id}`,
        notificationTemplateSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.templates() })
      queryClient.setQueryData(notificationsQueryKeys.template(data.id), data)
    },
  })

  return { create, update }
}

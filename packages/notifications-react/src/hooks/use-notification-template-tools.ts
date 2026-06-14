"use client"

import { useMutation } from "@tanstack/react-query"
import type {
  previewNotificationTemplateSchema,
  sendNotificationSchema,
} from "@voyant-travel/notifications"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantNotificationsContext } from "../provider.js"
import {
  notificationDeliverySingleResponse,
  notificationTemplatePreviewResponse,
} from "../schemas.js"

export type PreviewNotificationTemplateInput = z.input<typeof previewNotificationTemplateSchema>
export type SendNotificationInput = z.input<typeof sendNotificationSchema>

export function useNotificationTemplateTools() {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()

  const preview = useMutation({
    mutationFn: async (input: PreviewNotificationTemplateInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/notifications/preview",
        notificationTemplatePreviewResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
  })

  const testSend = useMutation({
    mutationFn: async (input: SendNotificationInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/notifications/send",
        notificationDeliverySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
  })

  return { preview, testSend }
}

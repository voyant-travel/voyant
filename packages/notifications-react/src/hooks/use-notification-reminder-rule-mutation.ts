"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertNotificationReminderRuleSchema,
  updateNotificationReminderRuleSchema,
} from "@voyant-travel/notifications"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantNotificationsContext } from "../provider.js"
import { notificationsQueryKeys } from "../query-keys.js"
import { notificationReminderRuleSingleResponse } from "../schemas.js"

export type CreateNotificationReminderRuleInput = z.input<
  typeof insertNotificationReminderRuleSchema
>
export type UpdateNotificationReminderRuleInput = z.input<
  typeof updateNotificationReminderRuleSchema
>

export function useNotificationReminderRuleMutation() {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateNotificationReminderRuleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/notifications/reminder-rules",
        notificationReminderRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.reminderRules() })
      queryClient.setQueryData(notificationsQueryKeys.reminderRule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateNotificationReminderRuleInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/notifications/reminder-rules/${id}`,
        notificationReminderRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.reminderRules() })
      queryClient.setQueryData(notificationsQueryKeys.reminderRule(data.id), data)
    },
  })

  return { create, update }
}

"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertNotificationReminderStageChannelSchema,
  updateNotificationReminderStageChannelSchema,
} from "@voyantjs/notifications"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantNotificationsContext } from "../provider.js"
import { notificationsQueryKeys } from "../query-keys.js"
import { reminderStageChannelSingleResponse } from "../schemas.js"

export type CreateReminderStageChannelInput = z.input<
  typeof insertNotificationReminderStageChannelSchema
>
export type UpdateReminderStageChannelInput = z.input<
  typeof updateNotificationReminderStageChannelSchema
>

export function useReminderStageChannelMutation(reminderRuleId: string, stageId: string) {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  const queryClient = useQueryClient()
  const base = `/v1/admin/notifications/reminder-rules/${reminderRuleId}/stages/${stageId}/channels`

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: notificationsQueryKeys.reminderStageChannels(stageId),
    })

  const create = useMutation({
    mutationFn: async (input: CreateReminderStageChannelInput) => {
      const { data } = await fetchWithValidation(
        base,
        reminderStageChannelSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void invalidate()
    },
  })

  const update = useMutation({
    mutationFn: async ({
      channelId,
      input,
    }: {
      channelId: string
      input: UpdateReminderStageChannelInput
    }) => {
      const { data } = await fetchWithValidation(
        `${base}/${channelId}`,
        reminderStageChannelSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: async (channelId: string) => {
      await fetchWithValidation(
        `${base}/${channelId}`,
        reminderStageChannelSingleResponse.optional() as never,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ).catch(() => null)
      return channelId
    },
    onSuccess: () => {
      void invalidate()
    },
  })

  return { create, update, remove }
}

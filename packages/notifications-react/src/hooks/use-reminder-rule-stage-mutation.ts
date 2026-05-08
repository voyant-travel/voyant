"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertNotificationReminderRuleStageSchema,
  reorderReminderRuleStagesSchema,
  updateNotificationReminderRuleStageSchema,
} from "@voyantjs/notifications"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantNotificationsContext } from "../provider.js"
import { notificationsQueryKeys } from "../query-keys.js"
import { reminderRuleStageSingleResponse, reminderRuleStagesListResponse } from "../schemas.js"

export type CreateReminderRuleStageInput = z.input<typeof insertNotificationReminderRuleStageSchema>
export type UpdateReminderRuleStageInput = z.input<typeof updateNotificationReminderRuleStageSchema>
export type ReorderReminderRuleStagesInput = z.input<typeof reorderReminderRuleStagesSchema>

export function useReminderRuleStageMutation(reminderRuleId: string) {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  const queryClient = useQueryClient()
  const base = `/v1/admin/notifications/reminder-rules/${reminderRuleId}/stages`

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: notificationsQueryKeys.reminderRuleStages(reminderRuleId),
    })

  const create = useMutation({
    mutationFn: async (input: CreateReminderRuleStageInput) => {
      const { data } = await fetchWithValidation(
        base,
        reminderRuleStageSingleResponse,
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
      stageId,
      input,
    }: {
      stageId: string
      input: UpdateReminderRuleStageInput
    }) => {
      const { data } = await fetchWithValidation(
        `${base}/${stageId}`,
        reminderRuleStageSingleResponse,
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
    mutationFn: async (stageId: string) => {
      await fetchWithValidation(
        `${base}/${stageId}`,
        // 204 → empty body; pass-through using a permissive schema
        reminderRuleStagesListResponse.optional() as never,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ).catch(() => null)
      return stageId
    },
    onSuccess: () => {
      void invalidate()
    },
  })

  const reorder = useMutation({
    mutationFn: async (input: ReorderReminderRuleStagesInput) => {
      const { data } = await fetchWithValidation(
        `${base}/reorder`,
        reminderRuleStagesListResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void invalidate()
    },
  })

  return { create, update, remove, reorder }
}

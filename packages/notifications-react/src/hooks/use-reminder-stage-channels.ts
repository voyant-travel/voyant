"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantNotificationsContext } from "../provider.js"
import { getReminderStageChannelsQueryOptions } from "../query-options.js"

export interface UseReminderStageChannelsOptions {
  enabled?: boolean
}

export function useReminderStageChannels(
  reminderRuleId: string,
  stageId: string,
  options: UseReminderStageChannelsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  const { enabled = true } = options
  return useQuery({
    ...getReminderStageChannelsQueryOptions({ baseUrl, fetcher }, reminderRuleId, stageId),
    enabled: enabled && Boolean(reminderRuleId) && Boolean(stageId),
  })
}

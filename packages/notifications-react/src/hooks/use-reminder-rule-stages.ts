"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantNotificationsContext } from "../provider.js"
import { getReminderRuleStagesQueryOptions } from "../query-options.js"

export interface UseReminderRuleStagesOptions {
  enabled?: boolean
}

export function useReminderRuleStages(
  reminderRuleId: string,
  options: UseReminderRuleStagesOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  const { enabled = true } = options
  return useQuery({
    ...getReminderRuleStagesQueryOptions({ baseUrl, fetcher }, reminderRuleId),
    enabled: enabled && Boolean(reminderRuleId),
  })
}

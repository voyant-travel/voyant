"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantNotificationsContext } from "../provider.js"
import type { RemindersPreviewFilters } from "../query-keys.js"
import { getRemindersPreviewQueryOptions } from "../query-options.js"

export interface UseRemindersPreviewOptions extends RemindersPreviewFilters {
  enabled?: boolean
}

export function useRemindersPreview(options: UseRemindersPreviewOptions = {}) {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  const { enabled = true, ...filters } = options
  return useQuery({
    ...getRemindersPreviewQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { useVoyantNotificationsContext } from "../provider.js"
import { getNotificationChannelAccountsQueryOptions } from "../query-options.js"

export function useNotificationChannelAccounts() {
  const client = useVoyantNotificationsContext()
  return useQuery(getNotificationChannelAccountsQueryOptions(client))
}

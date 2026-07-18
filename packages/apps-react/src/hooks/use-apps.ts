"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantContext } from "../provider.js"
import type { AppListFilters } from "../query-keys.js"
import {
  getAppQueryOptions,
  getAppReleasesQueryOptions,
  getAppsQueryOptions,
} from "../query-options.js"

export interface UseAppsOptions extends AppListFilters {
  enabled?: boolean
}

export function useApps(options: UseAppsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options
  return useQuery({ ...getAppsQueryOptions({ baseUrl, fetcher }, filters), enabled })
}

export function useApp(appId: string | undefined) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getAppQueryOptions({ baseUrl, fetcher }, appId ?? ""),
    enabled: Boolean(appId),
  })
}

export function useAppReleases(appId: string | undefined) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getAppReleasesQueryOptions({ baseUrl, fetcher }, appId ?? ""),
    enabled: Boolean(appId),
  })
}

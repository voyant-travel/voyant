"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantContext } from "../provider.js"
import type { InstallationListFilters } from "../query-keys.js"
import {
  getInstallationAuditQueryOptions,
  getInstallationQueryOptions,
  getInstallationsQueryOptions,
} from "../query-options.js"

export interface UseInstallationsOptions extends InstallationListFilters {
  enabled?: boolean
}

export function useInstallations(options: UseInstallationsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options
  return useQuery({ ...getInstallationsQueryOptions({ baseUrl, fetcher }, filters), enabled })
}

export function useInstallation(installationId: string | undefined) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getInstallationQueryOptions({ baseUrl, fetcher }, installationId ?? ""),
    enabled: Boolean(installationId),
  })
}

export function useInstallationAudit(installationId: string | undefined, limit?: number) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getInstallationAuditQueryOptions({ baseUrl, fetcher }, installationId ?? "", limit),
    enabled: Boolean(installationId),
  })
}

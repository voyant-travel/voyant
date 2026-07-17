export interface AppListFilters {
  ownerId?: string
  distribution?: "custom" | "marketplace"
  limit?: number
  offset?: number
}

export interface InstallationListFilters {
  appId?: string
  status?: string
  deploymentId?: string
  limit?: number
  offset?: number
}

export const appsQueryKeys = {
  all: ["voyant", "apps"] as const,
  apps: () => [...appsQueryKeys.all, "registrations"] as const,
  appsList: (filters: AppListFilters = {}) => [...appsQueryKeys.apps(), "list", filters] as const,
  app: (appId: string) => [...appsQueryKeys.apps(), "detail", appId] as const,
  appReleases: (appId: string) => [...appsQueryKeys.apps(), "releases", appId] as const,
  installations: () => [...appsQueryKeys.all, "installations"] as const,
  installationsList: (filters: InstallationListFilters = {}) =>
    [...appsQueryKeys.installations(), "list", filters] as const,
  installation: (installationId: string) =>
    [...appsQueryKeys.installations(), "detail", installationId] as const,
  installationAudit: (installationId: string, limit?: number) =>
    [...appsQueryKeys.installations(), "audit", installationId, limit ?? null] as const,
} as const

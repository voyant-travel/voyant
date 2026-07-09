import {
  type ManagedScheduledJob,
  SCHEDULED_JOB_ROUTE,
} from "@voyant-travel/framework/managed-jobs"

export const EXTERNAL_CRUISE_CATALOG_REFRESH_CRON = "30 3 * * *"

export const OPERATOR_LOCAL_SCHEDULED_JOBS: readonly ManagedScheduledJob[] = [
  {
    id: "external-cruise-catalog-refresh",
    cron: EXTERNAL_CRUISE_CATALOG_REFRESH_CRON,
    description: "External cruise catalog refresh (nightly at 03:30).",
    route: SCHEDULED_JOB_ROUTE,
    module: "@voyant-travel/operator#cruises",
  },
]

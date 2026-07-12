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

const PACKAGE_GRAPH_SCHEDULED_JOB_IDS = new Set(["draft-reaper", "promotion-boundary-scheduler"])

/** Ignore compatibility-catalog jobs replaced by package workflow schedules. */
export function withoutPackageGraphScheduledJobs(
  jobs: readonly ManagedScheduledJob[],
): ManagedScheduledJob[] {
  return jobs.filter((job) => !PACKAGE_GRAPH_SCHEDULED_JOB_IDS.has(job.id))
}

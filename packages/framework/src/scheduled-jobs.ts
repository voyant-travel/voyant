/** The Node runtime path used to trigger scheduled work. */
export const SCHEDULED_JOB_ROUTE = "/__voyant/scheduled"

export interface VoyantScheduledJob {
  readonly id: string
  readonly cron: string
  readonly description: string
  readonly route: string
  readonly module: string
}

interface StandardScheduledJobDefinition {
  readonly id: string
  readonly cron: string
  readonly description: string
  readonly moduleSpecifier: string | null
}

const STANDARD_OPERATOR_SCHEDULED_JOB_DEFINITIONS: readonly StandardScheduledJobDefinition[] = [
  {
    id: "draft-reaper",
    cron: "5 * * * *",
    description: "Drops expired booking drafts (hourly at :05).",
    moduleSpecifier: "@voyant-travel/catalog",
  },
  {
    id: "promotion-boundary-scheduler",
    cron: "*/5 * * * *",
    description: "Emits promotion.changed at valid_from / valid_until boundaries (every 5 min).",
    moduleSpecifier: "@voyant-travel/commerce",
  },
]

function toScheduledJob(job: StandardScheduledJobDefinition): VoyantScheduledJob {
  return {
    id: job.id,
    cron: job.cron,
    description: job.description,
    route: SCHEDULED_JOB_ROUTE,
    module:
      job.moduleSpecifier === null
        ? "framework"
        : job.moduleSpecifier.replace(/^@voyant-travel\//, "").replaceAll("/", "."),
  }
}

/** Scheduled jobs for the standard Operator distribution. */
export const STANDARD_OPERATOR_SCHEDULED_JOBS: readonly VoyantScheduledJob[] =
  STANDARD_OPERATOR_SCHEDULED_JOB_DEFINITIONS.map(toScheduledJob)

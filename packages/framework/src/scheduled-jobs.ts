/** The Node runtime path used to trigger scheduled work. */
export const SCHEDULED_JOB_ROUTE = "/__voyant/scheduled"

export interface VoyantScheduledJob {
  readonly id: string
  readonly cron: string
  readonly description: string
  readonly route: string
  readonly module: string
}

// Runtime-neutral scheduled job declarations. Stable ids are the dispatch keys
// for the operator's scheduled work: `entry.ts` `scheduled()` resolves them, and
// `scripts/emit-cloud-scheduler.ts` fans them out to Cloud Scheduler jobs that
// POST `/__voyant/scheduled?schedule=<id>&cron=<expr>` on the Node runtime.
//
// The STANDARD job set is now owned by the framework and derived from the
// composed module set (voyant#3032) — `@voyant-travel/framework/managed-jobs` —
// so the operator and a source-free managed deployment provision the same jobs
// from one source. The operator appends only its deployment-local jobs (the
// external cruise refresh, since `@voyant-travel/cruises` is not a standard
// framework module).

import { STANDARD_OPERATOR_SCHEDULED_JOBS } from "@voyant-travel/framework/managed-jobs"

/** One scheduled job: a stable id, its cron expression, and what it does. */
export interface CronJob {
  /** Stable, kebab-case identifier — used as the Cloud Scheduler job name. */
  id: string
  /** Standard 5-field cron expression (UTC). */
  cron: string
  /** Human-readable description of the work this trigger drives. */
  description: string
}

function standardCron(id: string): string {
  const job = STANDARD_OPERATOR_SCHEDULED_JOBS.find((entry) => entry.id === id)
  if (!job) {
    throw new Error(`[scheduled-crons] unknown standard framework scheduled job "${id}".`)
  }
  return job.cron
}

// The cron expressions `entry.ts` `scheduled()` dispatches on. Sourced from the
// framework's standard job set so the dispatch and the emitted Cloud Scheduler
// jobs can never drift.
export const CHANNEL_PUSH_BOOKING_LINK_CRON = standardCron("channel-push-booking-link")
export const CHANNEL_PUSH_AVAILABILITY_CRON = standardCron("channel-push-availability")
export const CHANNEL_PUSH_CONTENT_CRON = standardCron("channel-push-content")
export const DRAFT_REAPER_CRON = standardCron("draft-reaper")
export const PROMOTION_BOUNDARY_SCHEDULER_CRON = standardCron("promotion-boundary-scheduler")
export const OUTBOX_DRAIN_CRON = standardCron("outbox-drain")

// Deployment-local: `@voyant-travel/cruises` is not part of the standard
// framework runtime manifest, so the operator owns this cron itself.
export const EXTERNAL_CRUISE_CATALOG_REFRESH_CRON = "30 3 * * *"

/**
 * The full set of scheduled jobs, in declaration order: the framework's
 * standard set (from the composed module set) plus the operator's
 * deployment-local jobs. Consumed by the Cloud Scheduler emitter; kept in sync
 * with `entry.ts` `scheduled()` dispatch by the shared cron constants above.
 */
export const OPERATOR_CRON_JOBS: readonly CronJob[] = [
  ...STANDARD_OPERATOR_SCHEDULED_JOBS.map(
    ({ id, cron, description }): CronJob => ({ id, cron, description }),
  ),
  {
    id: "external-cruise-catalog-refresh",
    cron: EXTERNAL_CRUISE_CATALOG_REFRESH_CRON,
    description: "External cruise catalog refresh (nightly at 03:30).",
  },
]

export interface ScheduledDispatchKey {
  cron?: string
  scheduleId?: string
}

export function resolveOperatorCronJob(event: ScheduledDispatchKey) {
  if (event.scheduleId) {
    return OPERATOR_CRON_JOBS.find((job) => job.id === event.scheduleId)
  }
  if (event.cron) {
    return OPERATOR_CRON_JOBS.find((job) => job.cron === event.cron)
  }
  return undefined
}

// Runtime-neutral scheduled job declarations. Stable ids are the dispatch keys
// for the operator's scheduled work: `entry.ts` `scheduled()` resolves them, and
// `scripts/emit-cloud-scheduler.ts` fans them out to Cloud Scheduler jobs that
// POST `/__voyant/scheduled?schedule=<id>&cron=<expr>` on the Node runtime.

import {
  loadOperatorDeploymentGraphArtifacts,
  type OperatorDeploymentGraphScheduledJob,
} from "./deployment-graph-artifacts"

/** One scheduled job: a stable id, its cron expression, and what it does. */
export interface CronJob {
  /** Stable, kebab-case identifier — used as the Cloud Scheduler job name. */
  id: string
  /** Standard 5-field cron expression (UTC). */
  cron: string
  /** Human-readable description of the work this trigger drives. */
  description: string
  route: string
  module: string
  workflowId?: string
  input?: unknown
}

const GRAPH_OPERATOR_CRON_JOBS = loadOperatorDeploymentGraphArtifacts().scheduledJobs

function standardCron(id: string): string {
  const job = GRAPH_OPERATOR_CRON_JOBS.find((entry) => entry.id === id)
  if (!job) {
    throw new Error(`[scheduled-crons] unknown graph scheduled job "${id}".`)
  }
  return job.cron
}

// The cron expressions `entry.ts` `scheduled()` dispatches on. Sourced from the
// generated deployment graph so the dispatch and the emitted Cloud Scheduler
// jobs can never drift.
export const CHANNEL_PUSH_BOOKING_LINK_CRON = standardCron("channel-push-booking-link")
export const CHANNEL_PUSH_AVAILABILITY_CRON = standardCron("channel-push-availability")
export const CHANNEL_PUSH_CONTENT_CRON = standardCron("channel-push-content")
export const DRAFT_REAPER_CRON = standardCron("draft-reaper")
export const PROMOTION_BOUNDARY_SCHEDULER_CRON = standardCron("promotion-boundary-scheduler")
export const OUTBOX_DRAIN_CRON = standardCron("outbox-drain")

/**
 * The full set of scheduled jobs, in generated graph order. Consumed by the
 * Cloud Scheduler emitter and by `entry.ts` `scheduled()` dispatch.
 */
export const OPERATOR_CRON_JOBS: readonly CronJob[] = GRAPH_OPERATOR_CRON_JOBS.map(toCronJob)

function toCronJob(job: OperatorDeploymentGraphScheduledJob): CronJob {
  return {
    id: job.id,
    cron: job.cron,
    description: job.description,
    route: job.route,
    module: job.module,
    ...(job.workflowId ? { workflowId: job.workflowId } : {}),
    ...(Object.hasOwn(job, "input") ? { input: job.input } : {}),
  }
}

export interface ScheduledDispatchKey {
  cron?: string
  scheduleId?: string
}

export function resolveOperatorCronJob(event: ScheduledDispatchKey) {
  return resolveCronJobFromJobs(event, OPERATOR_CRON_JOBS)
}

export function resolveCronJobFromJobs(event: ScheduledDispatchKey, jobs: readonly CronJob[]) {
  if (event.scheduleId) {
    return jobs.find((job) => job.id === event.scheduleId)
  }
  if (event.cron) {
    return jobs.find((job) => job.cron === event.cron)
  }
  return undefined
}

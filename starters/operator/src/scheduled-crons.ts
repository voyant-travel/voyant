// Runtime-neutral scheduled job declarations. Stable ids are the dispatch keys
// for the operator's scheduled work: `entry.ts` `scheduled()` resolves them, and
// `scripts/emit-cloud-scheduler.ts` fans them out to Cloud Scheduler jobs that
// POST `/__voyant/scheduled?schedule=<id>&cron=<expr>` on the Node runtime.

import { createVoyantNodeScheduledJobPlan } from "@voyant-travel/framework/node-host"
import { loadDeploymentGraphArtifacts } from "./deployment-graph-artifacts"

const scheduledJobs = createVoyantNodeScheduledJobPlan(loadDeploymentGraphArtifacts().scheduledJobs)

// The cron expressions `entry.ts` `scheduled()` dispatches on. Sourced from the
// generated deployment graph so the dispatch and the emitted Cloud Scheduler
// jobs can never drift.
export const CHANNEL_PUSH_BOOKING_LINK_CRON = scheduledJobs.requireCron("channel-push-booking-link")
export const CHANNEL_PUSH_AVAILABILITY_CRON = scheduledJobs.requireCron("channel-push-availability")
export const CHANNEL_PUSH_CONTENT_CRON = scheduledJobs.requireCron("channel-push-content")
export const OUTBOX_DRAIN_CRON = scheduledJobs.requireCron("outbox-drain")

/**
 * The full set of scheduled jobs, in generated graph order. Consumed by the
 * Cloud Scheduler emitter and by `entry.ts` `scheduled()` dispatch.
 */
export const OPERATOR_CRON_JOBS = scheduledJobs.jobs

export const resolveOperatorCronJob = scheduledJobs.resolve

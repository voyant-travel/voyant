// Runtime-neutral cron declarations. These expressions are the single source of
// truth for the operator's scheduled work: `entry.ts` `scheduled()` dispatches
// off them, and `scripts/emit-cloud-scheduler.mjs` fans them out to Cloud
// Scheduler jobs that POST `/__voyant/scheduled?cron=<expr>` on the Node runtime.
// (Under Cloudflare Workers the same list populated `wrangler.jsonc`
// `triggers.crons`; the operator is now Node-only — voyant#2966.)

export const CHANNEL_PUSH_BOOKING_LINK_CRON = "*/15 * * * *"
export const CHANNEL_PUSH_AVAILABILITY_CRON = "0 * * * *"
export const CHANNEL_PUSH_CONTENT_CRON = "0 3 * * *"
export const EXTERNAL_CRUISE_CATALOG_REFRESH_CRON = "30 3 * * *"
export const DRAFT_REAPER_CRON = "5 * * * *"
export const PROMOTION_BOUNDARY_SCHEDULER_CRON = "*/5 * * * *"
export const OUTBOX_DRAIN_CRON = "*/2 * * * *"

/** One scheduled job: a stable id, its cron expression, and what it does. */
export interface CronJob {
  /** Stable, kebab-case identifier — used as the Cloud Scheduler job name. */
  id: string
  /** Standard 5-field cron expression (UTC). */
  cron: string
  /** Human-readable description of the work this trigger drives. */
  description: string
}

/**
 * The full set of scheduled jobs, in declaration order. Consumed by the Cloud
 * Scheduler emitter; kept in sync with `entry.ts` `scheduled()` dispatch by the
 * shared cron constants above.
 */
export const OPERATOR_CRON_JOBS: readonly CronJob[] = [
  {
    id: "channel-push-booking-link",
    cron: CHANNEL_PUSH_BOOKING_LINK_CRON,
    description: "Channel-push booking-link reconciler (every 15 min).",
  },
  {
    id: "channel-push-availability",
    cron: CHANNEL_PUSH_AVAILABILITY_CRON,
    description: "Channel-push availability reconciler (hourly).",
  },
  {
    id: "channel-push-content",
    cron: CHANNEL_PUSH_CONTENT_CRON,
    description: "Channel-push content reconciler (nightly at 03:00).",
  },
  {
    id: "external-cruise-catalog-refresh",
    cron: EXTERNAL_CRUISE_CATALOG_REFRESH_CRON,
    description: "External cruise catalog refresh (nightly at 03:30).",
  },
  {
    id: "draft-reaper",
    cron: DRAFT_REAPER_CRON,
    description: "Drops expired booking drafts (hourly at :05).",
  },
  {
    id: "promotion-boundary-scheduler",
    cron: PROMOTION_BOUNDARY_SCHEDULER_CRON,
    description: "Emits promotion.changed at valid_from / valid_until boundaries (every 5 min).",
  },
  {
    id: "outbox-drain",
    cron: OUTBOX_DRAIN_CRON,
    description: "Redelivers failed/interrupted event-outbox deliveries (every 2 min).",
  },
]

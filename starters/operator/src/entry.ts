import { createWorkerFetch, lazySsr } from "@voyant-travel/worker-runtime"
import { operatorApiDispatch } from "./hono-api-dispatch"
import { reportBackgroundFailure } from "./lib/observability"
import {
  CHANNEL_PUSH_AVAILABILITY_CRON,
  CHANNEL_PUSH_BOOKING_LINK_CRON,
  CHANNEL_PUSH_CONTENT_CRON,
  DRAFT_REAPER_CRON,
  EXTERNAL_CRUISE_CATALOG_REFRESH_CRON,
  OUTBOX_DRAIN_CRON,
  PROMOTION_BOUNDARY_SCHEDULER_CRON,
} from "./scheduled-crons"

// SSR is loaded lazily behind the non-API branch so the React + react-dom/server
// graph (~2.2 MB) is imported on first render rather than at boot. `fetch` and
// `scheduled` are plain handlers; `src/server.ts` wires them into the Node
// runtime via `createNodeServer`. See docs/architecture/deployment-targets.md.
export const fetch = createWorkerFetch<CloudflareBindings, ExecutionContext>({
  api: operatorApiDispatch,
  ssr: lazySsr(() => import("./ssr-handler").then((mod) => mod.handleSsrRequest)),
})

// Scheduled entrypoint. On Node the platform's Cloud Scheduler POSTs each cron
// expression to `/__voyant/scheduled?cron=<expr>` (see createNodeServer); the
// reconciler picks the right scanner based on `event.cron`. Cron expressions are
// the single source of truth in `./scheduled-crons` (`OPERATOR_CRON_JOBS`), fanned
// out to Cloud Scheduler by `scripts/emit-cloud-scheduler.mjs`.
export async function scheduled(
  event: ScheduledController,
  env: CloudflareBindings,
  ctx: ExecutionContext,
): Promise<void> {
  if (event.cron === OUTBOX_DRAIN_CRON) {
    ctx.waitUntil(
      import("./api/jobs/outbox-drain-scheduled")
        .then((mod) => mod.runScheduledOutboxDrain(event, env))
        .then((result) => {
          if (result.claimed > 0 || result.deadLettered > 0) {
            console.info("[outbox-drain] result", result)
          }
        })
        .catch((err) => reportBackgroundFailure("outbox-drain", err)),
    )
    return
  }
  if (event.cron === DRAFT_REAPER_CRON) {
    ctx.waitUntil(
      import("./api/jobs/draft-reaper-scheduled")
        .then((mod) => mod.runScheduledDraftReaper(event, env))
        .then((result) => {
          console.info("[draft-reaper] result", result)
        })
        .catch((err) => reportBackgroundFailure("draft-reaper", err)),
    )
    return
  }
  if (event.cron === PROMOTION_BOUNDARY_SCHEDULER_CRON) {
    ctx.waitUntil(
      import("./api/jobs/promotion-scheduled")
        .then((mod) => mod.runScheduledPromotionBoundary(event, env))
        .then((result) => {
          console.info("[promotion-scheduler] result", result)
        })
        .catch((err) => reportBackgroundFailure("promotion-scheduler", err)),
    )
    return
  }
  if (
    event.cron === CHANNEL_PUSH_BOOKING_LINK_CRON ||
    event.cron === CHANNEL_PUSH_AVAILABILITY_CRON ||
    event.cron === CHANNEL_PUSH_CONTENT_CRON
  ) {
    ctx.waitUntil(
      import("./api/jobs/channel-push-scheduled")
        .then((mod) => mod.runScheduledChannelPushReconciler(event, env))
        .catch((err) => reportBackgroundFailure("channel-push", err)),
    )
    return
  }
  if (event.cron === EXTERNAL_CRUISE_CATALOG_REFRESH_CRON) {
    ctx.waitUntil(
      import("./api/jobs/external-cruise-refresh-scheduled")
        .then((mod) => mod.runScheduledExternalCruiseCatalogRefresh(event, env))
        .then((result) => {
          console.info("[external-cruise-refresh] result", result)
        })
        .catch((err) => reportBackgroundFailure("external-cruise-refresh", err)),
    )
    return
  }
  console.warn("[scheduled] unknown cron expression", { cron: event.cron })
}

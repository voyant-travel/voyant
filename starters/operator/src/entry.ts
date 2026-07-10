import { createWorkerFetch, lazySsr } from "@voyant-travel/runtime"
import { operatorApiDispatch } from "./hono-api-dispatch"
import { reportBackgroundFailure } from "./lib/observability"
import {
  CHANNEL_PUSH_AVAILABILITY_CRON,
  CHANNEL_PUSH_BOOKING_LINK_CRON,
  CHANNEL_PUSH_CONTENT_CRON,
  resolveOperatorCronJob,
} from "./scheduled-crons"

// SSR is loaded lazily behind the non-API branch so the React + react-dom/server
// graph (~2.2 MB) is imported on first render rather than at boot. `fetch` and
// `scheduled` are plain handlers; `src/server.ts` wires them into the Node
// runtime via `createNodeServer`. See docs/architecture/deployment-targets.md.
export const fetch = createWorkerFetch<AppBindings, ExecutionContext>({
  api: operatorApiDispatch,
  ssr: lazySsr(() => import("./ssr-handler").then((mod) => mod.handleSsrRequest)),
})

// Scheduled entrypoint. On Node the platform's Cloud Scheduler POSTs each stable
// job id to `/__voyant/scheduled?schedule=<id>` (see createNodeServer). Legacy
// `?cron=<expr>` dispatch still resolves through `./scheduled-crons` so already
// provisioned scheduler jobs do not break while provisioning migrates.
export async function scheduled(
  event: ScheduledController,
  env: AppBindings,
  ctx: ExecutionContext,
): Promise<void> {
  const dispatchKey = event as ScheduledController & { scheduleId?: string }
  const job = resolveOperatorCronJob(dispatchKey)
  if (!job) {
    console.warn("[scheduled] unknown schedule", {
      scheduleId: dispatchKey.scheduleId,
      cron: dispatchKey.cron,
    })
    return
  }
  const scheduledEvent = { ...dispatchKey, cron: job.cron }

  if (job.workflowId) {
    ctx.waitUntil(
      import("./api/jobs/workflow-scheduled")
        .then((mod) => {
          if (!mod.isGraphWorkflowScheduledJob(job)) {
            throw new Error(`[scheduled] invalid workflow schedule ${job.id}`)
          }
          return mod.runScheduledWorkflow(job, scheduledEvent, env)
        })
        .then((result) => {
          console.info("[scheduled-workflow] triggered", {
            scheduleId: job.id,
            workflowId: job.workflowId,
          })
          return result
        })
        .catch((err) => reportBackgroundFailure("scheduled-workflow", err)),
    )
    return
  }

  if (job.id === "outbox-drain") {
    ctx.waitUntil(
      import("./api/jobs/outbox-drain-scheduled")
        .then((mod) => mod.runScheduledOutboxDrain(scheduledEvent, env))
        .then((result) => {
          if (result.claimed > 0 || result.deadLettered > 0) {
            console.info("[outbox-drain] result", result)
          }
        })
        .catch((err) => reportBackgroundFailure("outbox-drain", err)),
    )
    return
  }
  if (job.id === "draft-reaper") {
    ctx.waitUntil(
      import("./api/jobs/draft-reaper-scheduled")
        .then((mod) => mod.runScheduledDraftReaper(scheduledEvent, env))
        .then((result) => {
          console.info("[draft-reaper] result", result)
        })
        .catch((err) => reportBackgroundFailure("draft-reaper", err)),
    )
    return
  }
  if (job.id === "promotion-boundary-scheduler") {
    ctx.waitUntil(
      import("./api/jobs/promotion-scheduled")
        .then((mod) => mod.runScheduledPromotionBoundary(scheduledEvent, env))
        .then((result) => {
          console.info("[promotion-scheduler] result", result)
        })
        .catch((err) => reportBackgroundFailure("promotion-scheduler", err)),
    )
    return
  }
  if (
    job.cron === CHANNEL_PUSH_BOOKING_LINK_CRON ||
    job.cron === CHANNEL_PUSH_AVAILABILITY_CRON ||
    job.cron === CHANNEL_PUSH_CONTENT_CRON
  ) {
    ctx.waitUntil(
      import("./api/jobs/channel-push-scheduled")
        .then((mod) => mod.runScheduledChannelPushReconciler(scheduledEvent, env))
        .catch((err) => reportBackgroundFailure("channel-push", err)),
    )
    return
  }
  if (job.id === "external-cruise-catalog-refresh") {
    ctx.waitUntil(
      import("./api/jobs/external-cruise-refresh-scheduled")
        .then((mod) => mod.runScheduledExternalCruiseCatalogRefresh(scheduledEvent, env))
        .then((result) => {
          console.info("[external-cruise-refresh] result", result)
        })
        .catch((err) => reportBackgroundFailure("external-cruise-refresh", err)),
    )
    return
  }
  console.warn("[scheduled] unhandled schedule", { scheduleId: job.id, cron: job.cron })
}

import { createWorkerFetch, lazySsr } from "@voyant-travel/runtime"
import { operatorApiDispatch } from "./hono-api-dispatch"
import { reportBackgroundFailure } from "./lib/observability"
import { resolveOperatorCronJob } from "./scheduled-crons"

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
      import("@voyant-travel/workflow-runs/scheduled-workflow")
        .then((mod) => {
          if (!mod.isGraphWorkflowScheduledJob(job)) {
            throw new Error(`[scheduled] invalid workflow schedule ${job.id}`)
          }
          return mod.runScheduledWorkflow(job, scheduledEvent, {
            projectId: env.VOYANT_CLOUD_APP_SLUG ?? "operator",
            environment: resolveWorkflowEnvironment(env),
            load: () =>
              import("./workflow-runtime").then((runtime) =>
                runtime.loadOperatorWorkflowRuntime(env),
              ),
            createDriver: async (deps) =>
              import("./api/runtime/operator-runtime-adapter").then((runtime) =>
                runtime.createOperatorWorkflowDriver(env)(deps),
              ),
          })
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

  console.warn("[scheduled] unhandled schedule", { scheduleId: job.id, cron: job.cron })
}

function resolveWorkflowEnvironment(env: AppBindings): "production" | "preview" | "development" {
  const value = env.VOYANT_CLOUD_ENVIRONMENT
  return value === "production" || value === "preview" || value === "development"
    ? value
    : "development"
}

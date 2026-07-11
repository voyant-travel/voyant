import type { DriverFactoryDeps, WorkflowDriver } from "@voyant-travel/workflows/driver"
import { buildManifest } from "@voyant-travel/workflows/events"
import type { CronJob } from "../../scheduled-crons"
import type { OperatorWorkflowRuntime } from "../../workflow-runtime"
import { createOperatorWorkflowDriver } from "../runtime/operator-runtime-adapter"

type WorkflowEnvironment = "production" | "preview" | "development"
interface ScheduledWorkflowRuntimeDeps {
  loadWorkflowRuntime?: (env: NodeJS.ProcessEnv) => Promise<OperatorWorkflowRuntime>
  createWorkflowDriver?: typeof createOperatorWorkflowDriver
  buildWorkflowManifest?: typeof buildManifest
  factoryDeps?: DriverFactoryDeps
  now?: () => number
}

export type GraphWorkflowScheduledJob = CronJob & { workflowId: string }

export function isGraphWorkflowScheduledJob(job: CronJob): job is GraphWorkflowScheduledJob {
  return typeof job.workflowId === "string" && job.workflowId.length > 0
}

export async function runScheduledWorkflow(
  job: GraphWorkflowScheduledJob,
  event: ScheduledController,
  env: AppBindings,
  deps: ScheduledWorkflowRuntimeDeps = {},
): Promise<void> {
  const runtimeEnv = workflowBundleEnv(env)
  const runtime = await (deps.loadWorkflowRuntime ?? defaultLoadWorkflowRuntime)(runtimeEnv)

  const environment = resolveWorkflowEnvironment(env)
  const driver = createWorkflowDriver(env, deps, runtime.services)
  const workflows = runtime.workflows.map((workflow) => ({
    id: workflow.id,
    config: workflow.config,
  }))
  const manifest = await (deps.buildWorkflowManifest ?? buildManifest)({
    projectId: env.VOYANT_CLOUD_APP_SLUG ?? "operator",
    environment,
    workflows,
    eventFilters: runtime.eventFilters,
  })

  await driver.registerManifest({ environment, manifest })
  await driver.trigger(job.workflowId, job.input ?? {}, {
    environment,
    idempotencyKey: scheduledWorkflowIdempotencyKey(job, event, deps.now),
    tags: ["scheduled", `schedule:${job.id}`],
  })
}

function createWorkflowDriver(
  env: AppBindings,
  deps: ScheduledWorkflowRuntimeDeps,
  services: DriverFactoryDeps["services"],
): WorkflowDriver {
  const factory = (deps.createWorkflowDriver ?? createOperatorWorkflowDriver)(env)
  return factory(deps.factoryDeps ?? { ...DEFAULT_DRIVER_FACTORY_DEPS, services })
}

async function defaultLoadWorkflowRuntime(
  env: NodeJS.ProcessEnv,
): Promise<OperatorWorkflowRuntime> {
  const runtime = await import("../../workflow-runtime")
  return runtime.loadOperatorWorkflowRuntime(env)
}

const EMPTY_SERVICE_RESOLVER: DriverFactoryDeps["services"] = {
  resolve(name) {
    throw new Error(
      `[scheduled-workflow] service "${name}" is unavailable outside the API app runtime`,
    )
  },
  has() {
    return false
  },
}

const DEFAULT_DRIVER_FACTORY_DEPS: DriverFactoryDeps = {
  services: EMPTY_SERVICE_RESOLVER,
  logger(level, msg, data) {
    const method =
      level === "error" ? console.error : level === "warn" ? console.warn : console.info
    if (data !== undefined) method(`[scheduled-workflow] ${msg}`, data)
    else method(`[scheduled-workflow] ${msg}`)
  },
}

function resolveWorkflowEnvironment(env: AppBindings): WorkflowEnvironment {
  const value = env.VOYANT_CLOUD_ENVIRONMENT
  if (value === "production" || value === "preview" || value === "development") return value
  return "development"
}

function workflowBundleEnv(env: AppBindings): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...process.env }
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") out[key] = value
  }
  return out
}

function scheduledWorkflowIdempotencyKey(
  job: GraphWorkflowScheduledJob,
  event: ScheduledController,
  now: (() => number) | undefined,
): string {
  const scheduledTime = event.scheduledTime ?? now?.() ?? Date.now()
  return `scheduled:${job.id}:${scheduledTime}`
}

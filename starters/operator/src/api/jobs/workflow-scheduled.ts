import { __listRegisteredWorkflows } from "@voyant-travel/workflows"
import type { DriverFactoryDeps, WorkflowDriver } from "@voyant-travel/workflows/driver"
import { buildManifest, getEventFilterRegistry } from "@voyant-travel/workflows/events"
import type { CronJob } from "../../scheduled-crons"
import { createOperatorWorkflowDriver } from "../runtime/operator-runtime-adapter"

type WorkflowEnvironment = "production" | "preview" | "development"
type RegisteredWorkflow = ReturnType<typeof __listRegisteredWorkflows>[number]

interface WorkflowBundleModule {
  bootstrapWorkflowBundle?: (ctx?: { env?: NodeJS.ProcessEnv }) => Promise<void> | void
}

interface ScheduledWorkflowRuntimeDeps {
  importWorkflowBundle?: () => Promise<WorkflowBundleModule>
  createWorkflowDriver?: typeof createOperatorWorkflowDriver
  listRegisteredWorkflows?: () => readonly RegisteredWorkflow[]
  listEventFilters?: () => ReturnType<typeof getEventFilterRegistry>["list"] extends () => infer T
    ? T
    : never
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
  const importWorkflowBundle = deps.importWorkflowBundle ?? (() => import("../../workflows"))
  const workflowBundle = await importWorkflowBundle()
  await workflowBundle.bootstrapWorkflowBundle?.({ env: workflowBundleEnv(env) })

  const environment = resolveWorkflowEnvironment(env)
  const driver = createWorkflowDriver(env, deps)
  const workflows = (deps.listRegisteredWorkflows ?? __listRegisteredWorkflows)().map(
    (workflow) => ({
      id: workflow.id,
      config: workflow.config,
    }),
  )
  const eventFilters = deps.listEventFilters?.() ?? getEventFilterRegistry().list()
  const manifest = await (deps.buildWorkflowManifest ?? buildManifest)({
    projectId: env.VOYANT_CLOUD_APP_SLUG ?? "operator",
    environment,
    workflows,
    eventFilters,
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
): WorkflowDriver {
  const factory = (deps.createWorkflowDriver ?? createOperatorWorkflowDriver)(env)
  return factory(deps.factoryDeps ?? DEFAULT_DRIVER_FACTORY_DEPS)
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

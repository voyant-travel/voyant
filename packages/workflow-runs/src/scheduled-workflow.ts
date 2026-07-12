import type { EventFilterDescriptor, EventFilterManifestDescriptor } from "@voyant-travel/core"
import type { WorkflowDefinition } from "@voyant-travel/workflows"
import type { DriverFactoryDeps, WorkflowDriver } from "@voyant-travel/workflows/driver"
import { buildManifest } from "@voyant-travel/workflows/events"

export interface GraphWorkflowScheduledJob {
  id: string
  workflowId: string
  input?: unknown
}

export interface ScheduledWorkflowEvent {
  scheduledTime?: number
}

export interface ScheduledWorkflowRuntime {
  projectId: string
  environment: "production" | "preview" | "development"
  load(): Promise<{
    workflows: readonly WorkflowDefinition[]
    eventFilters: readonly ManifestEventFilterDescriptor[]
    services: DriverFactoryDeps["services"]
  }>
  createDriver(deps: DriverFactoryDeps): WorkflowDriver | Promise<WorkflowDriver>
  now?: () => number
  logger?: DriverFactoryDeps["logger"]
}

type ManifestEventFilterDescriptor = EventFilterDescriptor & {
  readonly manifest: EventFilterManifestDescriptor
}

export function isGraphWorkflowScheduledJob(job: {
  workflowId?: string
}): job is GraphWorkflowScheduledJob {
  return typeof job.workflowId === "string" && job.workflowId.length > 0
}

export async function runScheduledWorkflow(
  job: GraphWorkflowScheduledJob,
  event: ScheduledWorkflowEvent,
  runtime: ScheduledWorkflowRuntime,
): Promise<void> {
  const loaded = await runtime.load()
  const driver = await runtime.createDriver({
    services: loaded.services,
    logger: runtime.logger ?? defaultLogger,
  })
  const manifest = await buildManifest({
    projectId: runtime.projectId,
    environment: runtime.environment,
    workflows: loaded.workflows.map((workflow) => ({ id: workflow.id, config: workflow.config })),
    eventFilters: loaded.eventFilters,
  })

  await driver.registerManifest({ environment: runtime.environment, manifest })
  await driver.trigger(job.workflowId, job.input ?? {}, {
    environment: runtime.environment,
    idempotencyKey: `scheduled:${job.id}:${event.scheduledTime ?? runtime.now?.() ?? Date.now()}`,
    tags: ["scheduled", `schedule:${job.id}`],
  })
}

const defaultLogger: DriverFactoryDeps["logger"] = (level, message, data) => {
  const log = level === "error" ? console.error : level === "warn" ? console.warn : console.info
  if (data === undefined) log(`[scheduled-workflow] ${message}`)
  else log(`[scheduled-workflow] ${message}`, data)
}

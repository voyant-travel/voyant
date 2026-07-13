import {
  type EventBus,
  type EventFilterDescriptor,
  type EventFilterManifestDescriptor,
  type ModuleContainer,
  VOYANT_WORKFLOW_SERVICE_CONTRIBUTIONS_PORT_ID,
  type VoyantWorkflowServiceContribution,
  voyantWorkflowServiceContributionsPort,
} from "@voyant-travel/core"
import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { WorkflowDefinition } from "@voyant-travel/workflows"
import type { ServiceResolver } from "@voyant-travel/workflows/driver"
import type { WorkflowResolver } from "@voyant-travel/workflows/handler"

import type { VoyantGraphRuntime } from "./runtime-lowering.js"

export type ManifestEventFilterDescriptor = EventFilterDescriptor & {
  readonly manifest: EventFilterManifestDescriptor
}

export interface VoyantNodeWorkflowRuntime {
  workflows: readonly WorkflowDefinition[]
  eventFilters: readonly ManifestEventFilterDescriptor[]
  workflowResolver: WorkflowResolver
  services: ServiceResolver
}

export interface LoadVoyantNodeWorkflowRuntimeOptions<TEnvironment> {
  graphRuntime: VoyantGraphRuntime
  environment: TEnvironment
  createServices: (
    environment: TEnvironment,
    selectedWorkflowUnitIds: ReadonlySet<string>,
  ) =>
    | ServiceResolver
    | VoyantNodeWorkflowServiceHost
    | Promise<ServiceResolver | VoyantNodeWorkflowServiceHost>
  runtimePorts?: Readonly<Record<string, unknown>>
}

export interface VoyantNodeWorkflowServiceHost {
  services: ModuleContainer
  eventBus: EventBus
  reportFailure?(error: unknown, context: Readonly<Record<string, unknown>>): void
}

const graphRegisteredWorkflowServices = new WeakMap<ModuleContainer, Set<string>>()

/** Load workflow behavior exclusively from units selected by the generated graph. */
export async function loadVoyantNodeWorkflowRuntime<TEnvironment>(
  options: LoadVoyantNodeWorkflowRuntimeOptions<TEnvironment>,
): Promise<VoyantNodeWorkflowRuntime> {
  const units = [
    ...options.graphRuntime.modules,
    ...options.graphRuntime.extensions,
    ...options.graphRuntime.plugins,
  ]
  const workflows = await Promise.all(
    units.flatMap((unit) => unit.workflows.map((workflow) => workflow.load<WorkflowDefinition>())),
  )
  const loadedEventFilters = await Promise.all(
    units.flatMap((unit) =>
      unit.references
        .filter((reference) => reference.facet === "subscribers.runtime")
        .map((reference) => reference.load<EventFilterDescriptor>()),
    ),
  )
  const eventFilters = loadedEventFilters
    .filter((descriptor) => !isGraphRuntimeFactory(descriptor))
    .filter((descriptor) => !isOrdinarySubscriberRuntime(descriptor))
    .map(requireEventFilterManifest)
  const byId = new Map(workflows.map((workflow) => [workflow.id, workflow]))
  const selectedWorkflowUnitIds = new Set(
    units.filter((unit) => unit.workflows.length > 0).map((unit) => unit.id),
  )

  const serviceHost = await options.createServices(options.environment, selectedWorkflowUnitIds)
  const services = await registerWorkflowServiceContributions(
    serviceHost,
    options.runtimePorts,
    options.environment,
  )

  return {
    workflows,
    eventFilters,
    workflowResolver: { resolve: (workflowId) => byId.get(workflowId) },
    services,
  }
}

async function registerWorkflowServiceContributions<TEnvironment>(
  value: ServiceResolver | VoyantNodeWorkflowServiceHost,
  runtimePorts: Readonly<Record<string, unknown>> | undefined,
  environment: TEnvironment,
): Promise<ServiceResolver> {
  const contributions = runtimePorts?.[VOYANT_WORKFLOW_SERVICE_CONTRIBUTIONS_PORT_ID]
  if (contributions === undefined) return isWorkflowServiceHost(value) ? value.services : value
  if (!isWorkflowServiceHost(value)) {
    throw new Error("Graph workflow service contributions require a mutable service host.")
  }
  if (!Array.isArray(contributions)) {
    throw new Error("Graph workflow service contributions must use many cardinality.")
  }
  const seen = new Set<string>()
  for (const contribution of contributions as VoyantWorkflowServiceContribution[]) {
    await voyantWorkflowServiceContributionsPort.test(contribution)
    if (seen.has(contribution.serviceId)) {
      throw new Error(`Workflow service "${contribution.serviceId}" is registered more than once.`)
    }
    seen.add(contribution.serviceId)
  }
  let registered = graphRegisteredWorkflowServices.get(value.services)
  if (!registered) {
    registered = new Set()
    graphRegisteredWorkflowServices.set(value.services, registered)
  }
  for (const contribution of contributions as VoyantWorkflowServiceContribution[]) {
    if (registered.has(contribution.serviceId)) continue
    if (value.services.has(contribution.serviceId)) {
      throw new Error(`Workflow service "${contribution.serviceId}" is registered more than once.`)
    }
    value.services.register(
      contribution.serviceId,
      await contribution.create({
        environment: environment as Readonly<Record<string, unknown>>,
        services: value.services,
        eventBus: value.eventBus,
        reportFailure: value.reportFailure ?? defaultWorkflowFailureReporter,
      }),
    )
    registered.add(contribution.serviceId)
  }
  return value.services
}

function isWorkflowServiceHost(
  value: ServiceResolver | VoyantNodeWorkflowServiceHost,
): value is VoyantNodeWorkflowServiceHost {
  return "services" in value && "eventBus" in value
}

function defaultWorkflowFailureReporter(
  error: unknown,
  context: Readonly<Record<string, unknown>>,
): void {
  console.error("[workflow-service] background operation failed", { error, ...context })
}

function isOrdinarySubscriberRuntime(descriptor: EventFilterDescriptor): boolean {
  return (
    descriptor !== null &&
    typeof descriptor === "object" &&
    "register" in descriptor &&
    typeof descriptor.register === "function"
  )
}

function requireEventFilterManifest(
  descriptor: EventFilterDescriptor,
): ManifestEventFilterDescriptor {
  if (!descriptor.manifest || typeof descriptor.manifest.id !== "string") {
    throw new Error(
      `[node-workflow-runtime] event filter "${descriptor.id}" is missing its manifest payload`,
    )
  }
  return descriptor as ManifestEventFilterDescriptor
}

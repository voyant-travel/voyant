import type { EventFilterDescriptor, EventFilterManifestDescriptor } from "@voyant-travel/core"
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
  ) => ServiceResolver | Promise<ServiceResolver>
}

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

  return {
    workflows,
    eventFilters,
    workflowResolver: { resolve: (workflowId) => byId.get(workflowId) },
    services: await options.createServices(options.environment, selectedWorkflowUnitIds),
  }
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

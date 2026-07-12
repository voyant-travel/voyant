import type { EventFilterDescriptor, EventFilterManifestDescriptor } from "@voyant-travel/core"
import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { WorkflowDefinition } from "@voyant-travel/workflows"
import type { ServiceResolver } from "@voyant-travel/workflows/driver"
import type { WorkflowResolver } from "@voyant-travel/workflows/handler"

import { createGeneratedWorkflowRuntime } from "../.voyant/runtime/project-package-workflows.generated.js"
import { createOperatorWorkflowServiceResolver } from "./api/runtime/operator-workflow-services.js"

export interface OperatorWorkflowRuntime {
  workflows: readonly WorkflowDefinition[]
  eventFilters: readonly ManifestEventFilterDescriptor[]
  workflowResolver: WorkflowResolver
  services: ServiceResolver
}

type ManifestEventFilterDescriptor = EventFilterDescriptor & {
  readonly manifest: EventFilterManifestDescriptor
}

export interface OperatorWorkflowRuntimeBootstrapContext {
  env?: AppBindings | NodeJS.ProcessEnv
  services?: ServiceResolver
}

/** Load only graph-selected workflow/event-filter facets for the Node workflow runtime. */
export async function loadOperatorWorkflowRuntime(
  env: AppBindings | NodeJS.ProcessEnv = process.env,
): Promise<OperatorWorkflowRuntime> {
  const graphRuntime = createGeneratedWorkflowRuntime()
  const units = [...graphRuntime.modules, ...graphRuntime.extensions, ...graphRuntime.plugins]
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
  const services = await createOperatorWorkflowServiceResolver(env, selectedWorkflowUnitIds)

  return {
    workflows,
    eventFilters,
    workflowResolver: { resolve: (workflowId) => byId.get(workflowId) },
    services,
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
      `[operator-workflow-runtime] event filter "${descriptor.id}" is missing its manifest payload`,
    )
  }
  return descriptor as ManifestEventFilterDescriptor
}

/** Compatibility export consumed by workflow bundle hosts. */
export function bootstrapWorkflowBundle(
  ctx: OperatorWorkflowRuntimeBootstrapContext = {},
): Promise<OperatorWorkflowRuntime> {
  return loadOperatorWorkflowRuntime(ctx.env).then((runtime) =>
    ctx.services ? { ...runtime, services: ctx.services } : runtime,
  )
}

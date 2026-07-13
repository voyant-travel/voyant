import {
  type VoyantRuntimeHostPrimitives,
  type VoyantWorkflowServiceContribution,
  voyantWorkflowServiceContributionsPort,
} from "@voyant-travel/core"

import {
  createEventOutboxWorkflowRuntime,
  EVENT_OUTBOX_WORKFLOW_RUNTIME_KEY,
} from "./outbox-workflow.js"

export interface DbRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Contribute database-owned runtime behavior to graph-selected hosts. */
export function createDbRuntimePortContribution(
  host: DbRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [voyantWorkflowServiceContributionsPort.id]: {
      serviceId: EVENT_OUTBOX_WORKFLOW_RUNTIME_KEY,
      create(context) {
        return createEventOutboxWorkflowRuntime({
          withDb: (operation) => operation(host.primitives.database.resolve(context.environment)),
          resolveEventBus: async () => context.eventBus,
          warn: (message) => console.warn(message),
        })
      },
    } satisfies VoyantWorkflowServiceContribution,
  }
}

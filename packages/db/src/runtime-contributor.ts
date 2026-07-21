import type { DeliveryResult, VoyantRuntimeHostPrimitives } from "@voyant-travel/core"

import { type EventOutboxJobRuntime, eventOutboxJobRuntimePort } from "./outbox-job.js"

export interface DbRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Contribute database-owned runtime behavior to graph-selected hosts. */
export function createDbRuntimePortContribution(
  host: DbRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const outboxRuntime: EventOutboxJobRuntime = {
    withDb: (operation) => operation(host.primitives.database.resolve(undefined)),
    deliver: (envelope) =>
      host.primitives.events.deliver(envelope, undefined) as Promise<DeliveryResult>,
    warn: (message) => console.warn(message),
  }
  return {
    [eventOutboxJobRuntimePort.id]: outboxRuntime,
  }
}

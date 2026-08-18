import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { relationshipsPersonConversationsRuntimePort } from "@voyant-travel/relationships/runtime-port"
import { createPersonTimelineRuntime } from "./person-timeline-runtime.js"
import { conversationsDatabaseRuntimePort } from "./runtime-port.js"

/** Supply the package-owned database runtime from standard host primitives. */
export function createConversationsRuntimePortContribution(host: {
  primitives: VoyantRuntimeHostPrimitives
}): Readonly<Record<string, unknown>> {
  return {
    [conversationsDatabaseRuntimePort.id]: {
      resolveDb: (bindings?: unknown) =>
        host.primitives.database.resolve(bindings as Record<string, unknown> | undefined),
    },
    [relationshipsPersonConversationsRuntimePort.id]: createPersonTimelineRuntime(),
  }
}

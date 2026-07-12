import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { notificationsRuntimePort } from "@voyant-travel/notifications/runtime-port"

export interface NotificationsNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Contribute the standard Node Notifications adapter selected by the framework BOM. */
export function createNotificationsNodeRuntimePortContribution(
  host: NotificationsNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createNotificationsStandardNodeRuntime(host.primitives),
  )
  return { [notificationsRuntimePort.id]: runtime }
}

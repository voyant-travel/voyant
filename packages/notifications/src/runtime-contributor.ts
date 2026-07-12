import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { notificationsRuntimePort } from "./runtime-port.js"

export interface NotificationsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Contribute the standard Node Notifications adapter selected by the framework BOM. */
export function createNotificationsRuntimePortContribution(
  host: NotificationsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./runtime.js").then((module) =>
    module.createNotificationsRuntime(host.primitives),
  )
  return { [notificationsRuntimePort.id]: runtime }
}

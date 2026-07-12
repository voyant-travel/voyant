import { type NotificationsRuntimeProvider, notificationsRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface NotificationsRuntimeContributorHost {
  capabilities: {
    loadNotificationsRuntime(): RuntimePortValue<NotificationsRuntimeProvider>
  }
}

/** Package-owned registration map for Notifications deployment adapters. */
export function createNotificationsRuntimePortContribution(
  host: NotificationsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return { [notificationsRuntimePort.id]: host.capabilities.loadNotificationsRuntime() }
}

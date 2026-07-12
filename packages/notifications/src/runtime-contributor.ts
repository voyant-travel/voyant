import { type NotificationsRuntimeProvider, notificationsRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface NotificationsRuntimePortContribution {
  notifications: RuntimePortValue<NotificationsRuntimeProvider>
}

/** Package-owned registration map for Notifications deployment adapters. */
export function createNotificationsRuntimePortContribution(
  contribution: NotificationsRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [notificationsRuntimePort.id]: contribution.notifications }
}

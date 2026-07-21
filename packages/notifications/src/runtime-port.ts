import { definePort } from "@voyant-travel/core/project"

import type { CreateNotificationsApiModuleOptions } from "./index.js"
import type { NotificationReminderWorkflowRuntime } from "./workflow-runtime.js"

export interface NotificationsRuntimeProvider extends CreateNotificationsApiModuleOptions {
  resolveDb: NonNullable<CreateNotificationsApiModuleOptions["resolveDb"]>
  resolveProviders: NonNullable<CreateNotificationsApiModuleOptions["resolveProviders"]>
  resolveReminderWorkflowRuntime: (
    bindings?: Record<string, unknown>,
  ) => NotificationReminderWorkflowRuntime
}

/** Node-host contract consumed by the package-owned Notifications graph factory. */
export const notificationsRuntimePort = definePort<NotificationsRuntimeProvider>({
  id: "notifications.runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("notifications.runtime provider must be an options object.")
    }
    for (const method of [
      "resolveDb",
      "resolveProviders",
      "resolveReminderWorkflowRuntime",
    ] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`notifications.runtime provider must implement ${method}().`)
      }
    }
  },
})

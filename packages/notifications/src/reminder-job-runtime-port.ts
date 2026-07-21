import { definePort } from "@voyant-travel/core/project"
import type { NotificationReminderJobRuntime } from "./job-runtime.js"

export const notificationsReminderJobRuntimePort = definePort<NotificationReminderJobRuntime>({
  id: "notifications.reminder-job",
  test(runtime) {
    if (
      !runtime ||
      typeof runtime.resolveDb !== "function" ||
      typeof runtime.resolveEnv !== "function" ||
      typeof runtime.resolveRuntimeOptions !== "function"
    ) {
      throw new Error("notifications.reminder-job provider is incomplete.")
    }
  },
})

import { definePort, type VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"

import { sendDueNotificationReminders } from "./tasks/send-due-reminders.js"
import type { NotificationReminderJobRuntime } from "./job-runtime.js"

export const notificationsReminderJobRuntimePort =
  definePort<NotificationReminderJobRuntime>({
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

/** Sweep and deliver reminders whose durable run records are due. */
export async function runDueNotificationRemindersJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(notificationsReminderJobRuntimePort)
  const [db, env] = await Promise.all([runtime.resolveDb(), runtime.resolveEnv()])
  await sendDueNotificationReminders(db, env, {}, await runtime.resolveRuntimeOptions(env))
}
